import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const packRoot = resolve(root, "data/seed-packs/hampton-roads-va");
const output = process.argv.find((arg) => arg.startsWith("--output="))?.slice(9)
  ?? resolve(packRoot, "geocodes.generated.json");
const benchmark = process.env.CENSUS_GEOCODER_BENCHMARK || "Public_AR_Current";
const endpoint = "https://geocoding.geo.census.gov/geocoder/locations/address";

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { field += '"'; i += 1; }
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

function stripUnit(address) {
  return address
    .replace(/\s*,?\s*(suite|ste|unit|office|floor|fl|building|bldg)\s+[a-z0-9-]+.*$/i, "")
    .replace(/\s*,?\s*#\s*[a-z0-9-]+.*$/i, "")
    .trim();
}

function sleep(ms) { return new Promise((resolvePromise) => setTimeout(resolvePromise, ms)); }

async function geocode(location) {
  const params = new URLSearchParams({
    street: stripUnit(location.address1),
    city: location.city,
    state: location.state,
    zip: location.postal_code,
    benchmark,
    format: "json",
  });
  const response = await fetch(`${endpoint}?${params.toString()}`, {
    headers: { "user-agent": "RFxchange-Hampton-Roads-seed-geocoder/1.0" },
  });
  if (!response.ok) throw new Error(`Census geocoder ${response.status} for ${location.location_key}`);
  const body = await response.json();
  const matches = Array.isArray(body?.result?.addressMatches) ? body.result.addressMatches : [];
  if (matches.length !== 1) {
    return { status: matches.length ? "review" : "failed", reason: matches.length ? "multiple_matches" : "no_match", candidateCount: matches.length };
  }
  const match = matches[0];
  const components = match.addressComponents ?? {};
  const latitude = Number(match.coordinates?.y);
  const longitude = Number(match.coordinates?.x);
  const stateMatches = String(components.state ?? "").toUpperCase() === location.state.toUpperCase();
  const requestedZip = location.postal_code.trim();
  const matchedZip = String(components.zip ?? "").trim();
  const zipMatches = !requestedZip || matchedZip.startsWith(requestedZip.slice(0, 5));
  const usable = Number.isFinite(latitude) && Number.isFinite(longitude) && stateMatches && zipMatches;
  if (!usable) {
    return {
      status: "review",
      reason: "state_zip_or_coordinate_mismatch",
      matchedAddress: match.matchedAddress,
      latitude: Number.isFinite(latitude) ? latitude : undefined,
      longitude: Number.isFinite(longitude) ? longitude : undefined,
      addressComponents: components,
    };
  }
  return {
    status: "accepted",
    provider: "census",
    benchmark,
    matchType: "single_match_state_zip",
    matchedAddress: match.matchedAddress,
    latitude,
    longitude,
    addressComponents: components,
  };
}

const locations = parseCsv(await readFile(resolve(packRoot, "locations.csv"), "utf8"));
const seen = new Set();
const primaryLocations = locations.filter((row) => {
  if (row.location_status !== "candidate" || !row.address1 || seen.has(row.seed_key)) return false;
  seen.add(row.seed_key);
  return true;
});

const results = {};
for (const [index, location] of primaryLocations.entries()) {
  try {
    results[location.seed_key] = {
      seedKey: location.seed_key,
      locationKey: location.location_key,
      requestedAddress: [location.address1, location.address2, location.city, location.state, location.postal_code].filter(Boolean).join(", "),
      ...(await geocode(location)),
      geocodedAt: new Date().toISOString(),
    };
  } catch (error) {
    results[location.seed_key] = {
      seedKey: location.seed_key,
      locationKey: location.location_key,
      status: "failed",
      reason: error instanceof Error ? error.message : "geocoder_error",
      geocodedAt: new Date().toISOString(),
    };
  }
  console.log(`[${index + 1}/${primaryLocations.length}] ${location.seed_key}: ${results[location.seed_key].status}`);
  await sleep(120);
}

const summary = Object.values(results).reduce((acc, item) => {
  acc[item.status] = (acc[item.status] ?? 0) + 1;
  return acc;
}, {});
const manifest = {
  marketKey: "hampton-roads-va",
  provider: "census",
  benchmark,
  generatedAt: new Date().toISOString(),
  policy: "Only a single Census match with matching state and ZIP is accepted automatically. Review/failed results remain off-map.",
  summary,
  results,
};
await writeFile(output, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ output, candidates: primaryLocations.length, summary }, null, 2));
