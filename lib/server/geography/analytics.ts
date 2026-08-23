import "server-only";

import { getDatabase } from "@/lib/server/database";
import type { ExchangeRecordType } from "@/lib/exchange/contracts";
import type { PlatformGeographyType } from "@/lib/geography/contracts";

export async function geographyAnalytics(input: {
  geographyType?: PlatformGeographyType;
  recordType?: ExchangeRecordType;
  economicDevelopmentOnly?: boolean;
  includeOrganizations?: boolean;
}) {
  const sql = getDatabase();
  const recordRows = await sql<{
    geography_id: string;
    name: string;
    geography_type: PlatformGeographyType;
    state_code: string | null;
    external_id: string | null;
    fips_code: string | null;
    economic: boolean;
    record_count: number | string;
    organization_count: number | string;
  }[]>`
    SELECT
      g.id::text AS geography_id,
      g.name,
      g.geography_type,
      g.state_code,
      g.external_id,
      g.fips_code,
      g.is_economic_development_zone AS economic,
      COUNT(DISTINCT er.id)::int AS record_count,
      COUNT(DISTINCT er.organization_id)::int AS organization_count
    FROM exchange_record_geography_rollup rollup
    JOIN geographies g ON g.id = rollup.geography_id
    JOIN exchange_records er ON er.id = rollup.exchange_record_id
    WHERE (${input.geographyType ?? ""} = '' OR g.geography_type = ${input.geographyType ?? ""})
      AND (${input.recordType ?? ""} = '' OR er.record_type = ${input.recordType ?? ""})
      AND (${Boolean(input.economicDevelopmentOnly)} = false OR g.is_economic_development_zone = true)
    GROUP BY g.id, g.name, g.geography_type, g.state_code, g.external_id, g.fips_code, g.is_economic_development_zone
    ORDER BY record_count DESC, g.name ASC
  `;

  let organizationRows: Array<{
    geography_id: string;
    organization_count: number;
  }> = [];
  if (input.includeOrganizations) {
    const rows = await sql<{ geography_id: string; organization_count: number | string }[]>`
      SELECT lg.geography_id::text, COUNT(DISTINCT l.organization_id)::int AS organization_count
      FROM location_geographies lg
      JOIN locations l ON l.id = lg.location_id
      JOIN geographies g ON g.id = lg.geography_id
      WHERE l.organization_id IS NOT NULL
        AND (${input.geographyType ?? ""} = '' OR g.geography_type = ${input.geographyType ?? ""})
        AND (${Boolean(input.economicDevelopmentOnly)} = false OR g.is_economic_development_zone = true)
      GROUP BY lg.geography_id
    `;
    organizationRows = rows.map((row) => ({ geography_id: row.geography_id, organization_count: Number(row.organization_count) }));
  }
  const organizationByGeography = new Map(organizationRows.map((row) => [row.geography_id, row.organization_count]));

  return recordRows.map((row) => ({
    geographyId: row.geography_id,
    geographyType: row.geography_type,
    name: row.name,
    stateCode: row.state_code ?? undefined,
    externalId: row.external_id ?? row.fips_code ?? undefined,
    economicDevelopmentZone: row.economic,
    recordCount: Number(row.record_count),
    exchangeOrganizationCount: Number(row.organization_count),
    locationOrganizationCount: organizationByGeography.get(row.geography_id) ?? undefined,
  }));
}
