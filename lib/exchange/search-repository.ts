import type { QueryResultRow } from "pg";
import type {
  ExchangeCardProjection,
  ExchangeLens,
  ExchangeRecord,
  ExchangeRecordType,
  ExchangeSearchResponse,
  ExchangeSearchState,
} from "./contracts";
import { getPostgresPool } from "@/lib/server/postgres";
import { getSearchSuggestions } from "./search";

export interface SearchPrincipal {
  userId?: string;
  organizationId?: string;
}

interface SearchRow extends QueryResultRow {
  id: string;
  record_type: ExchangeRecordType;
  organization_id: string;
  organization: string;
  title: string;
  summary: string;
  geography: string | null;
  metadata: unknown;
  lat: number | null;
  lng: number | null;
  owned_by_viewer: boolean;
  saved_by_viewer: boolean;
  sponsored: boolean;
  sponsor_label: string | null;
  search_score: number;
  total_count: string | number;
  mapped_count: string | number;
  updated_at: string | Date;
}

function encodeCursor(offset: number) {
  return Buffer.from(JSON.stringify({ offset }), "utf8").toString("base64url");
}

function decodeCursor(cursor?: string) {
  if (!cursor) return 0;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as { offset?: unknown };
    return typeof parsed.offset === "number" && Number.isInteger(parsed.offset) && parsed.offset >= 0 ? parsed.offset : 0;
  } catch {
    return 0;
  }
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function toCardProjection(metadata: Record<string, unknown>, row: SearchRow): ExchangeCardProjection | undefined {
  const source = objectValue(metadata.card);
  const classifications = stringArray(source.classifications ?? metadata.classifications);
  const relationships = stringArray(source.relationships).filter((value): value is NonNullable<ExchangeCardProjection["relationships"]>[number] =>
    ["saved", "watched", "following", "referred", "responded", "teamed", "requested", "connected", "owned"].includes(value),
  );
  const statusSource = objectValue(source.status);
  const statusLabel = typeof statusSource.label === "string" ? statusSource.label : undefined;
  const placement = row.sponsored ? "sponsored" as const : source.placement === "featured" ? "featured" as const : "organic" as const;
  if (!classifications.length && !relationships.length && !statusLabel && placement === "organic" && typeof source.eyebrow !== "string") return undefined;
  return {
    eyebrow: typeof source.eyebrow === "string" ? source.eyebrow : undefined,
    classifications,
    relationships,
    placement,
    status: statusLabel ? { label: statusLabel } : undefined,
  };
}

function toRecord(row: SearchRow): ExchangeRecord {
  const metadataObject = objectValue(row.metadata);
  const tags = stringArray(metadataObject.tags);
  const classifications = stringArray(metadataObject.classifications);
  const metadata = [...new Set([...tags, ...classifications])];
  if (row.sponsor_label) metadata.push(row.sponsor_label);
  return {
    id: row.id,
    type: row.record_type,
    title: row.title,
    organization: row.organization,
    summary: row.summary,
    geography: row.geography ?? "No public location",
    metadata,
    location: row.lat === null || row.lng === null ? undefined : { lat: Number(row.lat), lng: Number(row.lng) },
    ownedByViewer: row.owned_by_viewer,
    saved: row.saved_by_viewer,
    featured: metadataObject.featured === true,
    card: toCardProjection(metadataObject, row),
  };
}

function lensType(lens: ExchangeLens): ExchangeRecordType {
  if (lens === "resources") return "resource";
  if (lens === "intelligence") return "intelligence";
  if (lens === "capabilities") return "capability";
  return "rfx";
}

