import "server-only";

import { getDatabase } from "@/lib/server/database";
import { isEconomicDevelopmentGeography, type GeographyReference, type PlatformGeographyType } from "@/lib/geography/contracts";

export class GeographyIngestionError extends Error {
  constructor(message: string, public readonly status = 400, public readonly code = "geography_ingestion_error") {
    super(message);
    this.name = "GeographyIngestionError";
  }
}

export interface GeographyBoundarySource {
  key: string;
  name: string;
  authority: string;
  sourceUrl?: string;
  licenseOrUseBasis: string;
  vintage?: string;
}

export interface GeographyBoundaryFeature {
  type: PlatformGeographyType;
  name: string;
  externalId: string;
  countryCode?: string;
  stateCode?: string;
  geoid?: string;
  code?: string;
  parentExternalId?: string;
  parentType?: PlatformGeographyType;
  economicDevelopmentZone?: boolean;
  geometry: { type: "Polygon" | "MultiPolygon"; coordinates: unknown };
  metadata?: Record<string, string | number | boolean | null>;
}

type QueryExecutor = any;

function clean(value: unknown, max = 400) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function jsonSafe(value: unknown) {
  return JSON.parse(JSON.stringify(value ?? {}));
}

async function upsertSource(sql: QueryExecutor, source: GeographyBoundarySource) {
  await sql`
    INSERT INTO geography_dataset_sources (source_key, name, authority, source_url, license_or_use_basis, vintage, updated_at)
    VALUES (${source.key}, ${source.name}, ${source.authority}, ${source.sourceUrl ?? null}, ${source.licenseOrUseBasis}, ${source.vintage ?? ""}, now())
    ON CONFLICT (source_key) DO UPDATE SET
      name = EXCLUDED.name,
      authority = EXCLUDED.authority,
      source_url = EXCLUDED.source_url,
      license_or_use_basis = EXCLUDED.license_or_use_basis,
      vintage = EXCLUDED.vintage,
      updated_at = now()
  `;
}

async function findExisting(sql: QueryExecutor, sourceKey: string, feature: GeographyBoundaryFeature, vintage: string) {
  const rows = await sql<{ id: string }[]>`
    SELECT id::text
    FROM geographies
    WHERE geography_system = ${sourceKey}
      AND geography_type = ${feature.type}
      AND external_id = ${feature.externalId}
      AND vintage = ${vintage}
    LIMIT 1
  `;
  return rows[0]?.id;
}

async function upsertFeature(sql: QueryExecutor, source: GeographyBoundarySource, feature: GeographyBoundaryFeature) {
  const vintage = source.vintage ?? "";
  const existing = await findExisting(sql, source.key, feature, vintage);
  const geometry = JSON.stringify(feature.geometry);
  if (existing) {
    await sql`
      UPDATE geographies
      SET country_code = ${feature.countryCode ?? "US"},
          state_code = ${feature.stateCode ?? null},
          fips_code = COALESCE(${feature.geoid ?? null}, fips_code),
          name = ${feature.name},
          geography_level = ${feature.type},
          source_authority = ${source.authority},
          source_layer = ${source.key},
          is_economic_development_zone = ${feature.economicDevelopmentZone ?? isEconomicDevelopmentGeography(feature.type)},
          boundary = ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(${geometry}), 4326)),
          centroid = ST_PointOnSurface(ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(${geometry}), 4326)))::geography,
          boundary_source = ${source.name},
          boundary_version = ${vintage},
          metadata = ${sql.json(jsonSafe(feature.metadata ?? {}))},
          updated_at = now()
      WHERE id = ${existing}::uuid
    `;
    return existing;
  }
  const rows = await sql<{ id: string }[]>`
    INSERT INTO geographies (
      country_code, state_code, fips_code, name, geography_type, geography_level,
      geography_system, external_id, vintage, source_authority, source_layer,
      is_economic_development_zone, boundary, centroid, boundary_source, boundary_version, metadata
    ) VALUES (
      ${feature.countryCode ?? "US"}, ${feature.stateCode ?? null}, ${feature.geoid ?? null}, ${feature.name}, ${feature.type}, ${feature.type},
      ${source.key}, ${feature.externalId}, ${vintage}, ${source.authority}, ${source.key},
      ${feature.economicDevelopmentZone ?? isEconomicDevelopmentGeography(feature.type)},
      ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(${geometry}), 4326)),
      ST_PointOnSurface(ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(${geometry}), 4326)))::geography,
      ${source.name}, ${vintage}, ${sql.json(jsonSafe(feature.metadata ?? {}))}
    )
    RETURNING id::text
  `;
  const id = rows[0]?.id;
  if (!id) throw new GeographyIngestionError(`Geography ${feature.name} could not be persisted.`, 500, "geography_unavailable");
  return id;
}

