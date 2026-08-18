import type {
  ExchangeCardContext,
  ExchangeCardMediaKind,
  ExchangeCardPlacement,
  ExchangeRecord,
  ExchangeRecordAccess,
  ExchangeRelationshipState,
  ResourceAvailabilityState,
  ResourceVisibility,
} from "@/lib/exchange/contracts";
import type { ExchangeActor } from "./exchange-actor";
import { query } from "./database";

export interface ExchangeRecordQuery {
  lens?: "rfx" | "resources" | "intelligence" | "capabilities";
  recordId?: string;
  query?: string;
  limit?: number;
}

type RecordRow = {
  public_id: string;
  record_type: ExchangeRecord["type"];
  organization_id: string;
  organization_name: string;
  title: string;
  summary: string;
  status: string;
  metadata: unknown;
  latitude: number | null;
  longitude: number | null;
  geography_label: string | null;
  owned_by_viewer: boolean;
  relationships: string[] | null;
  rfx_solicitation_type: string | null;
  rfx_due_at: string | null;
  rfx_lifecycle_status: string | null;
  resource_mode: "offer" | "request" | null;
  resource_category: string | null;
  resource_availability: unknown;
  resource_visibility: string | null;
  resource_capacity: unknown;
  resource_terms: unknown;
  resource_archived_at: string | null;
  intelligence_signal_type: string | null;
  intelligence_observed_at: string | null;
  capability_amacs_node_id: string | null;
  capability_evidence_state: string | null;
  recently_viewed: boolean;
  has_unread_alert: boolean;
};

const lensType = {
  rfx: "rfx",
  resources: "resource",
  intelligence: "intelligence",
  capabilities: "capability",
} as const;

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim()) : [];
}

function metadataTerms(value: unknown) {
  if (Array.isArray(value)) return asStringArray(value);
  const metadata = asObject(value);
  const terms = [
    ...asStringArray(metadata.tags),
    ...asStringArray(metadata.keywords),
    ...asStringArray(metadata.metadata),
    asString(metadata.label),
  ].filter((item): item is string => Boolean(item));
  return [...new Set(terms)];
}

function metadataClassifications(value: unknown) {
  const metadata = asObject(value);
  return asStringArray(metadata.classifications);
}

function placementFromMetadata(value: unknown): ExchangeCardPlacement {
  const placement = asString(asObject(value).placement);
  return placement === "featured" || placement === "sponsored" ? placement : "organic";
}

function mediaFromMetadata(value: unknown) {
  const media = asObject(asObject(value).media);
  const kind = asString(media.kind);
  const validKind: ExchangeCardMediaKind = kind === "logo" || kind === "image" || kind === "visualization" ? kind : "category";
  const label = asString(media.label);
  if (!label && !asString(media.src)) return undefined;
  return {
    kind: validKind,
    label: label ?? "Record",
    src: asString(media.src),
    alt: asString(media.alt),
  };
}

function geography(row: RecordRow) {
  return row.geography_label ?? asString(asObject(row.metadata).geography) ?? "Geography not published";
}

function relationships(row: RecordRow): ExchangeRelationshipState[] {
  const mapped: ExchangeRelationshipState[] = [];
  for (const relationship of row.relationships ?? []) {
    if (relationship === "saved") mapped.push("saved");
    if (relationship === "watching") mapped.push("watched");
    if (relationship === "tracking") mapped.push("following");
    if (relationship === "following") mapped.push("following");
  }
  if (row.owned_by_viewer) mapped.push("owned");
  return [...new Set(mapped)];
}

function accessFor(row: RecordRow, actor?: ExchangeActor): ExchangeRecordAccess {
  const authenticated = Boolean(actor);
  const owned = row.owned_by_viewer;
  return {
    canOpenDetail: true,
    canSave: authenticated,
    canWatch: authenticated && row.record_type === "rfx",
    canFollow: authenticated && row.record_type === "capability",
    canTrack: authenticated && row.record_type === "intelligence",
    canShare: true,
    canRefer: authenticated,
    canRespond: authenticated && row.record_type === "rfx" && !owned,
    canManage: authenticated && owned,
  };
}

