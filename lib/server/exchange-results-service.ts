import type { ExchangeCardProjection, ExchangeLens, ExchangeRecord, ExchangeRecordType, ExchangeRelationshipState, ExchangeSearchState, ResourceProjection } from "@/lib/exchange/contracts";
import { queryDatabase } from "./postgres";

const recordTypeByLens: Record<ExchangeLens, ExchangeRecordType> = {
  rfx: "rfx",
  resources: "resource",
  intelligence: "intelligence",
  capabilities: "capability",
};

export interface ExchangeResultsPage {
  records: ExchangeRecord[];
  total: number;
  mapped: number;
  offMap: number;
  nextCursor?: string;
}

type ResultRow = {
  id: string;
  record_type: ExchangeRecordType;
  title: string;
  organization: string;
  organization_id: string;
  summary: string;
  geography: string | null;
  latitude: number | null;
  longitude: number | null;
  metadata: unknown;
  status: string;
  created_at: string;
  resource_category: string | null;
  resource_availability: unknown;
  resource_capacity: unknown;
  resource_visibility: string | null;
  resource_terms: unknown;
  resource_archived_at: string | null;
  relationship_kinds: string[] | null;
  sponsored: boolean;
  total_count: number;
  mapped_count: number;
};

function metadataList(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  if (!value || typeof value !== "object") return [];
  return Object.entries(value as Record<string, unknown>)
    .flatMap(([key, item]) => typeof item === "string" ? [`${key}: ${item}`] : [])
    .slice(0, 12);
}

function jsonString(value: unknown, key: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const item = (value as Record<string, unknown>)[key];
  return typeof item === "string" ? item : undefined;
}

function resourceProjection(row: ResultRow): ResourceProjection | undefined {
  if (row.record_type !== "resource") return undefined;
  const availability = jsonString(row.resource_availability, "state");
  const availabilityLabel = jsonString(row.resource_availability, "label") ?? availability ?? "Available";
  const capacity = jsonString(row.resource_capacity, "label");
  const serviceArea = jsonString(row.resource_availability, "serviceArea");
  const terms = jsonString(row.resource_terms, "text");
  const allowedAvailability = availability === "limited" || availability === "scheduled" ? availability : "available";
  const allowedVisibility = row.resource_visibility === "service-area" || row.resource_visibility === "off-map" ? row.resource_visibility : "public-location";
  return {
    category: row.resource_category ?? "Resource",
    availability: allowedAvailability,
    availabilityLabel,
    capacity,
    serviceArea,
    visibility: allowedVisibility,
    terms,
    status: row.resource_archived_at ? "archived" : "active",
    sponsored: row.sponsored,
  };
}

function relationshipStates(row: ResultRow, ownedByViewer: boolean): ExchangeRelationshipState[] {
  const relationships = new Set<ExchangeRelationshipState>();
  if (ownedByViewer) relationships.add("owned");
  for (const kind of row.relationship_kinds ?? []) {
    if (kind === "saved") relationships.add("saved");
    if (kind === "watching" || kind === "tracking") relationships.add("watched");
    if (kind === "following") relationships.add("following");
  }
  return [...relationships];
}

function cardProjection(row: ResultRow, metadata: string[], ownedByViewer: boolean): ExchangeCardProjection {
  return {
    eyebrow: row.record_type === "rfx" ? "RFx" : row.record_type === "resource" ? "Resource" : row.record_type === "intelligence" ? "Intelligence" : "Capability",
    classifications: metadata.slice(0, 3),
    status: { label: row.status, tone: row.status === "active" || row.status === "open" ? "success" : "neutral" },
    relationships: relationshipStates(row, ownedByViewer),
    placement: row.sponsored ? "sponsored" : "organic",
  };
}

function toRecord(row: ResultRow, actorOrganizationId?: string): ExchangeRecord {
  const metadata = metadataList(row.metadata);
  const ownedByViewer = Boolean(actorOrganizationId && row.organization_id === actorOrganizationId);
  return {
    id: row.id,
    type: row.record_type,
    title: row.title,
    organization: row.organization,
    summary: row.summary,
    geography: row.geography ?? "No public location",
    metadata,
    location: row.latitude !== null && row.longitude !== null ? { lat: Number(row.latitude), lng: Number(row.longitude) } : undefined,
    ownedByViewer,
    saved: (row.relationship_kinds ?? []).includes("saved"),
    card: cardProjection(row, metadata, ownedByViewer),
    resource: resourceProjection(row),
  };
}

function decodeCursor(cursor?: string) {
  if (!cursor) return 0;
  try {
    const value = Number(Buffer.from(cursor, "base64url").toString("utf8"));
    return Number.isSafeInteger(value) && value >= 0 ? value : 0;
  } catch {
    return 0;
  }
}

function encodeCursor(offset: number) {
  return Buffer.from(String(offset), "utf8").toString("base64url");
}

