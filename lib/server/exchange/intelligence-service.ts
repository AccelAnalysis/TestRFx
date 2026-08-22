import { randomUUID } from "node:crypto";
import type { ExchangeRecord } from "@/lib/exchange/contracts";
import type {
  IntelligenceActivityItem,
  IntelligenceCompareDimension,
  IntelligenceCompareResponse,
  IntelligenceDetail,
  IntelligenceInsightInput,
  IntelligenceListResponse,
  IntelligenceNote,
  IntelligenceSource,
  IntelligenceSourceType,
} from "@/lib/exchange/intelligence-runtime";
import { assertExchangeWrite, type ExchangeServerActor } from "@/lib/server/exchange/actor";
import { getDatabase } from "@/lib/server/database";
import { organizationCardMedia } from "@/lib/server/exchange/organization-card-media";

export class IntelligenceServiceError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "IntelligenceServiceError";
  }
}

type IntelligenceRow = {
  exchange_record_uuid: string;
  intelligence_record_id: string;
  public_id: string;
  organization_id: string;
  organization_name: string;
  title: string;
  summary: string;
  geography: string | null;
  signal_type: string | null;
  observed_from: Date | string | null;
  observed_to: Date | string | null;
  source_type: IntelligenceSourceType | null;
  provenance: unknown;
  location_visibility: "exact" | "approximate" | "locality_only" | null;
  lat: number | string | null;
  lng: number | string | null;
  centroid_lat: number | string | null;
  centroid_lng: number | string | null;
  saved: boolean;
  tracking: boolean;
  following: boolean;
  source_label: string | null;
  logo_url: string | null;
  media_source_type: "linked" | "uploaded" | null;
  media_provider: "youtube" | "vimeo" | "rfxchange" | null;
  media_provider_video_id: string | null;
  media_poster_url: string | null;
  media_playback_url: string | null;
  media_status: "pending" | "ready" | "rejected" | null;
};

type SourceRow = { id: string; source_label: string; source_type: IntelligenceSourceType; publisher: string | null; source_uri: string | null; observed_at: Date | string | null; retrieved_at: Date | string | null };
type NoteRow = { id: string; body: string; visibility: IntelligenceNote["visibility"]; author_user_id: string; organization_id: string | null; created_at: Date | string; updated_at: Date | string };

function iso(value: Date | string | null | undefined) {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}
function number(value: number | string | null) { if (value === null) return undefined; const parsed = typeof value === "number" ? value : Number(value); return Number.isFinite(parsed) ? parsed : undefined; }
function safeSourceUri(value?: string) {
  const text = value?.trim();
  if (!text) return undefined;
  let url: URL;
  try { url = new URL(text); } catch { throw new IntelligenceServiceError(400, "Source link must be a valid absolute URL."); }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new IntelligenceServiceError(400, "Source link must use HTTP(S).");
  return url.toString();
}
function validateInput(input: IntelligenceInsightInput) {
  if (!input.title.trim()) throw new IntelligenceServiceError(400, "Insight title is required.");
  if (!input.summary.trim()) throw new IntelligenceServiceError(400, "Observation is required.");
  if (!input.signalType.trim()) throw new IntelligenceServiceError(400, "Signal type is required.");
  if (!input.sourceLabel.trim()) throw new IntelligenceServiceError(400, "Source label is required.");
  if (!["exchange-activity", "participant-observation", "external-dataset"].includes(input.sourceType)) throw new IntelligenceServiceError(400, "Unsupported Intelligence source type.");
  safeSourceUri(input.sourceUri);
}

function location(row: IntelligenceRow) {
  const exactLat = number(row.lat); const exactLng = number(row.lng);
  if (row.location_visibility === "exact" && exactLat !== undefined && exactLng !== undefined) return { lat: exactLat, lng: exactLng };
  const centroidLat = number(row.centroid_lat); const centroidLng = number(row.centroid_lng);
  if (centroidLat !== undefined && centroidLng !== undefined) return { lat: centroidLat, lng: centroidLng };
  return undefined;
}