function statusFor(row: RecordRow) {
  if (row.record_type === "rfx" && row.rfx_lifecycle_status) return row.rfx_lifecycle_status;
  if (row.record_type === "resource" && row.resource_archived_at) return "archived";
  if (row.record_type === "capability" && row.capability_evidence_state) return row.capability_evidence_state;
  return row.status;
}

function statusTone(label: string) {
  const normalized = label.toLowerCase();
  if (["open", "active", "available", "published", "verified"].some((item) => normalized.includes(item))) return "success" as const;
  if (["closing", "limited", "pending", "draft", "unverified"].some((item) => normalized.includes(item))) return "warning" as const;
  if (["closed", "archived", "expired", "revoked"].some((item) => normalized.includes(item))) return "critical" as const;
  return "neutral" as const;
}

function cardContext(row: RecordRow): ExchangeCardContext {
  if (row.has_unread_alert) return "alert";
  if (row.recently_viewed) return "recently-viewed";
  return "default";
}

function resourceProjection(row: RecordRow): ExchangeRecord["resource"] {
  if (row.record_type !== "resource") return undefined;
  const availability = asObject(row.resource_availability);
  const stateValue = asString(availability.state);
  const state: ResourceAvailabilityState = stateValue === "limited" || stateValue === "scheduled" ? stateValue : "available";
  const visibilityValue = row.resource_visibility;
  const visibility: ResourceVisibility = visibilityValue === "service-area" || visibilityValue === "off-map" ? visibilityValue : "public-location";
  const capacity = asObject(row.resource_capacity);
  const terms = asObject(row.resource_terms);
  return {
    category: row.resource_category ?? "Resource",
    availability: state,
    availabilityLabel: asString(availability.label) ?? (state === "available" ? "Available now" : state === "limited" ? "Limited availability" : "Scheduled access"),
    capacity: asString(capacity.label),
    serviceArea: asString(asObject(row.metadata).serviceArea),
    visibility,
    terms: asString(terms.label),
    status: row.resource_archived_at ? "archived" : "active",
    sponsored: placementFromMetadata(row.metadata) === "sponsored",
  };
}

function rowToRecord(row: RecordRow, actor?: ExchangeActor): ExchangeRecord {
  const classifications = metadataClassifications(row.metadata);
  if (row.rfx_solicitation_type) classifications.unshift(row.rfx_solicitation_type);
  if (row.resource_category) classifications.unshift(row.resource_category);
  if (row.intelligence_signal_type) classifications.unshift(row.intelligence_signal_type);
  if (row.capability_amacs_node_id) classifications.unshift(row.capability_amacs_node_id);
  const relationState = relationships(row);
  const status = statusFor(row);
  const context = cardContext(row);
  const metadata = metadataTerms(row.metadata);
  if (row.rfx_due_at) metadata.push(`Due ${new Date(row.rfx_due_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`);
  if (row.resource_mode) metadata.push(row.resource_mode === "offer" ? "Offered" : "Requested");
  if (row.intelligence_observed_at) metadata.push(`Observed ${new Date(row.intelligence_observed_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`);

  return {
    id: row.public_id,
    type: row.record_type,
    title: row.title,
    organization: row.organization_name,
    organizationId: row.organization_id,
    summary: row.summary,
    geography: geography(row),
    metadata: [...new Set(metadata)],
    location: row.latitude !== null && row.longitude !== null ? { lat: Number(row.latitude), lng: Number(row.longitude) } : undefined,
    ownedByViewer: row.owned_by_viewer,
    featured: placementFromMetadata(row.metadata) === "featured",
    saved: relationState.includes("saved"),
    access: accessFor(row, actor),
    resource: resourceProjection(row),
    card: {
      eyebrow: row.record_type === "rfx" ? row.rfx_solicitation_type ?? "RFx" : row.record_type === "resource" ? (row.resource_mode === "request" ? "Resource Request" : "Resource Offer") : row.record_type === "intelligence" ? row.intelligence_signal_type ?? "Intelligence" : "Capability",
      media: mediaFromMetadata(row.metadata),
      classifications: [...new Set(classifications)].filter(Boolean).slice(0, 6),
      status: { label: status, tone: statusTone(status) },
      relationships: relationState,
      placement: placementFromMetadata(row.metadata),
      context,
      contextLabel: context === "alert" ? "Needs attention" : context === "recently-viewed" ? "Recently viewed" : undefined,
      availability: "available",
    },
  };
}

