import { randomUUID } from "node:crypto";
import type { ExchangeRecord, ResourceProjection } from "@/lib/exchange/contracts";
import type { ResourceDraft, ResourceRequestDraft } from "@/lib/exchange/resources";
import { resourceMetadata } from "@/lib/exchange/resources";
import {
  assertReferralPermission,
  assertResourceManagePermission,
  assertResourceRelationshipPermission,
  ExchangeForbiddenError,
  type ExchangeServerActor,
} from "./actor";
import { getExchangeDatabase } from "./database";

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

export type ResourceRelationshipKind = "saved" | "following";

export interface ResourceShareInput {
  recipientOrganization: string;
  message?: string;
}

export interface ReferralPolicySnapshot {
  recipientOrganizationId: string;
  recipientOrganizationName: string;
  policySummary: string | null;
  feeSummary: string | null;
}

export interface ResourceReferralInput {
  recipientOrganization: string;
  message?: string;
}

type ResourceRow = {
  public_id: string;
  title: string;
  summary: string;
  geography: string | null;
  organization_id: string;
  organization_name: string;
  category: string;
  availability_state: "available" | "limited" | "scheduled";
  availability_label: string;
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
    category: row.category,
    availability: row.availability_state,
    availabilityLabel: row.availability_label,
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
      classifications: [row.category],
      status: { label: row.availability_label, tone: row.availability_state === "available" ? "success" : "info" },
      relationships,
      placement: row.sponsored ? "sponsored" : "organic",
    },
    resource,
  };
}