function record(row: IntelligenceRow, actor: ExchangeServerActor): ExchangeRecord {
  const relationships: NonNullable<ExchangeRecord["card"]>["relationships"] = [];
  if (row.saved) relationships.push("saved");
  if (row.tracking) relationships.push("watched");
  if (row.following) relationships.push("following");
  if (row.organization_id === actor.organizationId) relationships.push("owned");
  const media = organizationCardMedia({
    logo_url: row.logo_url ?? undefined,
    media_source_type: row.media_source_type ?? undefined,
    media_provider: row.media_provider ?? undefined,
    media_provider_video_id: row.media_provider_video_id ?? undefined,
    media_poster_url: row.media_poster_url ?? undefined,
    media_playback_url: row.media_playback_url ?? undefined,
    media_status: row.media_status ?? undefined,
  }, row.organization_name);
  const mapped = location(row);
  const observed = [iso(row.observed_from)?.slice(0, 10), iso(row.observed_to)?.slice(0, 10)].filter(Boolean).join(" → ");
  const metadata = [row.signal_type, observed || undefined, row.source_label ? `Source: ${row.source_label}` : undefined, mapped ? undefined : "Off-map record"].filter((item): item is string => Boolean(item));
  return {
    id: row.public_id,
    type: "intelligence",
    title: row.title,
    organization: row.organization_name,
    summary: row.summary,
    geography: row.geography ?? "Geography not published",
    metadata,
    location: mapped,
    ownedByViewer: row.organization_id === actor.organizationId,
    saved: row.saved || row.tracking || row.following,
    card: {
      eyebrow: row.signal_type ?? "Intelligence",
      organizationMedia: media,
      classifications: row.signal_type ? [row.signal_type] : [],
      status: { label: row.tracking || row.following ? "Tracking" : "Current", tone: row.tracking || row.following ? "success" : "info" },
      relationships,
      placement: "organic",
    },
  };
}

async function rows(actor: ExchangeServerActor, publicId?: string) {
  const sql = getDatabase();
  return sql<IntelligenceRow[]>`
    SELECT
      er.id::text AS exchange_record_uuid,
      ir.id::text AS intelligence_record_id,
      er.public_id,
      er.organization_id::text AS organization_id,
      o.name AS organization_name,
      er.title,
      er.summary,
      COALESCE(NULLIF(er.metadata ->> 'geography', ''), g.name, l.label) AS geography,
      ir.signal_type,
      ir.observed_from,
      ir.observed_to,
      ir.source_type,
      ir.provenance,
      l.visibility::text AS location_visibility,
      CASE WHEN l.point IS NULL THEN NULL ELSE ST_Y(l.point::geometry) END AS lat,
      CASE WHEN l.point IS NULL THEN NULL ELSE ST_X(l.point::geometry) END AS lng,
      CASE WHEN g.centroid IS NULL THEN NULL ELSE ST_Y(g.centroid::geometry) END AS centroid_lat,
      CASE WHEN g.centroid IS NULL THEN NULL ELSE ST_X(g.centroid::geometry) END AS centroid_lng,
      EXISTS (SELECT 1 FROM record_relationships rel WHERE rel.user_id = ${actor.userId}::uuid AND rel.exchange_record_id = er.id AND rel.relationship_kind = 'saved') AS saved,
      EXISTS (SELECT 1 FROM record_relationships rel WHERE rel.user_id = ${actor.userId}::uuid AND rel.exchange_record_id = er.id AND rel.relationship_kind = 'tracking') AS tracking,
      EXISTS (SELECT 1 FROM record_relationships rel WHERE rel.user_id = ${actor.userId}::uuid AND rel.exchange_record_id = er.id AND rel.relationship_kind = 'following') AS following,
      source.source_label,
      op.logo_url,
      om.source_type::text AS media_source_type,
      om.provider::text AS media_provider,
      om.provider_video_id AS media_provider_video_id,
      om.poster_url AS media_poster_url,
      om.playback_url AS media_playback_url,
      om.status::text AS media_status
    FROM exchange_records er
    JOIN intelligence_records ir ON ir.exchange_record_id = er.id
    JOIN organizations o ON o.id = er.organization_id
    LEFT JOIN locations l ON l.id = er.location_id
    LEFT JOIN geographies g ON g.id = l.geography_id
    LEFT JOIN organization_profiles op ON op.organization_id = o.id
    LEFT JOIN organization_media om ON om.organization_id = o.id AND om.media_role = 'intro_video'
    LEFT JOIN LATERAL (
      SELECT source_label FROM intelligence_sources src
      WHERE src.intelligence_record_id = ir.id
      ORDER BY src.created_at DESC LIMIT 1
    ) source ON true
    WHERE er.record_type = 'intelligence'
      AND er.status = 'active'
      AND (${publicId ?? null}::text IS NULL OR er.public_id = ${publicId ?? null})
    ORDER BY er.updated_at DESC, er.public_id
  `;
}

