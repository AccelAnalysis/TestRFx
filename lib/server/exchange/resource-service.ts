import { randomUUID } from "node:crypto";
import type { ExchangeRecord, ResourceProjection } from "@/lib/exchange/contracts";
import type { ResourceDraft, ResourceRequestDraft } from "@/lib/exchange/resources";
import { resourceMetadata } from "@/lib/exchange/resources";
import { getDatabase } from "@/lib/server/database";
import {
  assertExchangeWrite,
  ExchangeForbiddenError,
  type ExchangeServerActor,
} from "@/lib/server/exchange/actor";

export class ExchangeNotFoundError extends Error {
  constructor(message = "The requested Exchange record was not found.") {
    super(message);
    this.name = "ExchangeNotFoundError";
  }
}

export class ExchangeConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExchangeConflictError";
  }
}

type ResourceRow = {
  public_id: string;
  title: string;
  summary: string;
  geography: string | null;
  organization_id: string;
  organization_name: string;
  category: string | null;
  availability_state: "available" | "limited" | "scheduled" | null;
  availability_label: string | null;
  capacity: string | null;
  service_area_label: string | null;
  visibility: "public-location" | "service-area" | "off-map";
  terms: string | null;
  resource_status: "active" | "archived";
  sponsored: boolean;
  lat: number | string | null;
  lng: number | string | null;
  saved: boolean;
  following: boolean;
};

type ResourceIdentity = {
  exchange_record_id: string;
  public_id: string;
  title: string;
  organization_id: string;
  organization_name: string;
  resource_status: "active" | "archived";
};

function toExchangeRecord(row: ResourceRow, actor: ExchangeServerActor): ExchangeRecord {
  const resource: ResourceProjection = {
    category: row.category ?? "Resource",
    availability: row.availability_state ?? "unknown",
    availabilityLabel: row.availability_label ?? "Availability not published",
    capacity: row.capacity ?? undefined,
    serviceArea: row.service_area_label ?? undefined,
    visibility: row.visibility,
    terms: row.terms ?? undefined,
    status: row.resource_status,
    sponsored: row.sponsored,
  };
  const relationships: ("saved" | "following" | "owned")[] = [];
  if (row.saved) relationships.push("saved");
  if (row.following) relationships.push("following");
  if (row.organization_id === actor.organizationId) relationships.push("owned");

  return {
    id: row.public_id,
    type: "resource",
    title: row.title,
    organization: row.organization_name,
    summary: row.summary,
    geography: row.geography ?? row.service_area_label ?? "",
    metadata: resourceMetadata(resource),
    location: row.lat !== null && row.lng !== null ? { lat: Number(row.lat), lng: Number(row.lng) } : undefined,
    ownedByViewer: row.organization_id === actor.organizationId,
    saved: row.saved,
    featured: row.sponsored,
    card: {
      eyebrow: "Resource Offer",
      classifications: [resource.category],
      status: { label: resource.availabilityLabel, tone: resource.availability === "available" ? "success" : "info" },
      relationships,
      placement: row.sponsored ? "sponsored" : "organic",
    },
    resource,
  };
}

async function resourceRows(actor: ExchangeServerActor, publicId?: string) {
  const sql = getDatabase();
  return sql<ResourceRow[]>`
    SELECT
      er.public_id,
      er.title,
      er.summary,
      er.metadata ->> 'geography' AS geography,
      er.organization_id::text AS organization_id,
      o.name AS organization_name,
      r.category,
      r.availability_state,
      r.availability_label,
      r.capacity,
      r.service_area_label,
      r.visibility,
      r.terms,
      r.status AS resource_status,
      r.sponsored,
      CASE WHEN l.point IS NULL THEN NULL ELSE ST_Y(l.point::geometry) END AS lat,
      CASE WHEN l.point IS NULL THEN NULL ELSE ST_X(l.point::geometry) END AS lng,
      EXISTS (
        SELECT 1 FROM record_relationships rr
        WHERE rr.user_id = ${actor.userId}::uuid
          AND rr.exchange_record_id = er.id
          AND rr.relationship_kind = 'saved'
      ) AS saved,
      EXISTS (
        SELECT 1 FROM record_relationships rr
        WHERE rr.user_id = ${actor.userId}::uuid
          AND rr.exchange_record_id = er.id
          AND rr.relationship_kind = 'following'
      ) AS following
    FROM exchange_records er
    JOIN organizations o ON o.id = er.organization_id
    JOIN resources r ON r.exchange_record_id = er.id
    LEFT JOIN locations l ON l.id = er.location_id
    WHERE er.record_type = 'resource'
      AND (${publicId ?? null}::text IS NULL OR er.public_id = ${publicId ?? null})
    ORDER BY r.sponsored DESC, er.updated_at DESC, er.title
  `;
}