export async function listExchangeRecords(input: ExchangeRecordQuery = {}, actor?: ExchangeActor) {
  const type = input.lens ? lensType[input.lens] : null;
  const search = input.query?.trim() ?? "";
  const limit = Math.min(Math.max(input.limit ?? 500, 1), 1000);
  const result = await query<RecordRow>(`
    SELECT
      er.public_id,
      er.record_type,
      er.organization_id::text,
      o.name AS organization_name,
      er.title,
      er.summary,
      er.status,
      er.metadata,
      CASE WHEN l.point IS NULL THEN NULL ELSE ST_Y(l.point::geometry) END AS latitude,
      CASE WHEN l.point IS NULL THEN NULL ELSE ST_X(l.point::geometry) END AS longitude,
      COALESCE(l.label, l.address->>'locality', l.address->>'formatted') AS geography_label,
      ($3::uuid IS NOT NULL AND m.user_id IS NOT NULL) AS owned_by_viewer,
      rel.relationships,
      rr.solicitation_type AS rfx_solicitation_type,
      rr.due_at::text AS rfx_due_at,
      rr.lifecycle_status AS rfx_lifecycle_status,
      res.resource_mode,
      res.category AS resource_category,
      res.availability AS resource_availability,
      res.visibility AS resource_visibility,
      res.capacity AS resource_capacity,
      res.terms AS resource_terms,
      res.archived_at::text AS resource_archived_at,
      ir.signal_type AS intelligence_signal_type,
      ir.observed_at::text AS intelligence_observed_at,
      cap.amacs_node_id AS capability_amacs_node_id,
      cap.evidence_state AS capability_evidence_state,
      EXISTS (
        SELECT 1 FROM activity_events ae
        WHERE ae.actor_user_id = $3::uuid
          AND ae.exchange_record_id = er.id
          AND ae.event_name IN ('RecordViewed', 'RecordCardOpened')
          AND ae.occurred_at > now() - interval '30 days'
      ) AS recently_viewed,
      EXISTS (
        SELECT 1 FROM notifications n
        WHERE n.user_id = $3::uuid
          AND n.exchange_record_id = er.id
          AND n.read_at IS NULL
      ) AS has_unread_alert
    FROM exchange_records er
    JOIN organizations o ON o.id = er.organization_id
    LEFT JOIN locations l ON l.id = er.location_id
    LEFT JOIN organization_memberships m ON m.organization_id = er.organization_id AND m.user_id = $3::uuid
    LEFT JOIN LATERAL (
      SELECT array_agg(r.relationship_kind ORDER BY r.relationship_kind) AS relationships
      FROM record_relationships r
      WHERE r.user_id = $3::uuid AND r.exchange_record_id = er.id
    ) rel ON true
    LEFT JOIN rfx_records rr ON rr.exchange_record_id = er.id
    LEFT JOIN resources res ON res.exchange_record_id = er.id
    LEFT JOIN intelligence_records ir ON ir.exchange_record_id = er.id
    LEFT JOIN capabilities cap ON cap.exchange_record_id = er.id
    WHERE ($1::exchange_record_type IS NULL OR er.record_type = $1::exchange_record_type)
      AND ($2::text = '' OR er.search_document @@ websearch_to_tsquery('english', $2) OR o.name ILIKE '%' || $2 || '%' OR er.metadata::text ILIKE '%' || $2 || '%')
      AND ($4::text IS NULL OR er.public_id = $4)
      AND er.status <> 'deleted'
    ORDER BY er.updated_at DESC, er.title ASC
    LIMIT $5
  `, [type, search, actor?.userId ?? null, input.recordId ?? null, limit]);
  return result.rows.map((row) => rowToRecord(row, actor));
}

export async function getExchangeRecord(recordId: string, actor?: ExchangeActor) {
  const records = await listExchangeRecords({ recordId, limit: 1 }, actor);
  return records[0];
}