export async function listIntelligence(actor: ExchangeServerActor, options: { query?: string; offset?: number; limit?: number } = {}): Promise<IntelligenceListResponse> {
  const query = options.query?.trim().toLowerCase() ?? "";
  const offset = Math.max(0, options.offset ?? 0);
  const limit = Math.max(1, Math.min(50, options.limit ?? 24));
  const all = (await rows(actor)).filter((row) => !query || [row.title, row.summary, row.organization_name, row.geography ?? "", row.signal_type ?? "", row.source_label ?? ""].some((value) => value.toLowerCase().includes(query)));
  const page = all.slice(offset, offset + limit);
  const mapped = all.filter((row) => Boolean(location(row))).length;
  return { records: page.map((row) => record(row, actor)), total: all.length, mapped, offMap: all.length - mapped, offset, limit, nextOffset: offset + page.length < all.length ? offset + page.length : undefined };
}

async function requiredRow(actor: ExchangeServerActor, publicId: string) {
  const result = await rows(actor, publicId);
  if (!result[0]) throw new IntelligenceServiceError(404, "Intelligence record not found.");
  return result[0];
}

export async function getIntelligenceDetail(actor: ExchangeServerActor, publicId: string): Promise<IntelligenceDetail> {
  const sql = getDatabase();
  const row = await requiredRow(actor, publicId);
  const sourceRows = await sql<SourceRow[]>`
    SELECT id::text, source_label, source_type, publisher, source_uri, observed_at, retrieved_at
    FROM intelligence_sources WHERE intelligence_record_id = ${row.intelligence_record_id}::uuid
    ORDER BY created_at DESC
  `;
  const noteRows = await sql<NoteRow[]>`
    SELECT id::text, body, visibility, author_user_id::text, organization_id::text, created_at, updated_at
    FROM intelligence_notes
    WHERE intelligence_record_id = ${row.intelligence_record_id}::uuid
      AND (visibility = 'shared' OR (visibility = 'organization' AND organization_id = ${actor.organizationId}::uuid) OR (visibility = 'personal' AND author_user_id = ${actor.userId}::uuid))
    ORDER BY created_at DESC
  `;
  const relatedRows = await sql<IntelligenceRow[]>`
    SELECT
      er.id::text AS exchange_record_uuid,
      ir.id::text AS intelligence_record_id,
      er.public_id,
      er.organization_id::text AS organization_id,
      o.name AS organization_name,
      er.title, er.summary,
      COALESCE(NULLIF(er.metadata ->> 'geography', ''), g.name, l.label) AS geography,
      ir.signal_type, ir.observed_from, ir.observed_to, ir.source_type, ir.provenance,
      l.visibility::text AS location_visibility,
      CASE WHEN l.point IS NULL THEN NULL ELSE ST_Y(l.point::geometry) END AS lat,
      CASE WHEN l.point IS NULL THEN NULL ELSE ST_X(l.point::geometry) END AS lng,
      CASE WHEN g.centroid IS NULL THEN NULL ELSE ST_Y(g.centroid::geometry) END AS centroid_lat,
      CASE WHEN g.centroid IS NULL THEN NULL ELSE ST_X(g.centroid::geometry) END AS centroid_lng,
      false AS saved, false AS tracking, false AS following, NULL::text AS source_label,
      op.logo_url, om.source_type::text AS media_source_type, om.provider::text AS media_provider,
      om.provider_video_id AS media_provider_video_id, om.poster_url AS media_poster_url,
      om.playback_url AS media_playback_url, om.status::text AS media_status
    FROM intelligence_relationships rel
    JOIN exchange_records related ON related.id = rel.related_exchange_record_id
    JOIN exchange_records er ON er.id = related.id
    JOIN intelligence_records ir ON ir.exchange_record_id = er.id
    JOIN organizations o ON o.id = er.organization_id
    LEFT JOIN locations l ON l.id = er.location_id
    LEFT JOIN geographies g ON g.id = l.geography_id
    LEFT JOIN organization_profiles op ON op.organization_id = o.id
    LEFT JOIN organization_media om ON om.organization_id = o.id AND om.media_role = 'intro_video'
    WHERE rel.intelligence_record_id = ${row.intelligence_record_id}::uuid AND er.record_type = 'intelligence'
  `;
  const relatedOrganizations = await sql<{ id: string; name: string }[]>`
    SELECT DISTINCT o.id::text, o.name FROM intelligence_relationships rel
    JOIN organizations o ON o.id = rel.related_organization_id
    WHERE rel.intelligence_record_id = ${row.intelligence_record_id}::uuid
    ORDER BY o.name
  `;
  const tracked = row.tracking || row.following;
  const sources: IntelligenceSource[] = sourceRows.map((source) => ({ id: source.id, label: source.source_label, type: source.source_type, publisher: source.publisher ?? undefined, uri: source.source_uri ?? undefined, observedAt: iso(source.observed_at), retrievedAt: iso(source.retrieved_at) }));
  const notes: IntelligenceNote[] = noteRows.map((note) => ({ id: note.id, body: note.body, visibility: note.visibility, authorUserId: note.author_user_id, organizationId: note.organization_id ?? undefined, createdAt: iso(note.created_at) ?? "", updatedAt: iso(note.updated_at) ?? "" }));
  return { record: record(row, actor), signalType: row.signal_type ?? "Intelligence", observedFrom: iso(row.observed_from), observedTo: iso(row.observed_to), sourceType: row.source_type ?? undefined, provenance: row.provenance && typeof row.provenance === "object" && !Array.isArray(row.provenance) ? row.provenance as Record<string, unknown> : {}, sources, notes, tracking: { active: tracked, mode: row.following ? "follow" : row.tracking ? "track" : undefined }, relatedRecords: relatedRows.map((item) => record(item, actor)), relatedOrganizations };
}

