import type { PoolClient } from "pg";
import type { ExchangeRecord } from "@/lib/exchange/contracts";
import type { ResourceDraft, ResourceRequestDraft } from "@/lib/exchange/resources";
import type { ServerActorContext } from "./actor-context";
import { withDatabaseTransaction } from "./postgres";

export class ExchangeDomainValidationError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 422) {
    super(message);
    this.name = "ExchangeDomainValidationError";
    this.statusCode = statusCode;
  }
}

type ResourceRow = { exchange_record_id: string; resource_id: string; organization_id: string; public_id: string; title: string };
type IntelligenceRow = { exchange_record_id: string; intelligence_record_id: string; organization_id: string; public_id: string; title: string };

async function resourceByPublicId(client: PoolClient, publicId: string) {
  const result = await client.query<ResourceRow>(
    `SELECT er.id AS exchange_record_id, r.id AS resource_id, er.organization_id, er.public_id, er.title
       FROM exchange_records er JOIN resources r ON r.exchange_record_id = er.id
      WHERE er.public_id = $1 AND er.record_type = 'resource' LIMIT 1`, [publicId]);
  return result.rows[0];
}

async function intelligenceByPublicId(client: PoolClient, publicId: string) {
  const result = await client.query<IntelligenceRow>(
    `SELECT er.id AS exchange_record_id, ir.id AS intelligence_record_id, er.organization_id, er.public_id, er.title
       FROM exchange_records er JOIN intelligence_records ir ON ir.exchange_record_id = er.id
      WHERE er.public_id = $1 AND er.record_type = 'intelligence' LIMIT 1`, [publicId]);
  return result.rows[0];
}

async function event(client: PoolClient, actor: ServerActorContext, eventName: string, exchangeRecordId: string, payload: Record<string, unknown> = {}) {
  await client.query(
    `INSERT INTO activity_events (event_name, actor_user_id, organization_id, exchange_record_id, payload)
     VALUES ($1, $2::uuid, $3::uuid, $4::uuid, $5::jsonb)`,
    [eventName, actor.userId, actor.organizationId, exchangeRecordId, JSON.stringify(payload)],
  );
}

function resourceServiceArea(draft: ResourceDraft) {
  return draft.serviceArea.trim() || draft.geography.trim() || undefined;
}

export async function createResourceOffer(actor: ServerActorContext, draft: ResourceDraft) {
  if (!draft.title.trim() || !draft.summary.trim() || !draft.category.trim()) throw new ExchangeDomainValidationError("Resource title, summary, and category are required.");
  return withDatabaseTransaction(async (client) => {
    const record = await client.query<{ id: string; public_id: string }>(
      `INSERT INTO exchange_records (public_id, record_type, organization_id, title, summary, status, metadata)
       VALUES ('res-' || substring(replace(gen_random_uuid()::text, '-', '') from 1 for 12), 'resource', $1::uuid, $2, $3, 'active', $4::jsonb)
       RETURNING id, public_id`,
      [actor.organizationId, draft.title.trim(), draft.summary.trim(), JSON.stringify([draft.category, draft.availabilityLabel, draft.geography].filter(Boolean))],
    );
    await client.query(
      `INSERT INTO resources (exchange_record_id, resource_mode, availability, category, capacity, visibility, terms)
       VALUES ($1::uuid, 'offer', $2::jsonb, $3, $4::jsonb, $5, $6::jsonb)`,
      [record.rows[0].id, JSON.stringify({ state: draft.availability, label: draft.availabilityLabel, serviceArea: resourceServiceArea(draft) }), draft.category.trim(), JSON.stringify({ label: draft.capacity || undefined }), draft.visibility, JSON.stringify({ text: draft.terms || undefined })],
    );
    await event(client, actor, "ResourceOffered", record.rows[0].id, { geography: draft.geography, visibility: draft.visibility });
    return { recordId: record.rows[0].public_id, message: "Resource offer published." };
  });
}

export async function updateResourceOffer(actor: ServerActorContext, recordId: string, draft: ResourceDraft) {
  return withDatabaseTransaction(async (client) => {
    const resource = await resourceByPublicId(client, recordId);
    if (!resource) throw new ExchangeDomainValidationError("Resource not found.", 404);
    if (resource.organization_id !== actor.organizationId) throw new ExchangeDomainValidationError("Only the owning organization may edit this resource.", 403);
    await client.query(`UPDATE exchange_records SET title = $2, summary = $3, metadata = $4::jsonb, updated_at = now() WHERE id = $1::uuid`, [resource.exchange_record_id, draft.title.trim(), draft.summary.trim(), JSON.stringify([draft.category, draft.availabilityLabel, draft.geography].filter(Boolean))]);
    await client.query(
      `UPDATE resources SET availability = $2::jsonb, category = $3, capacity = $4::jsonb, visibility = $5, terms = $6::jsonb WHERE id = $1::uuid`,
      [resource.resource_id, JSON.stringify({ state: draft.availability, label: draft.availabilityLabel, serviceArea: resourceServiceArea(draft) }), draft.category.trim(), JSON.stringify({ label: draft.capacity || undefined }), draft.visibility, JSON.stringify({ text: draft.terms || undefined })],
    );
    await event(client, actor, "ResourceUpdated", resource.exchange_record_id);
    return { recordId, message: "Resource changes saved." };
  });
}