function validateFeature(value: unknown): GeographyBoundaryFeature {
  if (!value || typeof value !== "object") throw new GeographyIngestionError("Each geography feature must be an object.");
  const row = value as Record<string, unknown>;
  const type = clean(row.type, 80) as PlatformGeographyType;
  const name = clean(row.name, 240);
  const externalId = clean(row.externalId, 180);
  const geometry = row.geometry as GeographyBoundaryFeature["geometry"] | undefined;
  if (!type || !name || !externalId || !geometry || (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon") || !Array.isArray(geometry.coordinates)) {
    throw new GeographyIngestionError("Geography features require type, name, externalId, and Polygon/MultiPolygon geometry.");
  }
  return {
    type,
    name,
    externalId,
    countryCode: clean(row.countryCode, 2) || "US",
    stateCode: clean(row.stateCode, 2).toUpperCase() || undefined,
    geoid: clean(row.geoid, 30) || undefined,
    code: clean(row.code, 80) || undefined,
    parentExternalId: clean(row.parentExternalId, 180) || undefined,
    parentType: clean(row.parentType, 80) as PlatformGeographyType || undefined,
    economicDevelopmentZone: row.economicDevelopmentZone === true,
    geometry,
    metadata: row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? row.metadata as Record<string, string | number | boolean | null>
      : undefined,
  };
}

export async function ingestGeographyBoundaries(input: { source: GeographyBoundarySource; features: unknown[] }) {
  const source = {
    key: clean(input.source.key, 120),
    name: clean(input.source.name, 240),
    authority: clean(input.source.authority, 240),
    sourceUrl: clean(input.source.sourceUrl, 600) || undefined,
    licenseOrUseBasis: clean(input.source.licenseOrUseBasis, 600),
    vintage: clean(input.source.vintage, 80) || undefined,
  } satisfies GeographyBoundarySource;
  if (!source.key || !source.name || !source.authority || !source.licenseOrUseBasis) {
    throw new GeographyIngestionError("A source key, name, authority, and license/use basis are required.");
  }
  if (!input.features.length) throw new GeographyIngestionError("At least one geography boundary is required.");
  if (input.features.length > 250) throw new GeographyIngestionError("A geography boundary batch may contain at most 250 features.", 413, "batch_too_large");
  const features = input.features.map(validateFeature);
  const sql = getDatabase();
  return sql.begin(async (tx) => {
    await upsertSource(tx, source);
    const ids = new Map<string, string>();
    for (const feature of features) {
      ids.set(`${feature.type}:${feature.externalId}`, await upsertFeature(tx, source, feature));
    }
    for (const feature of features) {
      if (!feature.parentExternalId || !feature.parentType) continue;
      const child = ids.get(`${feature.type}:${feature.externalId}`);
      const parent = ids.get(`${feature.parentType}:${feature.parentExternalId}`) ?? (await tx<{ id: string }[]>`
        SELECT id::text FROM geographies
        WHERE geography_type = ${feature.parentType}
          AND external_id = ${feature.parentExternalId}
        ORDER BY updated_at DESC
        LIMIT 1
      `)[0]?.id;
      if (parent && child) {
        await tx`
          INSERT INTO geography_relationships (parent_geography_id, child_geography_id, relationship_type, hierarchy_key)
          VALUES (${parent}::uuid, ${child}::uuid, 'contains', ${source.key})
          ON CONFLICT DO NOTHING
        `;
      }
    }
    return {
      source: source.key,
      vintage: source.vintage ?? "",
      accepted: features.length,
      economicDevelopmentZones: features.filter((feature) => feature.economicDevelopmentZone || isEconomicDevelopmentGeography(feature.type)).length,
    };
  });
}

export function referenceFromBoundaryFeature(source: GeographyBoundarySource, feature: GeographyBoundaryFeature): GeographyReference {
  return {
    key: `${source.key}:${feature.type}:${feature.externalId}:${source.vintage ?? ""}`,
    type: feature.type,
    name: feature.name,
    countryCode: feature.countryCode ?? "US",
    stateCode: feature.stateCode,
    geoid: feature.geoid,
    externalId: feature.externalId,
    code: feature.code,
    source: source.authority === "US Census Bureau" ? "census_tigerweb" : "local_program",
    sourceLayer: source.key,
    vintage: source.vintage,
    economicDevelopmentZone: feature.economicDevelopmentZone ?? isEconomicDevelopmentGeography(feature.type),
    metadata: feature.metadata,
  };
}