async function ownedLocation(actor: ExchangeServerActor, locationId?: string) {
  if (!locationId) return undefined;
  const sql = getDatabase();
  const result = await sql<{ id: string }[]>`SELECT id::text FROM locations WHERE id = ${locationId}::uuid AND organization_id = ${actor.organizationId}::uuid LIMIT 1`;
  if (!result[0]) throw new IntelligenceServiceError(403, "The selected location does not belong to the active organization.");
  return result[0].id;
}

export async function createIntelligence(actor: ExchangeServerActor, input: IntelligenceInsightInput) {
  assertExchangeWrite(actor, "intelligence:write"); validateInput(input);
  const sql = getDatabase(); const locationId = await ownedLocation(actor, input.locationId); const publicId = `intel-${randomUUID()}`; const sourceUri = safeSourceUri(input.sourceUri);
  await sql.begin(async (tx) => {
    const exchange = await tx<{ id: string }[]>`
      INSERT INTO exchange_records (public_id, record_type, organization_id, location_id, title, summary, metadata)
      VALUES (${publicId}, 'intelligence', ${actor.organizationId}::uuid, ${locationId ?? null}::uuid, ${input.title.trim()}, ${input.summary.trim()}, ${tx.json({ geography: input.geography.trim() })}) RETURNING id::text
    `;
    const exchangeId = exchange[0]?.id; if (!exchangeId) throw new IntelligenceServiceError(500, "Intelligence record could not be created.");
    const intelligence = await tx<{ id: string }[]>`
      INSERT INTO intelligence_records (exchange_record_id, signal_type, observed_from, observed_to, source_type, provenance)
      VALUES (${exchangeId}::uuid, ${input.signalType.trim()}, ${input.observedFrom || null}::timestamptz, ${input.observedTo || null}::timestamptz, ${input.sourceType}, ${tx.json({ createdByUserId: actor.userId, createdByOrganizationId: actor.organizationId })}) RETURNING id::text
    `;
    const intelligenceId = intelligence[0]?.id; if (!intelligenceId) throw new IntelligenceServiceError(500, "Intelligence domain record could not be created.");
    await tx`INSERT INTO intelligence_sources (intelligence_record_id, source_label, source_type, source_uri, retrieved_at) VALUES (${intelligenceId}::uuid, ${input.sourceLabel.trim()}, ${input.sourceType}, ${sourceUri ?? null}, now())`;
    await tx`INSERT INTO activity_events (event_name, actor_user_id, organization_id, exchange_record_id, payload) VALUES ('IntelligenceCreated', ${actor.userId}::uuid, ${actor.organizationId}::uuid, ${exchangeId}::uuid, ${tx.json({ publicId })})`;
  });
  return getIntelligenceDetail(actor, publicId);
}

