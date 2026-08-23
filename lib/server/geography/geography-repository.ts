import "server-only";

import { getDatabase } from "@/lib/server/database";
import {
  allProfileGeographies,
  geographyDisplayLabel,
  hierarchyGeographies,
  isEconomicDevelopmentGeography,
  type GeographicScope,
  type GeographicScopeKind,
  type GeographyProfile,
  type GeographyReference,
} from "@/lib/geography/contracts";
import { getMarketSeedPack } from "@/lib/resources/market-seed-packs";
import { resolveCensusCoordinateProfile } from "./census-profile-resolver";

// postgres.js exposes root and transaction handles as distinct TS types. These
// helpers intentionally depend only on the tagged-template/json surface shared
// by both.
type QueryExecutor = any;
type CanonicalOverlay = GeographyReference & { canonicalId: string };
type SpatialOverlayRow = {
  id: string;
  geography_type: GeographyReference["type"];
  name: string;
  country_code: string;
  state_code: string | null;
  fips_code: string | null;
  geography_system: GeographyReference["source"];
  external_id: string | null;
  vintage: string | null;
  source_layer: string | null;
  is_economic_development_zone: boolean;
  metadata: Record<string, string | number | boolean | null>;
};

function jsonSafe(value: unknown) {
  return JSON.parse(JSON.stringify(value ?? {}));
}

function geometryPoint(latitude: number, longitude: number) {
  return { latitude, longitude };
}

