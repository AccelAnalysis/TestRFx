import "server-only";

import { getDatabase } from "@/lib/server/database";
import type { PlatformGeographyType } from "@/lib/geography/contracts";

export async function searchCanonicalGeographies(input: {
  query?: string;
  type?: PlatformGeographyType;
  stateCode?: string;
  economicDevelopmentOnly?: boolean;
  limit?: number;
}) {
  const sql = getDatabase();
  const query = input.query?.trim().toLowerCase() ?? "";
  const like = `%${query}%`;
  const state = input.stateCode?.trim().toUpperCase() ?? "";
  const limit = Math.max(1, Math.min(100, input.limit ?? 30));
  const rows = await sql<{
    id: string;
    name: string;
    geography_type: PlatformGeographyType;
    country_code: string;
    state_code: string | null;
    fips_code: string | null;
    external_id: string | null;
    geography_system: string;
    vintage: string | null;
    is_economic_development_zone: boolean;
  }[]>`
    SELECT id::text, name, geography_type, country_code, state_code, fips_code,
           external_id, geography_system, vintage, is_economic_development_zone
    FROM geographies
    WHERE (${query} = '' OR lower(name) LIKE ${like} OR lower(COALESCE(external_id, '')) LIKE ${like} OR lower(COALESCE(fips_code, '')) LIKE ${like})
      AND (${input.type ?? ""} = '' OR geography_type = ${input.type ?? ""})
      AND (${state} = '' OR state_code = ${state})
      AND (${Boolean(input.economicDevelopmentOnly)} = false OR is_economic_development_zone = true)
    ORDER BY
      CASE WHEN ${query} <> '' AND lower(name) = ${query} THEN 0 ELSE 1 END,
      geography_type,
      name
    LIMIT ${limit}
  `;
  return rows.map((row) => ({
    id: row.id,
    key: `canonical:${row.id}`,
    name: row.name,
    type: row.geography_type,
    countryCode: row.country_code,
    stateCode: row.state_code ?? undefined,
    geoid: row.fips_code ?? undefined,
    externalId: row.external_id ?? undefined,
    system: row.geography_system,
    vintage: row.vintage ?? undefined,
    economicDevelopmentZone: row.is_economic_development_zone,
  }));
}