export async function updateIntelligence(actor: ExchangeServerActor, publicId: string, input: IntelligenceInsightInput) {
  assertExchangeWrite(actor, "intelligence:write"); validateInput(input);
  const current = await requiredRow(actor, publicId); if (current.organization_id !== actor.organizationId) throw new IntelligenceServiceError(403, "Only the owning organization can edit this insight.");
  const sql = getDatabase(); const locationId = await ownedLocation(actor, input.locationId); const sourceUri = safeSourceUri(input.sourceUri);
  await sql.begin(async (tx) => {
    await tx`UPDATE exchange_records SET title = ${input.title.trim()}, summary = ${input.summary.trim()}, location_id = ${locationId ?? null}::uuid, metadata = ${tx.json({ geography: input.geography.trim() })}, updated_at = now() WHERE id = ${current.exchange_record_uuid}::uuid`;
    await tx`UPDATE intelligence_records SET signal_type = ${input.signalType.trim()}, observed_from = ${input.observedFrom || null}::timestamptz, observed_to = ${input.observedTo || null}::timestamptz, source_type = ${input.sourceType}, updated_at = now() WHERE id = ${current.intelligence_record_id}::uuid`;
    await tx`INSERT INTO intelligence_sources (intelligence_record_id, source_label, source_type, source_uri, retrieved_at) VALUES (${current.intelligence_record_id}::uuid, ${input.sourceLabel.trim()}, ${input.sourceType}, ${sourceUri ?? null}, now())`;
    await tx`INSERT INTO activity_events (event_name, actor_user_id, organization_id, exchange_record_id, payload) VALUES ('IntelligenceUpdated', ${actor.userId}::uuid, ${actor.organizationId}::uuid, ${current.exchange_record_uuid}::uuid, '{}'::jsonb)`;
  });
  return getIntelligenceDetail(actor, publicId);
}

export async function addIntelligenceNote(actor: ExchangeServerActor, publicId: string, body: string, visibility: IntelligenceNote["visibility"] = "organization") {
  const text = body.trim(); if (!text) throw new IntelligenceServiceError(400, "Note text is required.");
  if (!["personal", "organization", "shared"].includes(visibility)) throw new IntelligenceServiceError(400, "Unsupported note visibility.");
  const current = await requiredRow(actor, publicId); const sql = getDatabase();
  const note = await sql<{ id: string; created_at: Date | string }[]>`
    INSERT INTO intelligence_notes (intelligence_record_id, author_user_id, organization_id, visibility, body)
    VALUES (${current.intelligence_record_id}::uuid, ${actor.userId}::uuid, ${visibility === "personal" ? null : actor.organizationId}::uuid, ${visibility}, ${text})
    RETURNING id::text, created_at
  `;
  await sql`INSERT INTO activity_events (event_name, actor_user_id, organization_id, exchange_record_id, payload) VALUES ('IntelligenceNoteAdded', ${actor.userId}::uuid, ${actor.organizationId}::uuid, ${current.exchange_record_uuid}::uuid, ${sql.json({ noteId: note[0]?.id, visibility })})`;
  return { id: note[0]?.id, createdAt: iso(note[0]?.created_at) };
}

