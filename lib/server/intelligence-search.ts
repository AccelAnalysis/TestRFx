import "server-only";
import type { ExchangeRecord } from "@/lib/exchange/contracts";
import type { IntelligenceListResponse } from "@/lib/exchange/intelligence";
import { getDatabase } from "./database";
import type { ExchangeActor } from "./exchange-session";

export type IntelligenceDiscoveryLocation = "all" | "mapped" | "off-map";
export type IntelligenceDiscoveryOwnership = "all" | "mine" | "others";
export type IntelligenceDiscoverySort = "relevance" | "title" | "organization" | "geography";

export interface IntelligenceDiscoveryOptions {
  query?: string;
  geography?: string;
  location?: IntelligenceDiscoveryLocation;
  ownership?: IntelligenceDiscoveryOwnership;
  tags?: string[];
  trackedOnly?: boolean;
  sort?: IntelligenceDiscoverySort;
  offset?: number;
  limit?: number;
}

type Row = Record<string, unknown>;

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : value == null ? fallback : String(value);
}

function optionalString(value: unknown) {
  const text = asString(value).trim();
  return text || undefined;
}

function iso(value: unknown) {
  if (!value) return undefined;
  if (value instanceof Date) return value.toISOString();
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function metadata(row: Row) {
  const values: string[] = [];
  const signal = optionalString(row.signal_type);
  const observedFrom = iso(row.observed_from);
  const observedTo = iso(row.observed_to);
  const source = optionalString(row.source_label);
  if (signal) values.push(signal);
  if (observedFrom || observedTo) values.push([observedFrom?.slice(0, 10), observedTo?.slice(0, 10)].filter(Boolean).join(" → "));
  if (Boolean(row.owned_by_viewer)) values.push("Owned by you");
  if (source) values.push(`Source: ${source}`);
  if (row.latitude == null || row.longitude == null) values.push("Off-map record");
  return values;
}

function toRecord(row: Row): ExchangeRecord {
  const latitude = row.latitude == null ? undefined : Number(row.latitude);
  const longitude = row.longitude == null ? undefined : Number(row.longitude);
  const signalType = optionalString(row.signal_type) ?? "Intelligence";
  const tracking = optionalString(row.tracking_mode);
  return {
    id: asString(row.public_id),
    type: "intelligence",
    title: asString(row.title),
    organization: asString(row.organization_name),
    summary: asString(row.summary),
    geography: optionalString(row.geography) ?? "No public location",
    metadata: metadata(row),
    location: latitude != null && longitude != null ? { lat: latitude, lng: longitude } : undefined,
    ownedByViewer: Boolean(row.owned_by_viewer),
    saved: Boolean(tracking),
    card: {
      eyebrow: signalType,
      media: { kind: "visualization", label: "Intelligence" },
      classifications: [signalType],
      status: { label: tracking ? "Tracking" : "Current", tone: tracking ? "success" : "info" },
      relationships: tracking ? ["following"] : Boolean(row.owned_by_viewer) ? ["owned"] : undefined,
    },
  };
}

export async function searchIntelligence(actor: ExchangeActor, options: IntelligenceDiscoveryOptions = {}): Promise<IntelligenceListResponse> {
  const sql = getDatabase();
  const query = options.query?.trim() ?? "";
  const geography = options.geography?.trim() ?? "";
  const location = options.location ?? "all";
  const ownership = options.ownership ?? "all";
  const tags = [...new Set((options.tags ?? []).map((tag) => tag.trim()).filter(Boolean))].slice(0, 12);
  const trackedOnly = Boolean(options.trackedOnly);
  const sort = options.sort ?? "relevance";
  const offset = Math.max(0, Number(options.offset ?? 0));
  const limit = Math.max(1, Math.min(50, Number(options.limit ?? 24)));
  const like = `%${query}%`;
  const geographyLike = `%${geography}%`;

  const queryCondition = query
    ? sql`AND (
        er.search_document @@ plainto_tsquery('english', ${query})
        OR o.name ILIKE ${like}
        OR COALESCE(er.metadata->>'geography', l.label, '') ILIKE ${like}
        OR COALESCE(ir.signal_type, '') ILIKE ${like}
      )`
    : sql``;
  const geographyCondition = geography ? sql`AND COALESCE(er.metadata->>'geography', l.label, '') ILIKE ${geographyLike}` : sql``;
  const locationCondition = location === "mapped" ? sql`AND l.point IS NOT NULL` : location === "off-map" ? sql`AND l.point IS NULL` : sql``;
  const ownershipCondition = ownership === "mine" ? sql`AND er.organization_id = ${actor.organizationId}::uuid` : ownership === "others" ? sql`AND er.organization_id <> ${actor.organizationId}::uuid` : sql``;
  const trackingCondition = trackedOnly ? sql`AND tracking.tracking_mode IS NOT NULL` : sql``;
  let tagCondition = sql``;
  for (const tag of tags) {
    const tagLike = `%${tag}%`;
    tagCondition = sql`${tagCondition} AND (
      er.metadata::text ILIKE ${tagLike}
      OR COALESCE(ir.signal_type, '') ILIKE ${tagLike}
      OR COALESCE(source.source_label, '') ILIKE ${tagLike}
    )`;
  }

  const order = sort === "title"
    ? sql`er.title ASC, er.updated_at DESC`
    : sort === "organization"
      ? sql`o.name ASC, er.title ASC`
      : sort === "geography"
        ? sql`COALESCE(er.metadata->>'geography', l.label, '') ASC, er.title ASC`
        : query
          ? sql`ts_rank_cd(er.search_document, plainto_tsquery('english', ${query})) DESC, er.updated_at DESC`
          : sql`er.updated_at DESC, er.public_id ASC`;

  const rows = await sql`
    SELECT
      er.public_id,
      er.title,
      er.summary,
      o.name AS organization_name,
      COALESCE(er.metadata->>'geography', l.label, '') AS geography,
      CASE WHEN l.point IS NULL THEN NULL ELSE ST_Y(l.point::geometry) END AS latitude,
      CASE WHEN l.point IS NULL THEN NULL ELSE ST_X(l.point::geometry) END AS longitude,
      er.organization_id = ${actor.organizationId}::uuid AS owned_by_viewer,
      ir.signal_type,
      ir.observed_from,
      ir.observed_to,
      source.source_label,
      tracking.tracking_mode
    FROM exchange_records er
    JOIN intelligence_records ir ON ir.exchange_record_id = er.id
    JOIN organizations o ON o.id = er.organization_id
    LEFT JOIN locations l ON l.id = er.location_id
    LEFT JOIN LATERAL (
      SELECT source_label
      FROM intelligence_sources src
      WHERE src.intelligence_record_id = ir.id
      ORDER BY src.created_at DESC
      LIMIT 1
    ) source ON true
    LEFT JOIN intelligence_tracking tracking
      ON tracking.intelligence_record_id = ir.id
     AND tracking.user_id = ${actor.userId}::uuid
    WHERE er.record_type = 'intelligence'
      AND er.status = 'active'
      ${queryCondition}
      ${geographyCondition}
      ${locationCondition}
      ${ownershipCondition}
      ${trackingCondition}
      ${tagCondition}
    ORDER BY ${order}
    LIMIT ${limit} OFFSET ${offset}
  `;

  const countRows = await sql`
    SELECT
      count(*)::int AS total,
      count(*) FILTER (WHERE l.point IS NOT NULL)::int AS mapped
    FROM exchange_records er
    JOIN intelligence_records ir ON ir.exchange_record_id = er.id
    JOIN organizations o ON o.id = er.organization_id
    LEFT JOIN locations l ON l.id = er.location_id
    LEFT JOIN LATERAL (
      SELECT source_label
      FROM intelligence_sources src
      WHERE src.intelligence_record_id = ir.id
      ORDER BY src.created_at DESC
      LIMIT 1
    ) source ON true
    LEFT JOIN intelligence_tracking tracking
      ON tracking.intelligence_record_id = ir.id
     AND tracking.user_id = ${actor.userId}::uuid
    WHERE er.record_type = 'intelligence'
      AND er.status = 'active'
      ${queryCondition}
      ${geographyCondition}
      ${locationCondition}
      ${ownershipCondition}
      ${trackingCondition}
      ${tagCondition}
  `;

  const count = countRows[0] as Row | undefined;
  const total = Number(count?.total ?? 0);
  const mapped = Number(count?.mapped ?? 0);
  return {
    records: rows.map((row) => toRecord(row as Row)),
    total,
    mapped,
    offMap: total - mapped,
    offset,
    limit,
    nextOffset: offset + rows.length < total ? offset + rows.length : undefined,
  };
}