export async function searchExchangeRepository({
  lens,
  state,
  principal,
  cursor,
  limit = 30,
}: {
  lens: ExchangeLens;
  state: ExchangeSearchState;
  principal: SearchPrincipal;
  cursor?: string;
  limit?: number;
}): Promise<ExchangeSearchResponse> {
  const pool = getPostgresPool();
  const values: unknown[] = [];
  const param = (value: unknown) => { values.push(value); return `$${values.length}`; };
  const where: string[] = [`er.record_type = ${param(lensType(lens))}::exchange_record_type`, "er.status = 'active'"];
  const query = state.query.trim();
  let scoreExpression = "0::float8";

  if (query) {
    const queryParam = param(query);
    const likeParam = param(`%${query}%`);
    where.push(`(
      er.search_document @@ websearch_to_tsquery('english', ${queryParam})
      OR er.public_id ILIKE ${likeParam}
      OR er.title ILIKE ${likeParam}
      OR er.summary ILIKE ${likeParam}
      OR o.name ILIKE ${likeParam}
      OR coalesce(er.geography_label, l.label, l.address::text, '') ILIKE ${likeParam}
      OR er.metadata::text ILIKE ${likeParam}
      OR cap.amacs_node_id ILIKE ${likeParam}
      OR rr.solicitation_type ILIKE ${likeParam}
      OR rr.requirements::text ILIKE ${likeParam}
      OR res.availability::text ILIKE ${likeParam}
      OR ir.signal_type ILIKE ${likeParam}
      OR ir.source_context::text ILIKE ${likeParam}
    )`);
    scoreExpression = `(
      ts_rank_cd(er.search_document, websearch_to_tsquery('english', ${queryParam}))
      + CASE WHEN er.public_id ILIKE ${likeParam} THEN 0.70 ELSE 0 END
      + CASE WHEN er.title ILIKE ${likeParam} THEN 0.45 ELSE 0 END
      + CASE WHEN o.name ILIKE ${likeParam} THEN 0.30 ELSE 0 END
      + CASE WHEN coalesce(er.geography_label, l.label, '') ILIKE ${likeParam} THEN 0.10 ELSE 0 END
      + CASE WHEN er.metadata::text ILIKE ${likeParam} THEN 0.08 ELSE 0 END
    )::float8`;
  }

  const filters = state.filters;
  if (filters.geography && (filters.geographyMode === "exchange" || filters.geographyMode === "place")) {
    const geographyParam = param(`%${filters.geography.trim()}%`);
    where.push(`coalesce(er.geography_label, l.label, l.address::text, '') ILIKE ${geographyParam}`);
  }
  if (filters.geographyMode === "viewport" && filters.bounds) {
    const west = param(filters.bounds.west); const south = param(filters.bounds.south); const east = param(filters.bounds.east); const north = param(filters.bounds.north);
    where.push(`l.point IS NOT NULL AND ST_Within(l.point::geometry, ST_MakeEnvelope(${west}, ${south}, ${east}, ${north}, 4326))`);
  }
  if (filters.geographyMode === "radius" && filters.center && filters.radiusMiles) {
    const lng = param(filters.center.lng); const lat = param(filters.center.lat); const meters = param(filters.radiusMiles * 1609.344);
    where.push(`l.point IS NOT NULL AND ST_DWithin(l.point, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography, ${meters})`);
  }
  if (filters.geographyMode === "service-area" && filters.center) {
    const lng = param(filters.center.lng); const lat = param(filters.center.lat);
    where.push(`l.service_area IS NOT NULL AND ST_Covers(l.service_area, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326))`);
  }
  if (filters.geographyMode === "performance-area" && filters.center) {
    const lng = param(filters.center.lng); const lat = param(filters.center.lat);
    where.push(`rr.performance_area IS NOT NULL AND ST_Covers(rr.performance_area, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326))`);
  }

  if (filters.location === "mapped") where.push("l.point IS NOT NULL");
  if (filters.location === "off-map") where.push("l.point IS NULL");
  if (filters.ownership === "mine") {
    if (!principal.organizationId) where.push("FALSE");
    else where.push(`er.organization_id = ${param(principal.organizationId)}::uuid`);
  }
  if (filters.ownership === "others" && principal.organizationId) where.push(`er.organization_id <> ${param(principal.organizationId)}::uuid`);

  for (const tag of filters.metadata) where.push(`er.metadata::text ILIKE ${param(`%${tag}%`)}`);

  for (const [key, selected] of Object.entries(filters.facets)) {
    if (!selected.length) continue;
    const patterns = selected.map((value) => `%${value}%`);
    const patternsParam = param(patterns);
    if (key === "organization" || key === "issuer" || key === "provider") where.push(`o.name ILIKE ANY(${patternsParam}::text[])`);
    else if (key === "procurementType") where.push(`rr.solicitation_type ILIKE ANY(${patternsParam}::text[])`);
    else if (key === "amacs") where.push(`cap.amacs_node_id ILIKE ANY(${patternsParam}::text[])`);
    else if (key === "signal") where.push(`ir.signal_type ILIKE ANY(${patternsParam}::text[])`);
    else if (key === "status") where.push(`er.status ILIKE ANY(${patternsParam}::text[])`);
    else if (key === "evidence") where.push(`cap.evidence_state ILIKE ANY(${patternsParam}::text[])`);
    else if (key === "availability") where.push(`res.availability::text ILIKE ANY(${patternsParam}::text[])`);
    else where.push(`er.metadata::text ILIKE ANY(${patternsParam}::text[])`);
  }

  const userParam = principal.userId ? param(principal.userId) : undefined;
  const organizationParam = principal.organizationId ? param(principal.organizationId) : undefined;
  const ownedExpression = organizationParam ? `er.organization_id = ${organizationParam}::uuid` : "FALSE";
  const savedExpression = userParam ? `EXISTS (SELECT 1 FROM favorites f WHERE f.user_id = ${userParam}::uuid AND f.exchange_record_id = er.id)` : "FALSE";

  const orderBy = state.sort === "title"
    ? "er.title ASC, er.public_id ASC"
    : state.sort === "geography"
      ? "coalesce(er.geography_label, l.label, '') ASC, er.public_id ASC"
      : state.sort === "recent"
        ? "er.updated_at DESC, er.public_id ASC"
        : "search_score DESC, er.updated_at DESC, er.public_id ASC";

  const offset = decodeCursor(cursor);
  const safeLimit = Math.max(1, Math.min(limit, 100));
  const limitParam = param(safeLimit + 1);
  const offsetParam = param(offset);

  const sql = `
    SELECT
      er.public_id AS id,
      er.record_type,
      er.organization_id::text,
      o.name AS organization,
      er.title,
      er.summary,
      coalesce(er.geography_label, l.label, null) AS geography,
      er.metadata,
      CASE WHEN l.point IS NULL THEN NULL ELSE ST_Y(l.point::geometry) END AS lat,
      CASE WHEN l.point IS NULL THEN NULL ELSE ST_X(l.point::geometry) END AS lng,
      ${ownedExpression} AS owned_by_viewer,
      ${savedExpression} AS saved_by_viewer,
      (sp.id IS NOT NULL) AS sponsored,
      sp.label AS sponsor_label,
      ${scoreExpression} AS search_score,
      COUNT(*) OVER() AS total_count,
      COUNT(*) FILTER (WHERE l.point IS NOT NULL) OVER() AS mapped_count,
      er.updated_at
    FROM exchange_records er
    JOIN organizations o ON o.id = er.organization_id
    LEFT JOIN locations l ON l.id = er.location_id
    LEFT JOIN rfx_records rr ON rr.exchange_record_id = er.id
    LEFT JOIN resources res ON res.exchange_record_id = er.id
    LEFT JOIN intelligence_records ir ON ir.exchange_record_id = er.id
    LEFT JOIN capabilities cap ON cap.exchange_record_id = er.id
    LEFT JOIN sponsored_placements sp ON sp.exchange_record_id = er.id
      AND sp.starts_at <= now() AND (sp.ends_at IS NULL OR sp.ends_at > now())
    WHERE ${where.join(" AND ")}
    ORDER BY ${orderBy}
    LIMIT ${limitParam} OFFSET ${offsetParam}
  `;

  const result = await pool.query<SearchRow>(sql, values);
  const pageRows = result.rows.slice(0, safeLimit);
  const records = pageRows.map(toRecord);
  const results = pageRows.map((row, index) => {
    const matchedFields = query ? [
      row.id.toLowerCase().includes(query.toLowerCase()) ? "identifier" : undefined,
      row.title.toLowerCase().includes(query.toLowerCase()) ? "title" : undefined,
      row.organization.toLowerCase().includes(query.toLowerCase()) ? "organization" : undefined,
      row.summary.toLowerCase().includes(query.toLowerCase()) ? "summary" : undefined,
      row.geography?.toLowerCase().includes(query.toLowerCase()) ? "geography" : undefined,
    ].filter((value): value is string => Boolean(value)) : [];
    return {
      record: records[index],
      match: {
        score: Number(row.search_score),
        matchedFields,
        explanation: matchedFields.length ? `Matched ${matchedFields.join(", ")}` : undefined,
      },
    };
  });
  const first = result.rows[0];
  const total = first ? Number(first.total_count) : 0;
  const mapped = first ? Number(first.mapped_count) : 0;
  const hasMore = result.rows.length > safeLimit || offset + safeLimit < total;

  return {
    lens,
    state,
    results,
    suggestions: getSearchSuggestions(records, lens, state.query),
    total,
    mapped,
    offMap: Math.max(0, total - mapped),
    hasMore,
    nextCursor: hasMore ? encodeCursor(offset + safeLimit) : undefined,
  };
}