function marketReference(marketKey?: string | null): GeographyReference | undefined {
  if (!marketKey) return undefined;
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

async function geographyByExternal(sql: QueryExecutor, ref: GeographyReference) {
  const externalId = ref.externalId ?? ref.geoid ?? ref.code;
  if (!externalId) return undefined;
  const rows = await sql<{ id: string }[]>`
    SELECT id::text
    FROM geographies
    WHERE geography_system = ${ref.source}
      AND geography_type = ${ref.type}
      AND external_id = ${externalId}
      AND vintage = ${ref.vintage ?? ""}
    LIMIT 1
  `;
  return rows[0]?.id;
}

export async function ensureGeography(sql: QueryExecutor, ref: GeographyReference) {
  const externalId = ref.externalId ?? ref.geoid ?? ref.code;
  const existingId = await geographyByExternal(sql, ref);
  if (existingId) {
    await sql`
      UPDATE geographies
      SET name = ${ref.name},
          country_code = ${ref.countryCode},
          state_code = ${ref.stateCode ?? null},
          fips_code = COALESCE(${ref.geoid ?? null}, fips_code),
          geography_level = ${ref.type},
          source_authority = ${ref.source},
          source_layer = ${ref.sourceLayer ?? null},
          is_economic_development_zone = ${ref.economicDevelopmentZone ?? isEconomicDevelopmentGeography(ref.type)},
          metadata = ${sql.json(jsonSafe(ref.metadata ?? {}))},
          updated_at = now()
      WHERE id = ${existingId}::uuid
    `;
    return existingId;
  }

  const rows = await sql<{ id: string }[]>`
    INSERT INTO geographies (
      country_code, state_code, fips_code, name, geography_type, geography_level,
      geography_system, external_id, vintage, source_authority, source_layer,
      is_economic_development_zone, metadata
    ) VALUES (
      ${ref.countryCode}, ${ref.stateCode ?? null}, ${ref.geoid ?? null}, ${ref.name}, ${ref.type}, ${ref.type},
      ${ref.source}, ${externalId ?? ref.key}, ${ref.vintage ?? ""}, ${ref.source}, ${ref.sourceLayer ?? null},
      ${ref.economicDevelopmentZone ?? isEconomicDevelopmentGeography(ref.type)}, ${sql.json(jsonSafe(ref.metadata ?? {}))}
    )
    RETURNING id::text
  `;
  const id = rows[0]?.id;
  if (!id) throw new Error(`Geography ${ref.name} could not be persisted.`);
  return id;
}

async function addRelationship(
  sql: QueryExecutor,
  parentId: string | undefined,
  childId: string | undefined,
  relationshipType: "contains" | "member_of" | "overlaps" | "market_member",
  hierarchyKey = "platform",
) {
  if (!parentId || !childId || parentId === childId) return;
  await sql`
    INSERT INTO geography_relationships (parent_geography_id, child_geography_id, relationship_type, hierarchy_key)
    VALUES (${parentId}::uuid, ${childId}::uuid, ${relationshipType}, ${hierarchyKey})
    ON CONFLICT DO NOTHING
  `;
}

export async function spatialOverlayGeographies(sql: QueryExecutor, latitude: number, longitude: number): Promise<CanonicalOverlay[]> {
  const rows = await sql`
    SELECT id::text, geography_type, name, country_code, state_code, fips_code,
           geography_system, external_id, vintage, source_layer,
           is_economic_development_zone, metadata
    FROM geographies
    WHERE boundary IS NOT NULL
      AND ST_Covers(boundary, ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326))
      AND geography_type IN (
        'region_market', 'planning_region', 'msa', 'csa', 'zip_zcta',
        'congressional_district', 'state_legislative_upper', 'state_legislative_lower',
        'school_district_unified', 'school_district_elementary', 'school_district_secondary',
        'urban_area', 'opportunity_zone', 'enterprise_zone', 'hubzone', 'foreign_trade_zone',
        'economic_development_district', 'redevelopment_zone', 'industrial_development_zone',
        'tax_increment_financing_zone', 'custom_economic_development_zone'
      )
  ` as SpatialOverlayRow[];
  return rows.map((row: SpatialOverlayRow): CanonicalOverlay => ({
    key: `${row.geography_system}:${row.geography_type}:${row.external_id ?? row.id}:${row.vintage ?? ""}`,
    type: row.geography_type,
    name: row.name,
    countryCode: row.country_code,
    ...(row.state_code ? { stateCode: row.state_code } : {}),
    ...(row.fips_code ? { geoid: row.fips_code } : {}),
    ...(row.external_id ? { externalId: row.external_id } : {}),
    source: row.geography_system,
    ...(row.source_layer ? { sourceLayer: row.source_layer } : {}),
    ...(row.vintage ? { vintage: row.vintage } : {}),
    economicDevelopmentZone: row.is_economic_development_zone,
    metadata: row.metadata ?? {},
    canonicalId: row.id,
  }));
}

export async function persistLocationGeographyProfile(
  locationId: string,
  profile: GeographyProfile,
  options: { market?: GeographyReference; sql?: QueryExecutor } = {},
) {
  const root = options.sql ?? getDatabase();
  const execute = async (sql: QueryExecutor) => {
    const overlays: CanonicalOverlay[] = profile.point
      ? await spatialOverlayGeographies(sql, profile.point.latitude, profile.point.longitude)
      : [];
    const market = options.market;
    const regionMarket = market ?? overlays.find((ref: CanonicalOverlay) => ref.type === "region_market");
    const parallel: GeographyReference[] = [
      ...profile.parallel,
      ...overlays.filter((ref: CanonicalOverlay) => ref.type !== "region_market"),
    ];
    const uniqueParallel = [...new Map(parallel.map((ref: GeographyReference) => [ref.key, ref])).values()];
    const enriched: GeographyProfile = {
      ...profile,
      hierarchy: { ...profile.hierarchy, ...(regionMarket ? { regionMarket } : {}) },
      parallel: uniqueParallel,
    };

    const canonicalByKey = new Map<string, string>();
    for (const ref of allProfileGeographies(enriched)) {
      const canonicalId = "canonicalId" in ref && typeof (ref as { canonicalId?: string }).canonicalId === "string"
        ? (ref as { canonicalId: string }).canonicalId
        : await ensureGeography(sql, ref);
      canonicalByKey.set(ref.key, canonicalId);
      const relationRole = ref.type === "region_market"
        ? "market"
        : ref.economicDevelopmentZone || isEconomicDevelopmentGeography(ref.type)
          ? "economic_zone"
          : hierarchyGeographies(enriched).some((item) => item.key === ref.key)
            ? "core"
            : "parallel";
      await sql`
        INSERT INTO location_geographies (location_id, geography_id, relation_role, derivation, source, confidence, updated_at)
        VALUES (${locationId}::uuid, ${canonicalId}::uuid, ${relationRole}, ${enriched.derivedFrom}, ${ref.source}, 1, now())
        ON CONFLICT (location_id, geography_id, relation_role) DO UPDATE SET
          derivation = EXCLUDED.derivation,
          source = EXCLUDED.source,
          confidence = EXCLUDED.confidence,
          updated_at = now()
      `;
    }

    const hierarchy = enriched.hierarchy;
    const chain = [
      hierarchy.country,
      hierarchy.state,
      hierarchy.countyEquivalent,
      hierarchy.censusTract,
      hierarchy.blockGroup,
      hierarchy.censusBlock,
    ].filter((item): item is GeographyReference => Boolean(item));
    for (let index = 1; index < chain.length; index += 1) {
      await addRelationship(sql, canonicalByKey.get(chain[index - 1].key), canonicalByKey.get(chain[index].key), "contains", "census-core");
    }
    if (hierarchy.place && hierarchy.state) {
      await addRelationship(sql, canonicalByKey.get(hierarchy.state.key), canonicalByKey.get(hierarchy.place.key), "contains", "place");
    }
    if (hierarchy.regionMarket) {
      const marketId = canonicalByKey.get(hierarchy.regionMarket.key);
      const memberId = hierarchy.countyEquivalent
        ? canonicalByKey.get(hierarchy.countyEquivalent.key)
        : hierarchy.place
          ? canonicalByKey.get(hierarchy.place.key)
          : undefined;
      await addRelationship(sql, marketId, memberId, "market_member", "market");
    }

    const primaryRef = hierarchy.countyEquivalent ?? hierarchy.place ?? hierarchy.regionMarket ?? hierarchy.state ?? hierarchy.country;
    const primaryId = primaryRef ? canonicalByKey.get(primaryRef.key) : undefined;
    if (primaryId) {
      await sql`UPDATE locations SET geography_id = ${primaryId}::uuid WHERE id = ${locationId}::uuid`;
    }
    await sql`
      INSERT INTO location_geography_profiles (location_id, profile, resolver, benchmark, vintage, derived_from, resolved_at, updated_at)
      VALUES (
        ${locationId}::uuid, ${sql.json(jsonSafe(enriched))}, ${enriched.resolver}, ${enriched.benchmark ?? null},
        ${enriched.vintage ?? null}, ${enriched.derivedFrom}, ${enriched.resolvedAt ? new Date(enriched.resolvedAt) : new Date()}, now()
      )
      ON CONFLICT (location_id) DO UPDATE SET
        profile = EXCLUDED.profile,
        resolver = EXCLUDED.resolver,
        benchmark = EXCLUDED.benchmark,
        vintage = EXCLUDED.vintage,
        derived_from = EXCLUDED.derived_from,
        resolved_at = EXCLUDED.resolved_at,
        updated_at = now()
    `;
    return enriched;
  };

  return options.sql ? execute(options.sql) : root.begin((tx: QueryExecutor) => execute(tx));
}

export async function getLocationGeographyProfile(locationId: string): Promise<GeographyProfile | undefined> {
  const sql = getDatabase();
  const rows = await sql<{ profile: GeographyProfile }[]>`
    SELECT profile FROM location_geography_profiles WHERE location_id = ${locationId}::uuid LIMIT 1
  `;
  return rows[0]?.profile;
}

function scopePoint(scope: GeographicScope) {
  return scope.point ?? scope.derivedProfile?.point;
}

export async function upsertExchangeRecordGeographicScope(input: {
  exchangeRecordId: string;
  scope: GeographicScope;
  sql?: QueryExecutor;
}) {
  const root = input.sql ?? getDatabase();
  const execute = async (sql: QueryExecutor) => {
    const point = scopePoint(input.scope);
    const rows = point
      ? await sql<{ id: string }[]>`
          INSERT INTO geographic_scopes (
            exchange_record_id, scope_kind, scope_mode, label, source_location_id, address,
            center_point, radius_meters, metadata, updated_at
          ) VALUES (
            ${input.exchangeRecordId}::uuid, ${input.scope.kind}, ${input.scope.mode}, ${input.scope.label ?? null},
            ${input.scope.sourceLocationId ?? null}::uuid, ${sql.json(jsonSafe(input.scope.address ?? {}))},
            ST_SetSRID(ST_MakePoint(${point.longitude}, ${point.latitude}), 4326)::geography,
            ${input.scope.radiusMeters ?? null}, ${sql.json(jsonSafe({ derivedProfile: input.scope.derivedProfile }))}, now()
          )
          ON CONFLICT (exchange_record_id, scope_kind) WHERE exchange_record_id IS NOT NULL DO UPDATE SET
            scope_mode = EXCLUDED.scope_mode, label = EXCLUDED.label, source_location_id = EXCLUDED.source_location_id,
            address = EXCLUDED.address, center_point = EXCLUDED.center_point, radius_meters = EXCLUDED.radius_meters,
            metadata = EXCLUDED.metadata, updated_at = now()
          RETURNING id::text
        `
      : await sql<{ id: string }[]>`
          INSERT INTO geographic_scopes (
            exchange_record_id, scope_kind, scope_mode, label, source_location_id, address,
            radius_meters, metadata, updated_at
          ) VALUES (
            ${input.exchangeRecordId}::uuid, ${input.scope.kind}, ${input.scope.mode}, ${input.scope.label ?? null},
            ${input.scope.sourceLocationId ?? null}::uuid, ${sql.json(jsonSafe(input.scope.address ?? {}))},
            ${input.scope.radiusMeters ?? null}, ${sql.json(jsonSafe({ derivedProfile: input.scope.derivedProfile }))}, now()
          )
          ON CONFLICT (exchange_record_id, scope_kind) WHERE exchange_record_id IS NOT NULL DO UPDATE SET
            scope_mode = EXCLUDED.scope_mode, label = EXCLUDED.label, source_location_id = EXCLUDED.source_location_id,
            address = EXCLUDED.address, center_point = NULL, radius_meters = EXCLUDED.radius_meters,
            metadata = EXCLUDED.metadata, updated_at = now()
          RETURNING id::text
        `;
    const scopeId = rows[0]?.id;
    if (!scopeId) throw new Error("Exchange geographic scope could not be persisted.");
    await sql`DELETE FROM geographic_scope_geographies WHERE scope_id = ${scopeId}::uuid`;
    const refs = [
      ...(input.scope.geographies ?? []),
      ...allProfileGeographies(input.scope.derivedProfile),
    ];
    const uniqueRefs = [...new Map(refs.map((ref) => [ref.key, ref])).values()];
    for (const ref of uniqueRefs) {
      const geographyId = await ensureGeography(sql, ref);
      await sql`
        INSERT INTO geographic_scope_geographies (scope_id, geography_id, inclusion)
        VALUES (${scopeId}::uuid, ${geographyId}::uuid, 'include')
        ON CONFLICT DO NOTHING
      `;
    }
    return scopeId;
  };
  return input.sql ? execute(input.sql) : root.begin((tx: QueryExecutor) => execute(tx));
}

export async function upsertOrganizationGeographicScope(input: {
  organizationId: string;
  scope: GeographicScope;
  sql?: QueryExecutor;
}) {
  const root = input.sql ?? getDatabase();
  const execute = async (sql: QueryExecutor) => {
    const point = scopePoint(input.scope);
    const rows = point
      ? await sql<{ id: string }[]>`
          INSERT INTO geographic_scopes (organization_id, scope_kind, scope_mode, label, source_location_id, address, center_point, radius_meters, metadata, updated_at)
          VALUES (
            ${input.organizationId}::uuid, ${input.scope.kind}, ${input.scope.mode}, ${input.scope.label ?? null}, ${input.scope.sourceLocationId ?? null}::uuid,
            ${sql.json(jsonSafe(input.scope.address ?? {}))}, ST_SetSRID(ST_MakePoint(${point.longitude}, ${point.latitude}), 4326)::geography,
            ${input.scope.radiusMeters ?? null}, ${sql.json(jsonSafe({ derivedProfile: input.scope.derivedProfile }))}, now()
          )
          ON CONFLICT (organization_id, scope_kind) WHERE organization_id IS NOT NULL DO UPDATE SET
            scope_mode = EXCLUDED.scope_mode, label = EXCLUDED.label, source_location_id = EXCLUDED.source_location_id,
            address = EXCLUDED.address, center_point = EXCLUDED.center_point, radius_meters = EXCLUDED.radius_meters,
            metadata = EXCLUDED.metadata, updated_at = now()
          RETURNING id::text
        `
      : await sql<{ id: string }[]>`
          INSERT INTO geographic_scopes (organization_id, scope_kind, scope_mode, label, source_location_id, address, radius_meters, metadata, updated_at)
          VALUES (
            ${input.organizationId}::uuid, ${input.scope.kind}, ${input.scope.mode}, ${input.scope.label ?? null}, ${input.scope.sourceLocationId ?? null}::uuid,
            ${sql.json(jsonSafe(input.scope.address ?? {}))}, ${input.scope.radiusMeters ?? null}, ${sql.json(jsonSafe({ derivedProfile: input.scope.derivedProfile }))}, now()
          )
          ON CONFLICT (organization_id, scope_kind) WHERE organization_id IS NOT NULL DO UPDATE SET
            scope_mode = EXCLUDED.scope_mode, label = EXCLUDED.label, source_location_id = EXCLUDED.source_location_id,
            address = EXCLUDED.address, center_point = NULL, radius_meters = EXCLUDED.radius_meters,
            metadata = EXCLUDED.metadata, updated_at = now()
          RETURNING id::text
        `;
    const scopeId = rows[0]?.id;
    if (!scopeId) throw new Error("Organization geographic scope could not be persisted.");
    await sql`DELETE FROM geographic_scope_geographies WHERE scope_id = ${scopeId}::uuid`;
    const refs = [...(input.scope.geographies ?? []), ...allProfileGeographies(input.scope.derivedProfile)];
    const uniqueRefs = [...new Map(refs.map((ref) => [ref.key, ref])).values()];
    for (const ref of uniqueRefs) {
      const geographyId = await ensureGeography(sql, ref);
      await sql`
        INSERT INTO geographic_scope_geographies (scope_id, geography_id, inclusion)
        VALUES (${scopeId}::uuid, ${geographyId}::uuid, 'include')
        ON CONFLICT DO NOTHING
      `;
    }
    return scopeId;
  };
  return input.sql ? execute(input.sql) : root.begin((tx: QueryExecutor) => execute(tx));
}

export async function getExchangeRecordGeographicScopes(exchangeRecordId: string): Promise<GeographicScope[]> {
  const sql = getDatabase();
  const rows = await sql<{
    scope_kind: GeographicScopeKind;
    scope_mode: GeographicScope["mode"];
    label: string | null;
    address: GeographicScope["address"] | null;
    source_location_id: string | null;
    latitude: number | null;
    longitude: number | null;
    radius_meters: number | string | null;
    metadata: { derivedProfile?: GeographyProfile };
  }[]>`
    SELECT scope_kind, scope_mode, label, address, source_location_id::text,
           CASE WHEN center_point IS NULL THEN NULL ELSE ST_Y(center_point::geometry) END AS latitude,
           CASE WHEN center_point IS NULL THEN NULL ELSE ST_X(center_point::geometry) END AS longitude,
           radius_meters, metadata
    FROM geographic_scopes
    WHERE exchange_record_id = ${exchangeRecordId}::uuid
    ORDER BY scope_kind
  `;
  return rows.map((row) => ({
    kind: row.scope_kind,
    mode: row.scope_mode,
    ...(row.label ? { label: row.label } : {}),
    ...(row.address ? { address: row.address } : {}),
    ...(row.source_location_id ? { sourceLocationId: row.source_location_id } : {}),
    ...(row.latitude !== null && row.longitude !== null ? { point: geometryPoint(Number(row.latitude), Number(row.longitude)) } : {}),
    ...(row.radius_meters !== null ? { radiusMeters: Number(row.radius_meters) } : {}),
    ...(row.metadata?.derivedProfile ? { derivedProfile: row.metadata.derivedProfile } : {}),
  }));
}

export async function backfillLocationGeographies(input: { limit?: number; marketKey?: string }) {
  const sql = getDatabase();
  const limit = Math.max(1, Math.min(100, input.limit ?? 25));
  const rows = await sql<{
    id: string;
    latitude: number;
    longitude: number;
    organization_id: string | null;
    market_key: string | null;
  }[]>`
    SELECT l.id::text,
           ST_Y(l.point::geometry) AS latitude,
           ST_X(l.point::geometry) AS longitude,
           l.organization_id::text,
           rp.market_key
    FROM locations l
    LEFT JOIN resource_provider_profiles rp ON rp.organization_id = l.organization_id
    LEFT JOIN location_geography_profiles gp ON gp.location_id = l.id
    WHERE l.point IS NOT NULL
      AND gp.location_id IS NULL
      AND (${input.marketKey ?? ""} = '' OR rp.market_key = ${input.marketKey ?? ""})
    ORDER BY l.created_at ASC
    LIMIT ${limit}
  `;
  const results: Array<{ locationId: string; status: "resolved" | "failed"; label?: string; error?: string }> = [];
  for (const row of rows) {
    try {
      const profile = await resolveCensusCoordinateProfile({ latitude: Number(row.latitude), longitude: Number(row.longitude) });
      const enriched = await persistLocationGeographyProfile(row.id, profile, { market: marketReference(row.market_key) });
      results.push({ locationId: row.id, status: "resolved", label: geographyDisplayLabel(enriched) });
    } catch (error) {
      results.push({ locationId: row.id, status: "failed", error: error instanceof Error ? error.message : "Geography resolution failed." });
    }
  }
  return { requested: limit, processed: rows.length, resolved: results.filter((item) => item.status === "resolved").length, results };
}