export async function listExchangeRecords(input: {
  lens: ExchangeLens;
  state: ExchangeSearchState;
  cursor?: string;
  limit?: number;
  actorOrganizationId?: string;
  actorUserId?: string;
}): Promise<ExchangeResultsPage> {
  const limit = Math.min(Math.max(input.limit ?? 40, 1), 100);
  const offset = decodeCursor(input.cursor);
  const type = recordTypeByLens[input.lens];
  const values: unknown[] = [type];
  const where = ["er.record_type = $1::exchange_record_type", "er.status <> 'deleted'"];
  let searchParam: string | undefined;

  if (input.state.query.trim()) {
    values.push(input.state.query.trim());
    searchParam = `$${values.length}`;
    where.push(`(er.search_document @@ websearch_to_tsquery('english', ${searchParam}) OR o.name ILIKE '%' || ${searchParam} || '%' OR er.metadata::text ILIKE '%' || ${searchParam} || '%')`);
  }
  if (input.state.filters.geography.trim()) {
    values.push(input.state.filters.geography.trim());
    where.push(`COALESCE(l.label, r.availability->>'serviceArea', '') ILIKE '%' || $${values.length} || '%'`);
  }
  if (input.state.filters.location === "mapped") where.push("l.point IS NOT NULL");
  if (input.state.filters.location === "off-map") where.push("l.point IS NULL");
  if (input.state.filters.ownership === "mine") {
    if (!input.actorOrganizationId) where.push("FALSE");
    else { values.push(input.actorOrganizationId); where.push(`er.organization_id = $${values.length}::uuid`); }
  }
  if (input.state.filters.ownership === "others" && input.actorOrganizationId) {
    values.push(input.actorOrganizationId); where.push(`er.organization_id <> $${values.length}::uuid`);
  }
  for (const facet of input.state.filters.metadata) {
    values.push(facet);
    where.push(`er.metadata::text ILIKE '%' || $${values.length} || '%'`);
  }

  let relationshipSelect = "'{}'::text[] AS relationship_kinds";
  let relationshipJoin = "";
  if (input.actorUserId) {
    values.push(input.actorUserId);
    const actorUserParam = `$${values.length}`;
    relationshipSelect = "COALESCE(rel.kinds, '{}'::text[]) AS relationship_kinds";
    relationshipJoin = `LEFT JOIN LATERAL (SELECT array_agg(rr.relationship_kind ORDER BY rr.relationship_kind) AS kinds FROM record_relationships rr WHERE rr.exchange_record_id = er.id AND rr.user_id = ${actorUserParam}::uuid) rel ON TRUE`;
  }

  const orderBy = input.state.sort === "title" ? "er.title ASC, er.public_id ASC"
    : input.state.sort === "geography" ? "COALESCE(l.label, r.availability->>'serviceArea', '') ASC, er.title ASC"
      : searchParam ? `ts_rank_cd(er.search_document, websearch_to_tsquery('english', ${searchParam})) DESC, er.updated_at DESC, er.public_id ASC`
        : "er.updated_at DESC, er.public_id ASC";

  values.push(limit, offset);
  const limitParam = `$${values.length - 1}`;
  const offsetParam = `$${values.length}`;
  const sql = `
    SELECT er.public_id AS id, er.record_type, er.title, o.name AS organization, er.organization_id,
           er.summary, COALESCE(l.label, CASE WHEN er.record_type = 'resource' THEN r.availability->>'serviceArea' END) AS geography,
           CASE WHEN l.point IS NULL THEN NULL ELSE ST_Y(l.point::geometry) END AS latitude,
           CASE WHEN l.point IS NULL THEN NULL ELSE ST_X(l.point::geometry) END AS longitude,
           er.metadata, er.status, er.created_at,
           r.category AS resource_category, r.availability AS resource_availability, r.capacity AS resource_capacity,
           r.visibility AS resource_visibility, r.terms AS resource_terms, r.archived_at AS resource_archived_at,
           ${relationshipSelect},
           (sponsor.exchange_record_id IS NOT NULL) AS sponsored,
           COUNT(*) OVER()::int AS total_count,
           COUNT(*) FILTER (WHERE l.point IS NOT NULL) OVER()::int AS mapped_count
      FROM exchange_records er
      JOIN organizations o ON o.id = er.organization_id
      LEFT JOIN locations l ON l.id = er.location_id
      LEFT JOIN resources r ON r.exchange_record_id = er.id
      ${relationshipJoin}
      LEFT JOIN LATERAL (
        SELECT sp.exchange_record_id
          FROM sponsored_placements sp
         WHERE sp.exchange_record_id = er.id
           AND sp.status = 'active'
           AND sp.starts_at <= now()
           AND sp.ends_at > now()
         ORDER BY sp.placement_rank DESC, sp.starts_at DESC
         LIMIT 1
      ) sponsor ON TRUE
     WHERE ${where.join(" AND ")}
     ORDER BY ${orderBy}
     LIMIT ${limitParam} OFFSET ${offsetParam}`;

  const result = await queryDatabase<ResultRow>(sql, values);
  const rows = result.rows;
  const total = rows[0]?.total_count ?? 0;
  const mapped = rows[0]?.mapped_count ?? 0;
  const nextOffset = offset + rows.length;
  return {
    records: rows.map((row) => toRecord(row, input.actorOrganizationId)),
    total,
    mapped,
    offMap: total - mapped,
    nextCursor: nextOffset < total ? encodeCursor(nextOffset) : undefined,
  };
}
