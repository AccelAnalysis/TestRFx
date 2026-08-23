import "server-only";

import { getDatabase } from "@/lib/server/database";
import type { ExchangeRecord } from "@/lib/exchange/contracts";
import { geographyDisplayLabel, type GeographicScope, type GeographyProfile } from "@/lib/geography/contracts";

export async function enrichExchangeRecordsWithGeography(records: ExchangeRecord[]): Promise<ExchangeRecord[]> {
  if (!records.length) return records;
  const publicIds = [...new Set(records.map((record) => record.id))];
  const sql = getDatabase();
  const rows = await sql<{
    public_id: string;
    geography_profile: GeographyProfile | null;
    scopes: GeographicScope[] | null;
  }[]>`
    SELECT
      er.public_id,
      lgp.profile AS geography_profile,
      COALESCE(scopes.items, '[]'::jsonb) AS scopes
    FROM exchange_records er
    LEFT JOIN location_geography_profiles lgp ON lgp.location_id = er.location_id
    LEFT JOIN LATERAL (
      SELECT jsonb_agg(
        jsonb_strip_nulls(jsonb_build_object(
          'kind', gs.scope_kind,
          'mode', gs.scope_mode,
          'label', gs.label,
          'sourceLocationId', gs.source_location_id::text,
          'address', CASE WHEN gs.address = '{}'::jsonb THEN NULL ELSE gs.address END,
          'point', CASE WHEN gs.center_point IS NULL THEN NULL ELSE jsonb_build_object(
            'latitude', ST_Y(gs.center_point::geometry),
            'longitude', ST_X(gs.center_point::geometry)
          ) END,
          'radiusMeters', gs.radius_meters,
          'derivedProfile', gs.metadata->'derivedProfile'
        )) ORDER BY gs.scope_kind
      ) AS items
      FROM geographic_scopes gs
      WHERE gs.exchange_record_id = er.id
    ) scopes ON true
    WHERE er.public_id IN ${sql(publicIds)}
  `;
  const byId = new Map(rows.map((row) => [row.public_id, row]));
  return records.map((record) => {
    const row = byId.get(record.id);
    if (!row) return record;
    const profile = row.geography_profile ?? undefined;
    return {
      ...record,
      geography: geographyDisplayLabel(profile, record.geography),
      ...(profile ? { geographyProfile: profile } : {}),
      ...(row.scopes?.length ? { geographicScopes: row.scopes } : {}),
    };
  });
}
