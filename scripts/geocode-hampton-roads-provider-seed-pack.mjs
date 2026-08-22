import { readFile } from "node:fs/promises";

const packRoot = new URL("../data/seed-packs/hampton-roads-va/", import.meta.url);
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const baseUrlArg = args.find((arg) => arg.startsWith("--base-url="));
const baseUrl = (baseUrlArg?.slice("--base-url=".length) || process.env.RFXCHANGE_APP_URL || "http://localhost:3000").replace(/\/$/, "");
const token = process.env.RFXCHANGE_INGESTION_TOKEN;

if (!dryRun && !token) throw new Error("RFXCHANGE_INGESTION_TOKEN is required unless --dry-run is used.");

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { field += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else field += char;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ",") { row.push(field); field = ""; }
    else if (char === "\n") { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; }
    else field += char;
  }
  if (field.length || row.length) { row.push(field.replace(/\r$/, "")); rows.push(row); }
  const [headers, ...data] = rows.filter((values) => values.some(Boolean));
  return data.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}

const [candidateText, locationText] = await Promise.all([
  readFile(new URL("candidates.csv", packRoot), "utf8"),
  readFile(new URL("locations.csv", packRoot), "utf8"),
]);
const candidates = parseCsv(candidateText);
const locations = parseCsv(locationText);
const candidateKeys = new Set(candidates.map((candidate) => candidate.seed_key));
const seen = new Set();
const ready = [];
for (const location of locations) {
  if (!candidateKeys.has(location.seed_key) || seen.has(location.seed_key)) continue;
  if (location.location_status !== "candidate" || !location.address1 || !location.city || !location.state) continue;
  seen.add(location.seed_key);
  ready.push(location.seed_key);
}
const locationReview = [...new Set(locations.filter((location) => location.location_status !== "candidate").map((location) => location.seed_key))];
const noReadyAddress = candidates.map((candidate) => candidate.seed_key).filter((seedKey) => !seen.has(seedKey) && !locationReview.includes(seedKey));

if (dryRun) {
  console.log(JSON.stringify({
    marketKey: "hampton-roads-va",
    candidates: candidates.length,
    readyForAutomatedGeocoding: ready.length,
    locationReview,
    noReadyAddress,
    automaticPromotion: false,
  }, null, 2));
  process.exit(0);
}

const summary = { accepted: 0, review: 0, failed: 0 };
const results = [];
for (const [index, sourceRecordId] of ready.entries()) {
  const response = await fetch(`${baseUrl}/api/resources/providers/geocode`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-rfxchange-ingestion-token": token,
    },
    body: JSON.stringify({ action: "geocode", marketKey: "hampton-roads-va", sourceRecordId }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Geocode failed for ${sourceRecordId}: ${response.status} ${JSON.stringify(body)}`);
  const status = body?.result?.status;
  if (status === "accepted" || status === "review" || status === "failed") summary[status] += 1;
  results.push(body);
  console.log(`[${index + 1}/${ready.length}] ${sourceRecordId}: ${status ?? "unknown"}`);
}

console.log(JSON.stringify({
  marketKey: "hampton-roads-va",
  baseUrl,
  attempted: ready.length,
  ...summary,
  retainedForLocationReview: locationReview,
  retainedWithoutReadyAddress: noReadyAddress,
  results,
}, null, 2));
