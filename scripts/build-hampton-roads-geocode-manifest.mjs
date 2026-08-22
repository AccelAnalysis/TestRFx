import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const packRoot = resolve(root, "data/seed-packs/hampton-roads-va");
const output = process.argv.find((arg) => arg.startsWith("--output="))?.slice(9)
  ?? resolve(packRoot, "geocodes.generated.json");
const benchmark = process.env.CENSUS_GEOCODER_BENCHMARK || "Public_AR_Current";
const structuredEndpoint = "https://geocoding.geo.census.gov/geocoder/locations/address";
const oneLineEndpoint = "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress";

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

function stripUnit(address) {
  return address
    .replace(/\s*,?\s*(suite|ste|unit|office|floor|fl|building|bldg)\s+[a-z0-9-]+.*$/i, "")
    .replace(/\s*,?\s*#\s*[a-z0-9-]+.*$/i, "")
    .trim();
}

function normalizeLeadingNumberWord(value) {
  return value.replace(/^one\b/i, "1").replace(/^two\b/i, "2").replace(/^three\b/i, "3");
}

function sleep(ms) { return new Promise((resolvePromise) => setTimeout(resolvePromise, ms)); }

async function requestMatches(url) {
  const response = await fetch(url, { headers: { "user-agent": "RFxchange-Hampton-Roads-seed-geocoder/1.0" } });
  if (!response.ok) throw new Error(`Census geocoder ${response.status}`);
  const body = await response.json();
  return Array.isArray(body?.result?.addressMatches) ? body.result.addressMatches : [];
}

async function censusMatches(location) {
  const street = normalizeLeadingNumberWord(stripUnit(location.address1));
  const structured = new URLSearchParams({
    street,
    city: location.city,
    state: location.state,
    zip: location.postal_code,
    benchmark,
    format: "json",
  });
  let matches = await requestMatches(`${structuredEndpoint}?${structured.toString()}`);
  if (matches.length) return { matches, lookupForm: "structured" };

  const oneLineAddress = [street, location.city, location.state, location.postal_code].filter(Boolean).join(", ");
  const oneLine = new URLSearchParams({ address: oneLineAddress, benchmark, format: "json" });
  matches = await requestMatches(`${oneLineEndpoint}?${oneLine.toString()}`);
  return { matches, lookupForm: "oneline_fallback" };
}

async function geocode(location) {
  const { matches, lookupForm } = await censusMatches(location);
  if (matches.length !== 1) {
    return { status: matches.length ? "review" : "failed", reason: matches.length ? "multiple_matches" : "no_match", candidateCount: matches.length, lookupForm };
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
      lookupForm,
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
    lookupForm,
    matchType: "single_match_state_zip",
    matchedAddress: match.matchedAddress,
    latitude,
    longitude,
    addressComponents: components,
  };
}

const [candidateText, locationText] = await Promise.all([
  readFile(resolve(packRoot, "candidates.csv"), "utf8"),
  readFile(resolve(packRoot, "locations.csv"), "utf8"),
]);
const candidates = parseCsv(candidateText);
const locations = parseCsv(locationText);
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

const accepted = {};
const unresolved = {};
for (const [seedKey, result] of Object.entries(results)) {
  const { seedKey: _seedKey, requestedAddress: _requestedAddress, addressComponents: _addressComponents, ...portable } = result;
  if (result.status === "accepted") {
    accepted[seedKey] = portable;
  } else {
    unresolved[seedKey] = portable;
  }
}

const locationReview = new Set(locations.filter((location) => location.location_status !== "candidate").map((location) => location.seed_key));
const heldOut = candidates
  .map((candidate) => candidate.seed_key)
  .filter((seedKey) => !seen.has(seedKey))
  .map((seedKey) => ({
    seedKey,
    reason: locationReview.has(seedKey) ? "source_location_needs_review" : "no_ready_sourced_street_address",
  }));

const summary = Object.values(results).reduce((acc, item) => {
  acc[item.status] = (acc[item.status] ?? 0) + 1;
  return acc;
}, {});
const manifest = {
  marketKey: "hampton-roads-va",
  provider: "census",
  benchmark,
  generatedAt: new Date().toISOString(),
  policy: "Only a single Census match with matching state and ZIP is accepted automatically. Structured address lookup is attempted first, then Census onelineaddress. Review/failed results remain off-map.",
  summary,
  accepted,
  unresolved,
  heldOut,
};
await writeFile(output, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ output, candidates: primaryLocations.length, summary, heldOut: heldOut.length }, null, 2));
