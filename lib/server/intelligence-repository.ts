import "server-only";
import type { ExchangeRecord } from "@/lib/exchange/contracts";
import type {
  IntelligenceCompareDimension,
  IntelligenceCompareResponse,
  IntelligenceCompareSide,
  IntelligenceDetail,
  IntelligenceInsightInput,
  IntelligenceListResponse,
  IntelligenceMatchCandidate,
  IntelligenceNote,
  IntelligenceReferralInput,
  IntelligenceReferralResult,
  IntelligenceSource,
  IntelligenceSourceType,
} from "@/lib/exchange/intelligence";
import { getDatabase } from "./database";
import { actorCanWriteIntelligence, type ExchangeActor } from "./exchange-session";

export class IntelligenceAuthorizationError extends Error {
  constructor(message = "The active organization is not authorized for this Intelligence action.") {
    super(message);
    this.name = "IntelligenceAuthorizationError";
  }
}

export class IntelligenceNotFoundError extends Error {
  constructor(message = "The Intelligence record was not found.") {
    super(message);
    this.name = "IntelligenceNotFoundError";
  }
}

type Row = Record<string, unknown>;

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : value == null ? fallback : String(value);
}

function asOptionalString(value: unknown) {
  const text = asString(value).trim();
  return text || undefined;
}