export async function listIntelligenceActivity(actor: ExchangeServerActor, publicId: string): Promise<IntelligenceActivityItem[]> {
  const current = await requiredRow(actor, publicId); const sql = getDatabase();
  const events = await sql<{ id: number | string; event_name: string; actor_user_id: string | null; organization_id: string | null; payload: unknown; occurred_at: Date | string }[]>`
    SELECT id, event_name, actor_user_id::text, organization_id::text, payload, occurred_at
    FROM activity_events WHERE exchange_record_id = ${current.exchange_record_uuid}::uuid ORDER BY occurred_at DESC LIMIT 100
  `;
  return events.map((event) => ({ id: String(event.id), eventName: event.event_name, actorUserId: event.actor_user_id ?? undefined, organizationId: event.organization_id ?? undefined, payload: event.payload && typeof event.payload === "object" && !Array.isArray(event.payload) ? event.payload as Record<string, unknown> : {}, occurredAt: iso(event.occurred_at) ?? "" }));
}

async function compareSide(actor: ExchangeServerActor, dimension: IntelligenceCompareDimension, value: string) {
  const all = await rows(actor);
  const selected = dimension === "insights" ? all.filter((row) => row.public_id === value) : dimension === "organizations" ? all.filter((row) => row.organization_id === value) : all.filter((row) => (row.geography ?? "") === value);
  const label = dimension === "insights" ? selected[0]?.title ?? value : dimension === "organizations" ? selected[0]?.organization_name ?? value : value;
  return { label, records: selected.map((row) => ({ id: row.public_id, title: row.title, organization: row.organization_name, geography: row.geography ?? "Geography not published", signalType: row.signal_type ?? undefined, observedFrom: iso(row.observed_from), observedTo: iso(row.observed_to) })) };
}

export async function compareIntelligence(actor: ExchangeServerActor, dimension: IntelligenceCompareDimension, left: string, right: string): Promise<IntelligenceCompareResponse> {
  if (!["insights", "organizations", "geographies"].includes(dimension)) throw new IntelligenceServiceError(400, "Unsupported comparison dimension.");
  if (!left.trim() || !right.trim()) throw new IntelligenceServiceError(400, "Both comparison sides are required.");
  const [leftSide, rightSide] = await Promise.all([compareSide(actor, dimension, left.trim()), compareSide(actor, dimension, right.trim())]);
  const sql = getDatabase(); await sql`INSERT INTO activity_events (event_name, actor_user_id, organization_id, payload) VALUES ('IntelligenceCompared', ${actor.userId}::uuid, ${actor.organizationId}::uuid, ${sql.json({ dimension, left, right })})`;
  return { dimension, left: leftSide, right: rightSide };
}

export async function relatedIntelligenceMatches(actor: ExchangeServerActor, publicId: string) {
  const current = await requiredRow(actor, publicId); const sql = getDatabase();
  const related = await sql<{ public_id: string; record_type: "rfx" | "resource" | "intelligence" | "capability"; title: string; organization: string; relationship_type: string; metadata: unknown }[]>`
    SELECT er.public_id, er.record_type::text, er.title, o.name AS organization, rel.relationship_type, rel.metadata
    FROM intelligence_relationships rel JOIN exchange_records er ON er.id = rel.related_exchange_record_id JOIN organizations o ON o.id = er.organization_id
    WHERE rel.intelligence_record_id = ${current.intelligence_record_id}::uuid AND er.status = 'active' AND er.record_type IN ('rfx', 'capability')
    ORDER BY er.record_type, er.title
  `;
  return related.map((item) => ({ recordId: item.public_id, lens: item.record_type === "rfx" ? "rfx" : "capabilities", title: item.title, organization: item.organization, reason: item.relationship_type, metadata: item.metadata }));
}