async function resourceRows(actor: ExchangeServerActor, publicId?: string) {
  const sql = getExchangeDatabase();
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
        SELECT 1 FROM resource_relationships rr
        WHERE rr.user_id = ${actor.userId}::uuid
          AND rr.exchange_record_id = er.id
          AND rr.kind = 'saved'
      ) AS saved,
      EXISTS (
        SELECT 1 FROM resource_relationships rr
        WHERE rr.user_id = ${actor.userId}::uuid
          AND rr.exchange_record_id = er.id
          AND rr.kind = 'following'
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
  const sql = getExchangeDatabase();
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

async function organizationByName(name: string, excludedOrganizationId?: string) {
  const sql = getExchangeDatabase();
  const rows = await sql<{ id: string; name: string }[]>`
    SELECT id::text AS id, name
    FROM organizations
    WHERE lower(name) = lower(${name.trim()})
      AND (${excludedOrganizationId ?? null}::uuid IS NULL OR id <> ${excludedOrganizationId ?? null}::uuid)
    LIMIT 1
  `;
  if (!rows[0]) throw new ExchangeNotFoundError("The receiving organization could not be found.");
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

export async function createResourceOffer(actor: ExchangeServerActor, draft: ResourceDraft): Promise<ExchangeRecord> {
  assertResourceManagePermission(actor);
  const sql = getExchangeDatabase();
  const publicId = `res-${randomUUID()}`;

  await sql.begin(async (tx) => {
    let locationId: string | null = null;
    if (draft.visibility === "public-location") {
      const locations = await tx<{ id: string }[]>`
        SELECT id::text AS id
        FROM locations
        WHERE organization_id = ${actor.organizationId}::uuid
          AND point IS NOT NULL
        ORDER BY created_at
        LIMIT 1
      `;
      locationId = locations[0]?.id ?? null;
    }

    const exchangeRows = await tx<{ id: string }[]>`
      INSERT INTO exchange_records (public_id, record_type, organization_id, location_id, title, summary, metadata)
      VALUES (
        ${publicId},
        'resource',
        ${actor.organizationId}::uuid,
        ${locationId}::uuid,
        ${draft.title.trim()},
        ${draft.summary.trim()},
        jsonb_build_object('geography', ${draft.geography.trim()})
      )
      RETURNING id::text AS id
    `;
    const exchangeRecordId = exchangeRows[0].id;

    await tx`
      INSERT INTO resources (
        exchange_record_id, resource_mode, category, availability_state, availability_label,
        capacity, service_area_label, visibility, terms, status
      ) VALUES (
        ${exchangeRecordId}::uuid, 'offer', ${draft.category.trim()}, ${draft.availability}, ${draft.availabilityLabel},
        ${draft.capacity.trim() || null}, ${draft.serviceArea.trim() || null}, ${draft.visibility}, ${draft.terms.trim() || null}, 'active'
      )
    `;

    await tx`
      INSERT INTO activity_events (event_name, actor_user_id, organization_id, exchange_record_id, payload)
      VALUES ('ResourceOffered', ${actor.userId}::uuid, ${actor.organizationId}::uuid, ${exchangeRecordId}::uuid, jsonb_build_object('publicId', ${publicId}))
    `;
  });

  return getResourceRecord(actor, publicId);
}

export async function updateResourceOffer(actor: ExchangeServerActor, publicId: string, draft: ResourceDraft): Promise<ExchangeRecord> {
  assertResourceManagePermission(actor);
  const identity = await resourceIdentity(publicId);
  if (identity.organization_id !== actor.organizationId) throw new ExchangeForbiddenError("Only the owning organization can edit this Resource.");
  const sql = getExchangeDatabase();

  await sql.begin(async (tx) => {
    let locationId: string | null = null;
    if (draft.visibility === "public-location") {
      const locations = await tx<{ id: string }[]>`
        SELECT id::text AS id FROM locations
        WHERE organization_id = ${actor.organizationId}::uuid AND point IS NOT NULL
        ORDER BY created_at LIMIT 1
      `;
      locationId = locations[0]?.id ?? null;
    }

    await tx`
      UPDATE exchange_records
      SET title = ${draft.title.trim()},
          summary = ${draft.summary.trim()},
          metadata = jsonb_build_object('geography', ${draft.geography.trim()}),
          location_id = ${locationId}::uuid,
          updated_at = now()
      WHERE id = ${identity.exchange_record_id}::uuid
    `;
    await tx`
      UPDATE resources
      SET category = ${draft.category.trim()},
          availability_state = ${draft.availability},
          availability_label = ${draft.availabilityLabel},
          capacity = ${draft.capacity.trim() || null},
          service_area_label = ${draft.serviceArea.trim() || null},
          visibility = ${draft.visibility},
          terms = ${draft.terms.trim() || null},
          updated_at = now()
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
  assertResourceManagePermission(actor);
  const identity = await resourceIdentity(publicId);
  if (identity.organization_id !== actor.organizationId) throw new ExchangeForbiddenError("Only the owning organization can archive this Resource.");
  const sql = getExchangeDatabase();
  await sql.begin(async (tx) => {
    await tx`UPDATE resources SET status = 'archived', updated_at = now() WHERE exchange_record_id = ${identity.exchange_record_id}::uuid`;
    await tx`UPDATE exchange_records SET status = 'archived', updated_at = now() WHERE id = ${identity.exchange_record_id}::uuid`;
    await tx`
      INSERT INTO activity_events (event_name, actor_user_id, organization_id, exchange_record_id)
      VALUES ('ResourceArchived', ${actor.userId}::uuid, ${actor.organizationId}::uuid, ${identity.exchange_record_id}::uuid)
    `;
  });
}

export async function createResourceRequest(actor: ExchangeServerActor, publicId: string, request: ResourceRequestDraft) {
  assertResourceRelationshipPermission(actor);
  const identity = await resourceIdentity(publicId);
  if (identity.organization_id === actor.organizationId) throw new ExchangeConflictError("An organization cannot request its own Resource offer.");
  if (identity.resource_status !== "active") throw new ExchangeConflictError("This Resource is no longer active.");
  const sql = getExchangeDatabase();

  const rows = await sql<{ id: string; status: string; created_at: Date | string }[]>`
    INSERT INTO resource_requests (
      exchange_record_id, requester_organization_id, requester_user_id, scope, needed_by, message, status
    ) VALUES (
      ${identity.exchange_record_id}::uuid,
      ${actor.organizationId}::uuid,
      ${actor.userId}::uuid,
      ${request.scope.trim()},
      ${request.neededBy || null}::date,
      ${request.message.trim()},
      'submitted'
    )
    RETURNING id::text AS id, status, created_at
  `;
  await sql`
    INSERT INTO activity_events (event_name, actor_user_id, organization_id, exchange_record_id, payload)
    VALUES ('ResourceRequested', ${actor.userId}::uuid, ${actor.organizationId}::uuid, ${identity.exchange_record_id}::uuid, jsonb_build_object('requestId', ${rows[0].id}))
  `;
  return rows[0];
}

export async function setResourceRelationship(actor: ExchangeServerActor, publicId: string, kind: ResourceRelationshipKind, active: boolean) {
  assertResourceRelationshipPermission(actor);
  const identity = await resourceIdentity(publicId);
  const sql = getExchangeDatabase();
  if (active) {
    await sql`
      INSERT INTO resource_relationships (user_id, organization_id, exchange_record_id, kind)
      VALUES (${actor.userId}::uuid, ${actor.organizationId}::uuid, ${identity.exchange_record_id}::uuid, ${kind})
      ON CONFLICT (user_id, exchange_record_id, kind) DO UPDATE SET organization_id = EXCLUDED.organization_id, updated_at = now()
    `;
  } else {
    await sql`
      DELETE FROM resource_relationships
      WHERE user_id = ${actor.userId}::uuid AND exchange_record_id = ${identity.exchange_record_id}::uuid AND kind = ${kind}
    `;
  }
  await sql`
    INSERT INTO activity_events (event_name, actor_user_id, organization_id, exchange_record_id, payload)
    VALUES (${active ? "ResourceRelationshipAdded" : "ResourceRelationshipRemoved"}, ${actor.userId}::uuid, ${actor.organizationId}::uuid, ${identity.exchange_record_id}::uuid, jsonb_build_object('kind', ${kind}))
  `;
  return { kind, active };
}

export async function sendResourceShare(actor: ExchangeServerActor, publicId: string, input: ResourceShareInput) {
  assertResourceRelationshipPermission(actor);
  const identity = await resourceIdentity(publicId);
  const recipient = await organizationByName(input.recipientOrganization, actor.organizationId);
  const sql = getExchangeDatabase();
  const rows = await sql<{ id: string; status: string; created_at: Date | string }[]>`
    INSERT INTO resource_shares (exchange_record_id, sender_organization_id, sender_user_id, recipient_organization_id, message, status)
    VALUES (${identity.exchange_record_id}::uuid, ${actor.organizationId}::uuid, ${actor.userId}::uuid, ${recipient.id}::uuid, ${input.message?.trim() || null}, 'sent')
    RETURNING id::text AS id, status, created_at
  `;
  await sql`
    INSERT INTO activity_events (event_name, actor_user_id, organization_id, exchange_record_id, payload)
    VALUES ('ResourceShared', ${actor.userId}::uuid, ${actor.organizationId}::uuid, ${identity.exchange_record_id}::uuid, jsonb_build_object('recipientOrganizationId', ${recipient.id}, 'shareId', ${rows[0].id}))
  `;
  return { ...rows[0], recipientOrganization: recipient.name };
}

export async function getRecipientReferralPolicy(actor: ExchangeServerActor, recipientOrganization: string): Promise<ReferralPolicySnapshot> {
  const recipient = await organizationByName(recipientOrganization, actor.organizationId);
  const sql = getExchangeDatabase();
  const policies = await sql<{ policy_summary: string | null; fee_summary: string | null }[]>`
    SELECT policy_summary, fee_summary
    FROM referral_policies
    WHERE organization_id = ${recipient.id}::uuid AND active = true
    LIMIT 1
  `;
  return {
    recipientOrganizationId: recipient.id,
    recipientOrganizationName: recipient.name,
    policySummary: policies[0]?.policy_summary ?? null,
    feeSummary: policies[0]?.fee_summary ?? null,
  };
}

export async function createResourceReferral(actor: ExchangeServerActor, publicId: string, input: ResourceReferralInput) {
  assertReferralPermission(actor);
  const identity = await resourceIdentity(publicId);
  const policy = await getRecipientReferralPolicy(actor, input.recipientOrganization);
  const sql = getExchangeDatabase();
  const rows = await sql<{ id: string; status: string; created_at: Date | string }[]>`
    INSERT INTO referrals (
      sender_organization_id, recipient_organization_id, actor_user_id, exchange_record_id,
      status, message, policy_snapshot, fee_snapshot
    ) VALUES (
      ${actor.organizationId}::uuid,
      ${policy.recipientOrganizationId}::uuid,
      ${actor.userId}::uuid,
      ${identity.exchange_record_id}::uuid,
      'proposed',
      ${input.message?.trim() || null},
      ${policy.policySummary ? JSON.stringify({ summary: policy.policySummary }) : null}::jsonb,
      ${policy.feeSummary ? JSON.stringify({ summary: policy.feeSummary }) : null}::jsonb
    )
    RETURNING id::text AS id, status, created_at
  `;
  await sql`
    INSERT INTO activity_events (event_name, actor_user_id, organization_id, exchange_record_id, payload)
    VALUES ('ReferralCreated', ${actor.userId}::uuid, ${actor.organizationId}::uuid, ${identity.exchange_record_id}::uuid, jsonb_build_object('referralId', ${rows[0].id}, 'recipientOrganizationId', ${policy.recipientOrganizationId}))
  `;
  return { ...rows[0], policy };
}