export async function createResourceRequest(actor: ServerActorContext, recordId: string, draft: ResourceRequestDraft) {
  return withDatabaseTransaction(async (client) => {
    const resource = await resourceByPublicId(client, recordId);
    if (!resource) throw new ExchangeDomainValidationError("Resource not found.", 404);
    if (resource.organization_id === actor.organizationId) throw new ExchangeDomainValidationError("Use resource management for your own resource instead of requesting it.");
    await client.query(
      `INSERT INTO resource_requests (resource_id, requester_organization_id, provider_organization_id, requester_user_id, request_details)
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::jsonb)`,
      [resource.resource_id, actor.organizationId, resource.organization_id, actor.userId, JSON.stringify(draft)],
    );
    await event(client, actor, "ResourceRequested", resource.exchange_record_id, { neededBy: draft.neededBy || undefined });
    return { recordId, message: "Resource request created." };
  });
}

export async function archiveResourceOffer(actor: ServerActorContext, recordId: string) {
  return withDatabaseTransaction(async (client) => {
    const resource = await resourceByPublicId(client, recordId);
    if (!resource) throw new ExchangeDomainValidationError("Resource not found.", 404);
    if (resource.organization_id !== actor.organizationId) throw new ExchangeDomainValidationError("Only the owning organization may archive this resource.", 403);
    await client.query(`UPDATE resources SET archived_at = now() WHERE id = $1::uuid`, [resource.resource_id]);
    await client.query(`UPDATE exchange_records SET status = 'archived', updated_at = now() WHERE id = $1::uuid`, [resource.exchange_record_id]);
    await event(client, actor, "ResourceArchived", resource.exchange_record_id);
    return { recordId, message: "Resource archived." };
  });
}

export async function createIntelligenceRecord(actor: ServerActorContext, record: ExchangeRecord) {
  if (!record.title.trim() || !record.summary.trim()) throw new ExchangeDomainValidationError("Insight title and summary are required.");
  return withDatabaseTransaction(async (client) => {
    const created = await client.query<{ id: string; public_id: string }>(
      `INSERT INTO exchange_records (public_id, record_type, organization_id, title, summary, status, metadata)
       VALUES ('intel-' || substring(replace(gen_random_uuid()::text, '-', '') from 1 for 12), 'intelligence', $1::uuid, $2, $3, 'active', $4::jsonb)
       RETURNING id, public_id`,
      [actor.organizationId, record.title.trim(), record.summary.trim(), JSON.stringify(record.metadata)],
    );
    await client.query(`INSERT INTO intelligence_records (exchange_record_id, signal_type, observed_at, source_context, source_type, provenance) VALUES ($1::uuid, $2, now(), $3::jsonb, 'participant-observation', $4::jsonb)`, [created.rows[0].id, record.metadata[0] ?? null, JSON.stringify({ geography: record.geography }), JSON.stringify({ contributedByUserId: actor.userId })]);
    await event(client, actor, "IntelligenceAdded", created.rows[0].id);
    return { recordId: created.rows[0].public_id, message: "Insight added." };
  });
}

export async function updateIntelligenceRecord(actor: ServerActorContext, record: ExchangeRecord) {
  return withDatabaseTransaction(async (client) => {
    const intelligence = await intelligenceByPublicId(client, record.id);
    if (!intelligence) throw new ExchangeDomainValidationError("Intelligence record not found.", 404);
    if (intelligence.organization_id !== actor.organizationId) throw new ExchangeDomainValidationError("Only the owning organization may edit this insight.", 403);
    await client.query(`UPDATE exchange_records SET title = $2, summary = $3, metadata = $4::jsonb, updated_at = now() WHERE id = $1::uuid`, [intelligence.exchange_record_id, record.title.trim(), record.summary.trim(), JSON.stringify(record.metadata)]);
    await event(client, actor, "IntelligenceUpdated", intelligence.exchange_record_id);
    return { recordId: record.id, message: "Insight updated." };
  });
}

export async function addIntelligenceNote(actor: ServerActorContext, recordId: string, note: string) {
  if (!note.trim()) throw new ExchangeDomainValidationError("Note text is required.");
  return withDatabaseTransaction(async (client) => {
    const intelligence = await intelligenceByPublicId(client, recordId);
    if (!intelligence) throw new ExchangeDomainValidationError("Intelligence record not found.", 404);
    await client.query(
      `INSERT INTO intelligence_notes (intelligence_record_id, author_user_id, organization_id, body)
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4)`,
      [intelligence.intelligence_record_id, actor.userId, actor.organizationId, note.trim()],
    );
    await event(client, actor, "IntelligenceNoteAdded", intelligence.exchange_record_id);
    return { recordId, message: "Note added." };
  });
}