async function resourceIdentity(publicId: string): Promise<ResourceIdentity> {
  const sql = getDatabase();
  const rows = await sql<ResourceIdentity[]>`
    SELECT
      er.id::text AS exchange_record_id,
      er.public_id,
      er.title,
      er.organization_id::text AS organization_id,
      o.name AS organization_name,
      r.status AS resource_status
    FROM exchange_records er
    JOIN organizations o ON o.id = er.organization_id
    JOIN resources r ON r.exchange_record_id = er.id
    WHERE er.public_id = ${publicId}
      AND er.record_type = 'resource'
    LIMIT 1
  `;
  if (!rows[0]) throw new ExchangeNotFoundError("The Resource record was not found.");
  return rows[0];
}

export async function listResourceRecords(actor: ExchangeServerActor): Promise<ExchangeRecord[]> {
  const rows = await resourceRows(actor);
  return rows.filter((row) => row.resource_status === "active").map((row) => toExchangeRecord(row, actor));
}

export async function getResourceRecord(actor: ExchangeServerActor, publicId: string): Promise<ExchangeRecord> {
  const rows = await resourceRows(actor, publicId);
  if (!rows[0]) throw new ExchangeNotFoundError("The Resource record was not found.");
  return toExchangeRecord(rows[0], actor);
}

async function firstPublishableLocationId(actor: ExchangeServerActor, visibility: ResourceDraft["visibility"]) {
  if (visibility !== "public-location") return null;
  const sql = getDatabase();
  const rows = await sql<{ id: string }[]>`
    SELECT id::text AS id
    FROM locations
    WHERE organization_id = ${actor.organizationId}::uuid
      AND point IS NOT NULL
    ORDER BY CASE WHEN COALESCE((address ->> 'isPrimary')::boolean, false) THEN 0 ELSE 1 END, created_at
    LIMIT 1
  `;
  return rows[0]?.id ?? null;
}

export async function createResourceOffer(actor: ExchangeServerActor, draft: ResourceDraft): Promise<ExchangeRecord> {
  assertExchangeWrite(actor, "resources:write");
  const sql = getDatabase();
  const publicId = `res-${randomUUID()}`;
  const locationId = await firstPublishableLocationId(actor, draft.visibility);

  await sql.begin(async (tx) => {
    const exchangeRows = await tx<{ id: string }[]>`
      INSERT INTO exchange_records (public_id, record_type, organization_id, location_id, title, summary, metadata)
      VALUES (
        ${publicId}, 'resource', ${actor.organizationId}::uuid, ${locationId}::uuid,
        ${draft.title}, ${draft.summary}, ${tx.json({ geography: draft.geography })}
      )
      RETURNING id::text AS id
    `;
    const exchangeRecordId = exchangeRows[0]?.id;
    if (!exchangeRecordId) throw new Error("Resource offer could not be created.");

    await tx`
      INSERT INTO resources (
        exchange_record_id, resource_mode, category, availability_state, availability_label,
        capacity, service_area_label, visibility, terms, status
      ) VALUES (
        ${exchangeRecordId}::uuid, 'offer', ${draft.category}, ${draft.availability}, ${draft.availabilityLabel},
        ${draft.capacity || null}, ${draft.serviceArea || null}, ${draft.visibility}, ${draft.terms || null}, 'active'
      )
    `;
    await tx`
      INSERT INTO activity_events (event_name, actor_user_id, organization_id, exchange_record_id, payload)
      VALUES ('ResourceOffered', ${actor.userId}::uuid, ${actor.organizationId}::uuid, ${exchangeRecordId}::uuid, ${tx.json({ publicId })})
    `;
  });

  return getResourceRecord(actor, publicId);
}

export async function updateResourceOffer(actor: ExchangeServerActor, publicId: string, draft: ResourceDraft): Promise<ExchangeRecord> {
  assertExchangeWrite(actor, "resources:write");
  const identity = await resourceIdentity(publicId);
  if (identity.organization_id !== actor.organizationId) throw new ExchangeForbiddenError("Only the owning organization can edit this Resource.");
  const sql = getDatabase();
  const locationId = await firstPublishableLocationId(actor, draft.visibility);

  await sql.begin(async (tx) => {
    await tx`
      UPDATE exchange_records
      SET title = ${draft.title}, summary = ${draft.summary}, metadata = ${tx.json({ geography: draft.geography })},
          location_id = ${locationId}::uuid, updated_at = now()
      WHERE id = ${identity.exchange_record_id}::uuid
    `;
    await tx`
      UPDATE resources
      SET category = ${draft.category}, availability_state = ${draft.availability}, availability_label = ${draft.availabilityLabel},
          capacity = ${draft.capacity || null}, service_area_label = ${draft.serviceArea || null}, visibility = ${draft.visibility},
          terms = ${draft.terms || null}, updated_at = now()
      WHERE exchange_record_id = ${identity.exchange_record_id}::uuid
    `;
    await tx`
      INSERT INTO activity_events (event_name, actor_user_id, organization_id, exchange_record_id)
      VALUES ('ResourceUpdated', ${actor.userId}::uuid, ${actor.organizationId}::uuid, ${identity.exchange_record_id}::uuid)
    `;
  });

  return getResourceRecord(actor, publicId);
}

