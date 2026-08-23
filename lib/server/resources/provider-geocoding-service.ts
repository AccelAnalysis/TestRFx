import { getDatabase } from "@/lib/server/database";
import { censusGeocodeAddress } from "@/lib/server/resources/census-geocoder";
import { geocodeCoordinatesAreUsable, type ProviderGeocodeResult } from "@/lib/resources/provider-geocoding";
import { ProviderIngestionError } from "@/lib/server/resources/provider-ingestion-service";
import { resolveCensusCoordinateProfile } from "@/lib/server/geography/census-profile-resolver";
import { persistLocationGeographyProfile } from "@/lib/server/geography/geography-repository";
import { getMarketSeedPack } from "@/lib/resources/market-seed-packs";
import type { GeographyReference } from "@/lib/geography/contracts";

// Keep this structural so root postgres.js and transaction Sql instances both work.
type QueryExecutor = any;

type GeocodeCandidateRow = {
  id: string;
  source_record_id: string;
  market_key: string;
  address_line_1: string | null;
  locality: string | null;
  region: string | null;
  postal_code: string | null;
  candidate_state: string;
  promoted_exchange_record_id: string | null;
};

async function candidateBySourceRecord(sql: QueryExecutor, marketKey: string, sourceKey: string, sourceRecordId: string) {
  const rows = await sql<GeocodeCandidateRow[]>`
    SELECT c.id::text, c.source_record_id, c.market_key, c.address_line_1, c.locality, c.region, c.postal_code,
           c.candidate_state, c.promoted_exchange_record_id::text
    FROM resource_ingestion_candidates c
    JOIN external_resource_sources s ON s.id = c.source_id
    WHERE c.market_key = ${marketKey}
      AND s.source_key = ${sourceKey}
      AND c.source_record_id = ${sourceRecordId}
    LIMIT 1
  `;
  return rows[0];
}

async function candidateById(sql: QueryExecutor, candidateId: string) {
  const rows = await sql<GeocodeCandidateRow[]>`
    SELECT id::text, source_record_id, market_key, address_line_1, locality, region, postal_code,
           candidate_state, promoted_exchange_record_id::text
    FROM resource_ingestion_candidates
    WHERE id = ${candidateId}::uuid
    LIMIT 1
  `;
  return rows[0];
}

function requestedAddress(candidate: GeocodeCandidateRow) {
  return {
    addressLine1: candidate.address_line_1 ?? "",
    locality: candidate.locality ?? "",
    region: candidate.region ?? "",
    postalCode: candidate.postal_code ?? undefined,
  };
}

function marketReference(marketKey: string): GeographyReference | undefined {
  const pack = getMarketSeedPack(marketKey);
  if (!pack) return undefined;
  return {
    key: `rfxchange_market:region_market:${pack.key}`,
    type: "region_market",
    name: pack.geography.marketLabel,
    countryCode: pack.geography.country,
    stateCode: pack.geography.state,
    externalId: pack.key,
    source: "rfxchange_market",
    sourceLayer: "market-seed-pack",
    vintage: "current",
    metadata: { seedPackKey: pack.key },
  };
}

async function applyAcceptedCanonicalPoint(sql: QueryExecutor, candidate: GeocodeCandidateRow, result: ProviderGeocodeResult) {
  if (!candidate.promoted_exchange_record_id || !geocodeCoordinatesAreUsable(result)) return undefined;

  const exchangeRows = await sql<{ location_id: string | null; organization_id: string }[]>`
    SELECT location_id::text, organization_id::text
    FROM exchange_records
    WHERE id = ${candidate.promoted_exchange_record_id}::uuid
    LIMIT 1
  `;
  const exchange = exchangeRows[0];
  if (!exchange) throw new ProviderIngestionError("Promoted Exchange record could not be found for geocoding.", 409, "promoted_exchange_record_missing");

  let locationId = exchange.location_id ?? undefined;
  if (locationId) {
    await sql`
      UPDATE locations
      SET point = ST_SetSRID(ST_MakePoint(${result.longitude}, ${result.latitude}), 4326)::geography,
          verification_status = ${result.provider === "manual" ? "manual-verified" : "census-matched"}
      WHERE id = ${locationId}::uuid
    `;
  } else {
    const address = {
      line1: candidate.address_line_1,
      city: candidate.locality,
      region: candidate.region,
      state: candidate.region,
      postalCode: candidate.postal_code,
    };
    const locationRows = await sql<{ id: string }[]>`
      INSERT INTO locations (organization_id, label, address, point, verification_status)
      VALUES (
        ${exchange.organization_id}::uuid,
        'Seeded provider location',
        ${sql.json(address)},
        ST_SetSRID(ST_MakePoint(${result.longitude}, ${result.latitude}), 4326)::geography,
        ${result.provider === "manual" ? "manual-verified" : "census-matched"}
      )
      RETURNING id::text
    `;
    locationId = locationRows[0]?.id;
    if (!locationId) throw new ProviderIngestionError("Canonical Location could not be created for accepted geocode.", 500, "geocode_location_unavailable");
    await sql`
      UPDATE exchange_records
      SET location_id = ${locationId}::uuid, updated_at = now()
      WHERE id = ${candidate.promoted_exchange_record_id}::uuid
    `;
  }

  await sql`
    INSERT INTO resource_location_geocodes (
      location_id, provider, benchmark, status, match_type, requested_address,
      matched_address, latitude, longitude, response_payload, geocoded_at, verified_at
    ) VALUES (
      ${locationId}::uuid, ${result.provider}, ${result.benchmark ?? null}, 'accepted', ${result.matchType ?? null},
      ${sql.json(requestedAddress(candidate))}, ${result.matchedAddress ?? null}, ${result.latitude}, ${result.longitude},
      ${sql.json(result.payload ?? {})}, now(), ${result.provider === "manual" ? new Date() : null}
    )
    ON CONFLICT (location_id) DO UPDATE SET
      provider = EXCLUDED.provider,
      benchmark = EXCLUDED.benchmark,
      status = EXCLUDED.status,
      match_type = EXCLUDED.match_type,
      requested_address = EXCLUDED.requested_address,
      matched_address = EXCLUDED.matched_address,
      latitude = EXCLUDED.latitude,
      longitude = EXCLUDED.longitude,
      response_payload = EXCLUDED.response_payload,
      geocoded_at = EXCLUDED.geocoded_at,
      verified_at = EXCLUDED.verified_at
  `;

  await sql`
    UPDATE resources
    SET visibility = 'public-location'
    WHERE exchange_record_id = ${candidate.promoted_exchange_record_id}::uuid
  `;

  const censusProfile = await resolveCensusCoordinateProfile({ latitude: result.latitude!, longitude: result.longitude! });
  const geographyProfile = await persistLocationGeographyProfile(locationId, censusProfile, {
    market: marketReference(candidate.market_key),
    sql,
  });

  return { locationId, geographyProfile };
}

