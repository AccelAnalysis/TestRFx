import { readFile } from "node:fs/promises";

const packRoot = new URL("../data/seed-packs/hampton-roads-va/", import.meta.url);
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const baseUrlArg = args.find((arg) => arg.startsWith("--base-url="));
const baseUrl = (baseUrlArg?.slice("--base-url=".length) || process.env.RFXCHANGE_APP_URL || "http://localhost:3000").replace(/\/$/, "");
const token = process.env.RFXCHANGE_INGESTION_TOKEN;

if (!dryRun && !token) {
  throw new Error("RFXCHANGE_INGESTION_TOKEN is required unless --dry-run is used.");
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field.length || row.length) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }
  const [headers, ...data] = rows.filter((candidate) => candidate.some((value) => value.length));
  return data.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}

function asBoolean(value) {
  return value.trim().toLowerCase() === "true";
}

function splitPipe(value) {
  return value ? value.split("|").map((item) => item.trim()).filter(Boolean) : [];
}

function sourceAuthority(candidate, source) {
  const authoritativeTypes = new Set([
    "regional-development-organization",
    "economic-development-office",
    "economic-development-authority",
    "sbdc",
    "workforce-board",
    "public-program",
  ]);
  if (authoritativeTypes.has(candidate.provider_type_candidate)) return "authoritative";
  if (source.source_kind.includes("local_government") || source.source_kind.includes("local_economic_development")) return "authoritative";
  return "curated";
}

function primaryLocation(allLocations) {
  return allLocations.find((location) => location.location_status === "candidate");
}

function groupBy(items, keyFor) {
  const grouped = new Map();
  for (const item of items) {
    const key = keyFor(item);
    const bucket = grouped.get(key) ?? [];
    bucket.push(item);
    grouped.set(key, bucket);
  }
  return grouped;
}

const [candidateText, locationText, sourceText] = await Promise.all([
  readFile(new URL("candidates.csv", packRoot), "utf8"),
  readFile(new URL("locations.csv", packRoot), "utf8"),
  readFile(new URL("sources.csv", packRoot), "utf8"),
]);

const candidates = parseCsv(candidateText);
const locations = parseCsv(locationText);
const sources = parseCsv(sourceText);
const locationsBySeed = groupBy(locations, (location) => location.seed_key);
const sourcesBySeed = groupBy(sources, (source) => source.candidate_seed_key);
const sourcesById = new Map(sources.map((source) => [source.source_id, source]));

const payloads = candidates.map((candidate) => {
  const primarySource = sourcesById.get(candidate.primary_source_id);
  if (!primarySource) throw new Error(`Missing primary source ${candidate.primary_source_id} for ${candidate.seed_key}.`);
  if (candidate.classification_review_required !== "false") {
    throw new Error(`${candidate.seed_key} still requires provider classification review and is not stage-ready.`);
  }

  const allLocations = locationsBySeed.get(candidate.seed_key) ?? [];
  const sourceRows = sourcesBySeed.get(candidate.seed_key) ?? [];
  const location = primaryLocation(allLocations);
  const raw = {
    seedKey: candidate.seed_key,
    aliases: splitPipe(candidate.aliases),
    entityShapeCandidate: candidate.entity_shape_candidate || undefined,
    canonicalParentCandidate: candidate.canonical_parent_candidate || undefined,
    canonicalizationReviewRequired: asBoolean(candidate.canonicalization_review_required),
    intendedClaimState: candidate.intended_claim_state,
    researchRetrievedAt: "2026-08-22",
    locations: allLocations.map((item) => ({
      label: item.label,
      address1: item.address1 || undefined,
      address2: item.address2 || undefined,
      city: item.city || undefined,
      state: item.state || undefined,
      postalCode: item.postal_code || undefined,
      kind: item.location_kind,
      status: item.location_status,
    })),
    sources: sourceRows.map((item) => ({
      id: item.source_id,
      name: item.source_name,
      url: item.source_url,
      kind: item.source_kind,
      retrievedAt: item.retrieved_at,
      useBasis: item.use_basis,
      factsSupported: item.facts_supported,
    })),
    sourcedPrograms: splitPipe(candidate.sourced_programs),
    reviewNotes: candidate.review_notes || undefined,
  };

  const provider = {
    sourceRecordId: candidate.seed_key,
    sourceUrl: primarySource.source_url,
    organizationName: candidate.display_name,
    website: candidate.website,
    providerType: candidate.provider_type_candidate,
    resourceCategory: candidate.resource_category_candidate,
    serviceName: candidate.service_name,
    serviceSummary: candidate.service_summary,
    region: "VA",
    serviceArea: candidate.service_area_labels,
    raw,
  };

  // A location under review remains provenance only; the staging candidate is
  // intentionally off-map until the location is resolved.
  if (location) {
    provider.addressLine1 = [location.address1, location.address2].filter(Boolean).join(", ");
    provider.locality = location.city;
    provider.postalCode = location.postal_code || undefined;
  }

  return {
    action: "stage",
    marketKey: "hampton-roads-va",
    source: {
      key: primarySource.source_id,
      name: primarySource.source_name,
      authority: sourceAuthority(candidate, primarySource),
      sourceUrl: primarySource.source_url,
      licenseOrUseBasis: "Public factual reference from official public materials; no promotional copy is reproduced.",
    },
    candidates: [provider],
  };
});

const uniqueIds = new Set(payloads.map((payload) => payload.candidates[0].sourceRecordId));
if (uniqueIds.size !== payloads.length) throw new Error("Duplicate sourceRecordId values found in Hampton Roads seed pack.");
if (payloads.length !== 32) throw new Error(`Expected 32 Hampton Roads candidates; found ${payloads.length}.`);

if (dryRun) {
  const community = candidates.filter((candidate) => candidate.provider_class_candidate === "community_institutional").length;
  const commercial = candidates.filter((candidate) => candidate.provider_class_candidate === "commercial").length;
  const canonicalizationReview = candidates.filter((candidate) => asBoolean(candidate.canonicalization_review_required)).length;
  const locationReview = locations.filter((location) => location.location_status !== "candidate").length;
  console.log(JSON.stringify({
    marketKey: "hampton-roads-va",
    candidates: payloads.length,
    communityInstitutional: community,
    commercial,
    canonicalizationReview,
    locationReview,
    coordinatesSupplied: 0,
    readyForProtectedStaging: true,
  }, null, 2));
  process.exit(0);
}

const results = [];
for (const [index, payload] of payloads.entries()) {
  const response = await fetch(`${baseUrl}/api/resources/providers/ingest`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-rfxchange-ingestion-token": token,
    },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Stage failed for ${payload.candidates[0].sourceRecordId}: ${response.status} ${JSON.stringify(body)}`);
  }
  results.push({ seedKey: payload.candidates[0].sourceRecordId, ...body });
  console.log(`[${index + 1}/${payloads.length}] staged ${payload.candidates[0].organizationName}`);
}

const totals = results.reduce((summary, result) => ({
  received: summary.received + Number(result.received ?? 0),
  ready: summary.ready + Number(result.ready ?? 0),
  duplicate: summary.duplicate + Number(result.duplicate ?? 0),
  review: summary.review + Number(result.review ?? 0),
}), { received: 0, ready: 0, duplicate: 0, review: 0 });

console.log(JSON.stringify({ marketKey: "hampton-roads-va", baseUrl, totals, runs: results }, null, 2));