export async function archiveResourceOffer(actor: ExchangeServerActor, publicId: string) {
  assertExchangeWrite(actor, "resources:write");
  const identity = await resourceIdentity(publicId);
  if (identity.organization_id !== actor.organizationId) throw new ExchangeForbiddenError("Only the owning organization can archive this Resource.");
  const sql = getDatabase();
  await sql.begin(async (tx) => {
    await tx`UPDATE resources SET status = 'archived', updated_at = now() WHERE exchange_record_id = ${identity.exchange_record_id}::uuid`;
    await tx`UPDATE exchange_records SET status = 'archived', updated_at = now() WHERE id = ${identity.exchange_record_id}::uuid`;
    await tx`
      INSERT INTO activity_events (event_name, actor_user_id, organization_id, exchange_record_id)
      VALUES ('ResourceArchived', ${actor.userId}::uuid, ${actor.organizationId}::uuid, ${identity.exchange_record_id}::uuid)
    `;
  });
  return { recordId: publicId, status: "archived" as const };
}

export async function createResourceRequest(actor: ExchangeServerActor, publicId: string, request: ResourceRequestDraft) {
  const identity = await resourceIdentity(publicId);
  if (identity.organization_id === actor.organizationId) throw new ExchangeConflictError("An organization cannot request its own Resource offer.");
  if (identity.resource_status !== "active") throw new ExchangeConflictError("This Resource is no longer active.");
  const sql = getDatabase();

  const rows = await sql<{ id: string; status: string; created_at: Date }[]>`
    INSERT INTO resource_requests (
      exchange_record_id, requester_organization_id, requester_user_id, scope, needed_by, message, status
    ) VALUES (
      ${identity.exchange_record_id}::uuid, ${actor.organizationId}::uuid, ${actor.userId}::uuid,
      ${request.scope}, ${request.neededBy || null}::date, ${request.message}, 'submitted'
    )
    RETURNING id::text, status, created_at
  `;
  const created = rows[0];
  if (!created) throw new Error("Resource request could not be created.");
  await sql`
    INSERT INTO activity_events (event_name, actor_user_id, organization_id, exchange_record_id, payload)
    VALUES ('ResourceRequested', ${actor.userId}::uuid, ${actor.organizationId}::uuid, ${identity.exchange_record_id}::uuid, ${sql.json({ requestId: created.id })})
  `;
  return { id: created.id, status: created.status, createdAt: created.created_at.toISOString() };
}

export async function sendResourceToOrganization(actor: ExchangeServerActor, publicId: string, input: { recipientOrganizationId: string; message?: string }) {
  const identity = await resourceIdentity(publicId);
  if (input.recipientOrganizationId === actor.organizationId) throw new ExchangeConflictError("Choose a different receiving organization.");
  const sql = getDatabase();
  const recipientRows = await sql<{ id: string; name: string }[]>`
    SELECT id::text, name FROM organizations WHERE id = ${input.recipientOrganizationId}::uuid LIMIT 1
  `;
  const recipient = recipientRows[0];
  if (!recipient) throw new ExchangeNotFoundError("The receiving organization could not be found.");

  const rows = await sql<{ id: string; status: string; created_at: Date }[]>`
    INSERT INTO resource_shares (exchange_record_id, sender_organization_id, sender_user_id, recipient_organization_id, message, status)
    VALUES (
      ${identity.exchange_record_id}::uuid, ${actor.organizationId}::uuid, ${actor.userId}::uuid,
      ${recipient.id}::uuid, ${input.message?.trim() || null}, 'sent'
    )
    RETURNING id::text, status, created_at
  `;
  const share = rows[0];
  if (!share) throw new Error("Resource share could not be created.");
  await sql`
    INSERT INTO activity_events (event_name, actor_user_id, organization_id, exchange_record_id, payload)
    VALUES ('ResourceSentToOrganization', ${actor.userId}::uuid, ${actor.organizationId}::uuid, ${identity.exchange_record_id}::uuid, ${sql.json({ shareId: share.id, recipientOrganizationId: recipient.id })})
  `;
  return { id: share.id, status: share.status, createdAt: share.created_at.toISOString(), recipientOrganization: recipient };
}