function asIso(value: unknown) {
  if (!value) return undefined;
  if (value instanceof Date) return value.toISOString();
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function metadataForRow(row: Row) {
  const metadata: string[] = [];
  const signal = asOptionalString(row.signal_type);
  const observedFrom = asIso(row.observed_from);
  const observedTo = asIso(row.observed_to);
  const sourceLabel = asOptionalString(row.source_label);
  if (signal) metadata.push(signal);
  if (observedFrom || observedTo) metadata.push([observedFrom?.slice(0, 10), observedTo?.slice(0, 10)].filter(Boolean).join(" → "));
  if (Boolean(row.owned_by_viewer)) metadata.push("Owned by you");
  if (sourceLabel) metadata.push(`Source: ${sourceLabel}`);
  if (row.latitude == null || row.longitude == null) metadata.push("Off-map record");
  return metadata;
}

function rowToRecord(row: Row): ExchangeRecord {
  const latitude = row.latitude == null ? undefined : Number(row.latitude);
  const longitude = row.longitude == null ? undefined : Number(row.longitude);
  const signalType = asOptionalString(row.signal_type) ?? "Intelligence";
  const tracked = Boolean(row.tracking_mode);
  return {
    id: asString(row.public_id),
    type: "intelligence",
    title: asString(row.title),
    organization: asString(row.organization_name),
    summary: asString(row.summary),
    geography: asOptionalString(row.geography) ?? "No public location",
    metadata: metadataForRow(row),
    location: latitude != null && longitude != null ? { lat: latitude, lng: longitude } : undefined,
    ownedByViewer: Boolean(row.owned_by_viewer),
    saved: tracked,
    card: {
      eyebrow: signalType,
      media: { kind: "visualization", label: "Intelligence" },
      classifications: [signalType],
      status: { label: tracked ? "Tracking" : "Current", tone: tracked ? "success" : "info" },
      relationships: tracked ? ["following"] : Boolean(row.owned_by_viewer) ? ["owned"] : undefined,
    },
  };
}

function listBaseSql(actor: ExchangeActor, query: string) {
  const sql = getDatabase();
  const like = `%${query.trim()}%`;
  return sql`
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
      AND (
        ${query.trim() === ""}
        OR er.search_document @@ plainto_tsquery('english', ${query})
        OR o.name ILIKE ${like}
        OR COALESCE(er.metadata->>'geography', l.label, '') ILIKE ${like}
        OR COALESCE(ir.signal_type, '') ILIKE ${like}
      )
  `;
}

export async function listIntelligence(actor: ExchangeActor, options: { query?: string; offset?: number; limit?: number } = {}): Promise<IntelligenceListResponse> {
  const sql = getDatabase();
  const query = options.query?.trim() ?? "";
  const offset = Math.max(0, Number(options.offset ?? 0));
  const limit = Math.max(1, Math.min(50, Number(options.limit ?? 24)));
  const base = listBaseSql(actor, query);

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
    ${base}
    ORDER BY er.updated_at DESC, er.public_id ASC
    LIMIT ${limit} OFFSET ${offset}
  `;

  const counts = await sql`
    SELECT
      count(*)::int AS total,
      count(*) FILTER (WHERE l.point IS NOT NULL)::int AS mapped
    ${base}
  `;
  const count = counts[0] as Row | undefined;
  const total = Number(count?.total ?? 0);
  const mapped = Number(count?.mapped ?? 0);
  const nextOffset = offset + rows.length < total ? offset + rows.length : undefined;

  return {
    records: rows.map((row) => rowToRecord(row as Row)),
    total,
    mapped,
    offMap: total - mapped,
    offset,
    limit,
    nextOffset,
  };
}

async function internalRecord(actor: ExchangeActor, publicId: string) {
  const sql = getDatabase();
  const rows = await sql`
    SELECT
      er.id::text AS exchange_record_id,
      er.public_id,
      er.organization_id::text AS organization_id,
      er.title,
      er.summary,
      er.metadata,
      er.location_id::text AS location_id,
      o.name AS organization_name,
      COALESCE(er.metadata->>'geography', l.label, '') AS geography,
      CASE WHEN l.point IS NULL THEN NULL ELSE ST_Y(l.point::geometry) END AS latitude,
      CASE WHEN l.point IS NULL THEN NULL ELSE ST_X(l.point::geometry) END AS longitude,
      er.organization_id = ${actor.organizationId}::uuid AS owned_by_viewer,
      ir.id::text AS intelligence_record_id,
      ir.signal_type,
      ir.observed_from,
      ir.observed_to,
      ir.source_type,
      ir.provenance,
      tracking.tracking_mode,
      tracking.created_at AS tracking_created_at,
      tracking.updated_at AS tracking_updated_at
    FROM exchange_records er
    JOIN intelligence_records ir ON ir.exchange_record_id = er.id
    JOIN organizations o ON o.id = er.organization_id
    LEFT JOIN locations l ON l.id = er.location_id
    LEFT JOIN intelligence_tracking tracking
      ON tracking.intelligence_record_id = ir.id
     AND tracking.user_id = ${actor.userId}::uuid
    WHERE er.public_id = ${publicId}
      AND er.record_type = 'intelligence'
    LIMIT 1
  `;
  const row = rows[0] as Row | undefined;
  if (!row) throw new IntelligenceNotFoundError();
  return row;
}

export async function getIntelligenceDetail(actor: ExchangeActor, publicId: string): Promise<IntelligenceDetail> {
  const sql = getDatabase();
  const row = await internalRecord(actor, publicId);
  const intelligenceRecordId = asString(row.intelligence_record_id);

  const sourceRows = await sql`
    SELECT id::text, source_label, source_type, publisher, source_uri, observed_at, retrieved_at
    FROM intelligence_sources
    WHERE intelligence_record_id = ${intelligenceRecordId}::uuid
    ORDER BY created_at DESC
  `;
  const noteRows = await sql`
    SELECT id::text, body, visibility, author_user_id::text, organization_id::text, created_at, updated_at
    FROM intelligence_notes
    WHERE intelligence_record_id = ${intelligenceRecordId}::uuid
      AND (
        visibility = 'shared'
        OR (visibility = 'organization' AND organization_id = ${actor.organizationId}::uuid)
        OR (visibility = 'personal' AND author_user_id = ${actor.userId}::uuid)
      )
    ORDER BY created_at DESC
  `;
  const capabilityRows = await sql`
    SELECT er.public_id, er.title, er.summary, o.name AS organization_name,
      COALESCE(er.metadata->>'geography', l.label, '') AS geography,
      CASE WHEN l.point IS NULL THEN NULL ELSE ST_Y(l.point::geometry) END AS latitude,
      CASE WHEN l.point IS NULL THEN NULL ELSE ST_X(l.point::geometry) END AS longitude,
      er.organization_id = ${actor.organizationId}::uuid AS owned_by_viewer,
      NULL::text AS signal_type, NULL::timestamptz AS observed_from, NULL::timestamptz AS observed_to,
      NULL::text AS source_label, NULL::text AS tracking_mode
    FROM intelligence_relationships rel
    JOIN exchange_records er ON er.id = rel.related_exchange_record_id
    JOIN organizations o ON o.id = er.organization_id
    LEFT JOIN locations l ON l.id = er.location_id
    WHERE rel.intelligence_record_id = ${intelligenceRecordId}::uuid
      AND er.record_type = 'capability'
    ORDER BY er.title
  `;
  const organizationRows = await sql`
    SELECT DISTINCT o.id::text, o.name
    FROM intelligence_relationships rel
    JOIN organizations o ON o.id = rel.related_organization_id
    WHERE rel.intelligence_record_id = ${intelligenceRecordId}::uuid
    ORDER BY o.name
  `;

  const sources: IntelligenceSource[] = sourceRows.map((item) => {
    const source = item as Row;
    return {
      id: asString(source.id),
      label: asString(source.source_label),
      type: asString(source.source_type) as IntelligenceSourceType,
      publisher: asOptionalString(source.publisher),
      uri: asOptionalString(source.source_uri),
      observedAt: asIso(source.observed_at),
      retrievedAt: asIso(source.retrieved_at),
    };
  });
  const notes: IntelligenceNote[] = noteRows.map((item) => {
    const note = item as Row;
    return {
      id: asString(note.id),
      body: asString(note.body),
      visibility: asString(note.visibility) as IntelligenceNote["visibility"],
      authorUserId: asString(note.author_user_id),
      organizationId: asOptionalString(note.organization_id),
      createdAt: asIso(note.created_at) ?? "",
      updatedAt: asIso(note.updated_at) ?? "",
    };
  });

  return {
    record: rowToRecord({ ...row, source_label: sources[0]?.label }),
    signalType: asOptionalString(row.signal_type) ?? "Intelligence",
    observedFrom: asIso(row.observed_from),
    observedTo: asIso(row.observed_to),
    sourceType: asOptionalString(row.source_type) as IntelligenceSourceType | undefined,
    provenance: row.provenance && typeof row.provenance === "object" ? row.provenance as Record<string, unknown> : {},
    sources,
    notes,
    tracking: {
      active: Boolean(row.tracking_mode),
      mode: asOptionalString(row.tracking_mode) as "track" | "follow" | undefined,
      createdAt: asIso(row.tracking_created_at),
      updatedAt: asIso(row.tracking_updated_at),
    },
    relatedCapabilities: capabilityRows.map((item) => ({ ...rowToRecord(item as Row), type: "capability" as const })),
    relatedOrganizations: organizationRows.map((item) => ({ id: asString((item as Row).id), name: asString((item as Row).name) })),
  };
}

async function resolveOwnedLocation(actor: ExchangeActor, locationId?: string) {
  if (!locationId) return undefined;
  const sql = getDatabase();
  const rows = await sql`
    SELECT id::text
    FROM locations
    WHERE id = ${locationId}::uuid
      AND organization_id = ${actor.organizationId}::uuid
    LIMIT 1
  `;
  if (!rows.length) throw new IntelligenceAuthorizationError("The selected map location does not belong to the active organization.");
  return locationId;
}

function requireWrite(actor: ExchangeActor) {
  if (!actorCanWriteIntelligence(actor)) throw new IntelligenceAuthorizationError();
}

export async function createIntelligence(actor: ExchangeActor, input: IntelligenceInsightInput) {
  requireWrite(actor);
  const sql = getDatabase();
  const locationId = await resolveOwnedLocation(actor, input.locationId);
  const geography = input.geography.trim();
  const publicId = `intel-${crypto.randomUUID()}`;

  await sql.begin(async (tx) => {
    const exchangeRows = await tx`
      INSERT INTO exchange_records (public_id, record_type, organization_id, location_id, title, summary, metadata)
      VALUES (
        ${publicId}, 'intelligence', ${actor.organizationId}::uuid, ${locationId ?? null}::uuid,
        ${input.title.trim()}, ${input.summary.trim()},
        ${tx.json({ geography, sourceLabel: input.sourceLabel.trim() })}
      )
      RETURNING id::text
    `;
    const exchangeRecordId = asString((exchangeRows[0] as Row).id);
    const intelligenceRows = await tx`
      INSERT INTO intelligence_records (exchange_record_id, signal_type, observed_from, observed_to, source_type, provenance)
      VALUES (
        ${exchangeRecordId}::uuid, ${input.signalType.trim()}, ${input.observedFrom || null}::timestamptz,
        ${input.observedTo || null}::timestamptz, ${input.sourceType},
        ${tx.json({ createdByUserId: actor.userId, createdByOrganizationId: actor.organizationId })}
      )
      RETURNING id::text
    `;
    const intelligenceRecordId = asString((intelligenceRows[0] as Row).id);
    if (input.sourceLabel.trim()) {
      await tx`
        INSERT INTO intelligence_sources (intelligence_record_id, source_label, source_type, source_uri, retrieved_at)
        VALUES (${intelligenceRecordId}::uuid, ${input.sourceLabel.trim()}, ${input.sourceType}, ${input.sourceUri?.trim() || null}, now())
      `;
    }
    await tx`
      INSERT INTO activity_events (event_name, actor_user_id, organization_id, exchange_record_id, payload)
      VALUES ('IntelligenceCreated', ${actor.userId}::uuid, ${actor.organizationId}::uuid, ${exchangeRecordId}::uuid, ${tx.json({ publicId })})
    `;
  });

  return getIntelligenceDetail(actor, publicId);
}

export async function updateIntelligence(actor: ExchangeActor, publicId: string, input: IntelligenceInsightInput) {
  requireWrite(actor);
  const current = await internalRecord(actor, publicId);
  if (asString(current.organization_id) !== actor.organizationId) throw new IntelligenceAuthorizationError("Only the owning organization can edit this insight.");
  const locationId = await resolveOwnedLocation(actor, input.locationId);
  const sql = getDatabase();
  const intelligenceRecordId = asString(current.intelligence_record_id);
  const exchangeRecordId = asString(current.exchange_record_id);

  await sql.begin(async (tx) => {
    await tx`
      UPDATE exchange_records
      SET title = ${input.title.trim()}, summary = ${input.summary.trim()}, location_id = ${locationId ?? null}::uuid,
          metadata = ${tx.json({ geography: input.geography.trim(), sourceLabel: input.sourceLabel.trim() })}, updated_at = now()
      WHERE id = ${exchangeRecordId}::uuid
    `;
    await tx`
      UPDATE intelligence_records
      SET signal_type = ${input.signalType.trim()}, observed_from = ${input.observedFrom || null}::timestamptz,
          observed_to = ${input.observedTo || null}::timestamptz, source_type = ${input.sourceType},
          provenance = provenance || ${tx.json({ lastEditedByUserId: actor.userId, lastEditedAt: new Date().toISOString() })}
      WHERE id = ${intelligenceRecordId}::uuid
    `;
    if (input.sourceLabel.trim()) {
      await tx`
        INSERT INTO intelligence_sources (intelligence_record_id, source_label, source_type, source_uri, retrieved_at)
        VALUES (${intelligenceRecordId}::uuid, ${input.sourceLabel.trim()}, ${input.sourceType}, ${input.sourceUri?.trim() || null}, now())
      `;
    }
    await tx`
      INSERT INTO activity_events (event_name, actor_user_id, organization_id, exchange_record_id, payload)
      VALUES ('IntelligenceUpdated', ${actor.userId}::uuid, ${actor.organizationId}::uuid, ${exchangeRecordId}::uuid, ${tx.json({ publicId })})
    `;
  });

  return getIntelligenceDetail(actor, publicId);
}

export async function addIntelligenceNote(actor: ExchangeActor, publicId: string, input: { body: string; visibility: IntelligenceNote["visibility"] }) {
  const current = await internalRecord(actor, publicId);
  const sql = getDatabase();
  const rows = await sql`
    INSERT INTO intelligence_notes (intelligence_record_id, author_user_id, organization_id, visibility, body)
    VALUES (${asString(current.intelligence_record_id)}::uuid, ${actor.userId}::uuid, ${actor.organizationId}::uuid, ${input.visibility}, ${input.body.trim()})
    RETURNING id::text, body, visibility, author_user_id::text, organization_id::text, created_at, updated_at
  `;
  await sql`
    INSERT INTO activity_events (event_name, actor_user_id, organization_id, exchange_record_id, payload)
    VALUES ('IntelligenceNoteAdded', ${actor.userId}::uuid, ${actor.organizationId}::uuid, ${asString(current.exchange_record_id)}::uuid, ${sql.json({ publicId, visibility: input.visibility })})
  `;
  const row = rows[0] as Row;
  return {
    id: asString(row.id), body: asString(row.body), visibility: asString(row.visibility) as IntelligenceNote["visibility"],
    authorUserId: asString(row.author_user_id), organizationId: asOptionalString(row.organization_id),
    createdAt: asIso(row.created_at) ?? "", updatedAt: asIso(row.updated_at) ?? "",
  } satisfies IntelligenceNote;
}

export async function setIntelligenceTracking(actor: ExchangeActor, publicId: string, input: { active: boolean; mode: "track" | "follow" }) {
  const current = await internalRecord(actor, publicId);
  const sql = getDatabase();
  const intelligenceRecordId = asString(current.intelligence_record_id);
  if (input.active) {
    await sql`
      INSERT INTO intelligence_tracking (user_id, intelligence_record_id, organization_id, tracking_mode, updated_at)
      VALUES (${actor.userId}::uuid, ${intelligenceRecordId}::uuid, ${actor.organizationId}::uuid, ${input.mode}, now())
      ON CONFLICT (user_id, intelligence_record_id)
      DO UPDATE SET tracking_mode = EXCLUDED.tracking_mode, organization_id = EXCLUDED.organization_id, updated_at = now()
    `;
  } else {
    await sql`DELETE FROM intelligence_tracking WHERE user_id = ${actor.userId}::uuid AND intelligence_record_id = ${intelligenceRecordId}::uuid`;
  }
  await sql`
    INSERT INTO activity_events (event_name, actor_user_id, organization_id, exchange_record_id, payload)
    VALUES (${input.active ? "IntelligenceTrackingEnabled" : "IntelligenceTrackingDisabled"}, ${actor.userId}::uuid, ${actor.organizationId}::uuid, ${asString(current.exchange_record_id)}::uuid, ${sql.json({ publicId, mode: input.mode })})
  `;
  return getIntelligenceDetail(actor, publicId);
}

async function compareSide(actor: ExchangeActor, dimension: IntelligenceCompareDimension, value: string): Promise<IntelligenceCompareSide> {
  const sql = getDatabase();
  const condition = dimension === "insights"
    ? sql`er.public_id = ${value}`
    : dimension === "organizations"
      ? sql`o.name = ${value}`
      : sql`COALESCE(er.metadata->>'geography', l.label, '') = ${value}`;
  const rows = await sql`
    SELECT er.public_id AS id, er.title, o.name AS organization,
      COALESCE(er.metadata->>'geography', l.label, '') AS geography,
      ir.signal_type, ir.observed_from, ir.observed_to
    FROM exchange_records er
    JOIN intelligence_records ir ON ir.exchange_record_id = er.id
    JOIN organizations o ON o.id = er.organization_id
    LEFT JOIN locations l ON l.id = er.location_id
    WHERE er.record_type = 'intelligence' AND er.status = 'active' AND ${condition}
    ORDER BY er.updated_at DESC
    LIMIT 50
  `;
  void actor;
  return {
    label: value,
    records: rows.map((item) => {
      const row = item as Row;
      return {
        id: asString(row.id), title: asString(row.title), organization: asString(row.organization), geography: asString(row.geography),
        signalType: asOptionalString(row.signal_type), observedFrom: asIso(row.observed_from), observedTo: asIso(row.observed_to),
      };
    }),
  };
}

export async function compareIntelligence(actor: ExchangeActor, dimension: IntelligenceCompareDimension, left: string, right: string): Promise<IntelligenceCompareResponse> {
  const [leftSide, rightSide] = await Promise.all([compareSide(actor, dimension, left), compareSide(actor, dimension, right)]);
  const sql = getDatabase();
  await sql`
    INSERT INTO activity_events (event_name, actor_user_id, organization_id, payload)
    VALUES ('IntelligenceCompared', ${actor.userId}::uuid, ${actor.organizationId}::uuid, ${sql.json({ dimension, left, right })})
  `;
  return { dimension, left: leftSide, right: rightSide };
}

export async function getIntelligenceMatches(actor: ExchangeActor, publicId: string): Promise<IntelligenceMatchCandidate[]> {
  const source = await internalRecord(actor, publicId);
  const sql = getDatabase();
  const queryText = `${asString(source.title)} ${asString(source.summary)} ${asString(source.signal_type)}`.trim();
  const geography = asString(source.geography);
  const rows = await sql`
    SELECT er.public_id, er.record_type, er.title, er.organization_id::text, o.name AS organization_name,
      COALESCE(er.metadata->>'geography', l.label, '') AS geography,
      ts_rank_cd(er.search_document, plainto_tsquery('english', ${queryText})) AS text_rank
    FROM exchange_records er
    JOIN organizations o ON o.id = er.organization_id
    LEFT JOIN locations l ON l.id = er.location_id
    WHERE er.status = 'active'
      AND er.record_type IN ('rfx', 'capability')
      AND (
        er.search_document @@ plainto_tsquery('english', ${queryText})
        OR COALESCE(er.metadata->>'geography', l.label, '') = ${geography}
      )
    ORDER BY
      (COALESCE(er.metadata->>'geography', l.label, '') = ${geography}) DESC,
      text_rank DESC,
      er.updated_at DESC
    LIMIT 12
  `;
  return rows.map((item) => {
    const row = item as Row;
    const sameGeography = asString(row.geography) === geography && geography !== "";
    const rank = Number(row.text_rank ?? 0);
    const reasons = [sameGeography ? "Same Exchange geography" : undefined, rank > 0 ? "Text relevance to the intelligence record" : undefined].filter((item): item is string => Boolean(item));
    return {
      id: asString(row.public_id),
      lens: asString(row.record_type) === "rfx" ? "rfx" : "capabilities",
      title: asString(row.title),
      organizationId: asString(row.organization_id),
      organization: asString(row.organization_name),
      geography: asString(row.geography),
      rank,
      reasons,
    } satisfies IntelligenceMatchCandidate;
  });
}

export async function createIntelligenceReferral(actor: ExchangeActor, publicId: string, input: IntelligenceReferralInput): Promise<IntelligenceReferralResult> {
  const source = await internalRecord(actor, publicId);
  if (input.recipientOrganizationId === actor.organizationId) throw new IntelligenceAuthorizationError("A referral recipient must be a different organization.");
  const sql = getDatabase();
  const recipient = await sql`SELECT id FROM organizations WHERE id = ${input.recipientOrganizationId}::uuid LIMIT 1`;
  if (!recipient.length) throw new IntelligenceNotFoundError("The referral recipient organization was not found.");
  const rows = await sql`
    INSERT INTO referrals (sender_organization_id, recipient_organization_id, exchange_record_id, status, terms)
    VALUES (${actor.organizationId}::uuid, ${input.recipientOrganizationId}::uuid, ${asString(source.exchange_record_id)}::uuid, 'proposed', ${sql.json({ sourceLens: "intelligence", note: input.note?.trim() || null, createdByUserId: actor.userId })})
    RETURNING id::text, status, created_at
  `;
  await sql`
    INSERT INTO activity_events (event_name, actor_user_id, organization_id, exchange_record_id, payload)
    VALUES ('ReferralCreated', ${actor.userId}::uuid, ${actor.organizationId}::uuid, ${asString(source.exchange_record_id)}::uuid, ${sql.json({ sourceLens: "intelligence", recipientOrganizationId: input.recipientOrganizationId })})
  `;
  const row = rows[0] as Row;
  return { referralId: asString(row.id), status: asString(row.status), createdAt: asIso(row.created_at) ?? "" };
}