async function persistGeocode(sql: QueryExecutor, candidate: GeocodeCandidateRow, result: ProviderGeocodeResult) {
  const accepted = result.status === "accepted" && geocodeCoordinatesAreUsable(result);
  await sql`
    UPDATE resource_ingestion_candidates
    SET geocode_status = ${result.status},
        geocode_provider = ${result.provider},
        geocode_benchmark = ${result.benchmark ?? null},
        geocode_match_type = ${result.matchType ?? null},
        geocode_matched_address = ${result.matchedAddress ?? null},
        geocode_payload = ${sql.json({ reason: result.reason, ...(result.payload ?? {}) })},
        geocoded_at = now(),
        geocode_verified_at = ${result.provider === "manual" && accepted ? new Date() : null},
        latitude = CASE WHEN ${accepted} THEN ${accepted ? result.latitude : null} ELSE latitude END,
        longitude = CASE WHEN ${accepted} THEN ${accepted ? result.longitude : null} ELSE longitude END,
        updated_at = now()
    WHERE id = ${candidate.id}::uuid
  `;

  const canonical = accepted ? await applyAcceptedCanonicalPoint(sql, candidate, result) : undefined;
  return {
    candidateId: candidate.id,
    sourceRecordId: candidate.source_record_id,
    candidateState: candidate.candidate_state,
    canonicalLocationUpdated: Boolean(canonical?.locationId),
    geographyProfileUpdated: Boolean(canonical?.geographyProfile),
    locationId: canonical?.locationId,
    geographyProfile: canonical?.geographyProfile,
    result,
  };
}

export async function geocodeProviderCandidate(input: { marketKey: string; sourceKey: string; sourceRecordId: string }) {
  const sql = getDatabase();
  return sql.begin(async (tx) => {
    const candidate = await candidateBySourceRecord(tx, input.marketKey, input.sourceKey, input.sourceRecordId);
    if (!candidate) throw new ProviderIngestionError("Resource Provider candidate was not found for the requested source.", 404, "candidate_not_found");

    if (!candidate.address_line_1 || !candidate.locality || !candidate.region) {
      return persistGeocode(tx, candidate, {
        status: "failed",
        provider: "census",
        matchType: "missing_sourced_address",
        reason: "A sourced street address, locality, and region are required before automated geocoding.",
      });
    }

    const result = await censusGeocodeAddress(requestedAddress(candidate));
    return persistGeocode(tx, candidate, result);
  });
}

export async function acceptProviderGeocode(input: {
  candidateId: string;
  latitude: number;
  longitude: number;
  matchedAddress?: string;
  basis: string;
}) {
  if (!input.basis.trim()) throw new ProviderIngestionError("Manual geocode acceptance requires a documented basis.", 400, "geocode_basis_required");
  const result: ProviderGeocodeResult = {
    status: "accepted",
    provider: "manual",
    matchType: "manual_verified",
    matchedAddress: input.matchedAddress?.trim() || undefined,
    latitude: input.latitude,
    longitude: input.longitude,
    payload: { basis: input.basis.trim() },
  };
  if (!geocodeCoordinatesAreUsable(result)) throw new ProviderIngestionError("Manual geocode coordinates are invalid.", 400, "invalid_geocode_coordinates");

  const sql = getDatabase();
  return sql.begin(async (tx) => {
    const candidate = await candidateById(tx, input.candidateId);
    if (!candidate) throw new ProviderIngestionError("Resource Provider candidate was not found.", 404, "candidate_not_found");
    return persistGeocode(tx, candidate, result);
  });
}
