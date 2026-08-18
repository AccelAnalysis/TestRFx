import { randomUUID } from "node:crypto";
import type { ExchangeActor } from "./exchange-actor";
import { withTransaction } from "./database";

export type DomainWorkflowAction = "offer-resource" | "edit-resource" | "request-resource" | "archive-resource" | "add-insight" | "edit-insight" | "add-note";

export interface DomainWorkflowInput {
  action: DomainWorkflowAction;
  actor: ExchangeActor;
  recordId?: string;
  payload: Record<string, unknown>;
}

function text(value: unknown, field: string, required = false) {
  const result = typeof value === "string" ? value.trim() : "";
  if (required && !result) throw new Error(`${field} is required.`);
  return result || undefined;
}

async function ownedRecord(client: Parameters<Parameters<typeof withTransaction>[0]>[0], publicId: string, actor: ExchangeActor, type: string) {
  const result = await client.query<{ id: string; domain_id: string; organization_id: string }>(`
    SELECT er.id::text, er.organization_id::text,
      CASE
        WHEN $3 = 'resource' THEN res.id::text
        WHEN $3 = 'intelligence' THEN ir.id::text
      END AS domain_id
    FROM exchange_records er
    LEFT JOIN resources res ON res.exchange_record_id = er.id
    LEFT JOIN intelligence_records ir ON ir.exchange_record_id = er.id
    WHERE er.public_id = $1 AND er.record_type::text = $3
      AND er.organization_id = $2::uuid
    LIMIT 1
  `, [publicId, actor.organizationId, type]);
  const row = result.rows[0];
  if (!row?.domain_id) throw new Error("Record not found or not manageable by the active organization.");
  return row;
}

export async function executeDomainWorkflow(input: DomainWorkflowInput) {
  return withTransaction(async (client) => {
    const { action, actor, payload } = input;
    let recordId = input.recordId;
    let exchangeRecordUuid: string | undefined;
    let result: Record<string, unknown> = {};

    if (action === "offer-resource") {
      const publicId = `res-${randomUUID()}`;
      const title = text(payload.title, "Resource title", true)!;
      const summary = text(payload.summary, "Description", true)!;
      const geography = text(payload.geography, "Geography", true)!;
      const category = text(payload.category, "Category", true)!;
      const visibility = text(payload.visibility, "Visibility") ?? "public-location";
      const location = visibility === "public-location"
        ? await client.query<{ id: string }>("SELECT id::text FROM locations WHERE organization_id = $1 ORDER BY created_at LIMIT 1", [actor.organizationId])
        : { rows: [] as { id: string }[] };
      const exchange = await client.query<{ id: string }>(`
        INSERT INTO exchange_records (public_id, record_type, organization_id, location_id, title, summary, status, metadata)
        VALUES ($1, 'resource', $2, $3, $4, $5, 'active', $6::jsonb)
        RETURNING id::text
      `, [publicId, actor.organizationId, location.rows[0]?.id ?? null, title, summary, JSON.stringify({ geography, classifications: [category], serviceArea: text(payload.serviceArea, "Service area") })]);
      exchangeRecordUuid = exchange.rows[0].id;
      await client.query(`
        INSERT INTO resources (exchange_record_id, resource_mode, availability, category, capacity, visibility, terms)
        VALUES ($1, 'offer', $2::jsonb, $3, $4::jsonb, $5, $6::jsonb)
      `, [exchangeRecordUuid, JSON.stringify({ state: text(payload.availability, "Availability") ?? "available", label: text(payload.availabilityLabel, "Availability label") ?? "Available now" }), category, JSON.stringify({ label: text(payload.capacity, "Capacity") }), visibility, JSON.stringify({ label: text(payload.terms, "Terms") })]);
      recordId = publicId;
      result = { recordId: publicId, status: "active" };
    }

    if (action === "edit-resource") {
      if (!recordId) throw new Error("recordId is required.");
      const owned = await ownedRecord(client, recordId, actor, "resource");
      exchangeRecordUuid = owned.id;
      const title = text(payload.title, "Resource title", true)!;
      const summary = text(payload.summary, "Description", true)!;
      const geography = text(payload.geography, "Geography", true)!;
      const category = text(payload.category, "Category", true)!;
      const visibility = text(payload.visibility, "Visibility") ?? "public-location";
      await client.query(`UPDATE exchange_records SET title = $2, summary = $3, metadata = metadata || $4::jsonb, updated_at = now() WHERE id = $1`, [owned.id, title, summary, JSON.stringify({ geography, classifications: [category], serviceArea: text(payload.serviceArea, "Service area") })]);
      await client.query(`UPDATE resources SET category = $2, availability = $3::jsonb, capacity = $4::jsonb, visibility = $5, terms = $6::jsonb WHERE id = $1`, [owned.domain_id, category, JSON.stringify({ state: text(payload.availability, "Availability") ?? "available", label: text(payload.availabilityLabel, "Availability label") ?? "Available now" }), JSON.stringify({ label: text(payload.capacity, "Capacity") }), visibility, JSON.stringify({ label: text(payload.terms, "Terms") })]);
      result = { recordId, status: "updated" };
    }

    if (action === "request-resource") {
      if (!recordId) throw new Error("recordId is required.");
      const record = await client.query<{ exchange_record_id: string; resource_id: string; provider_organization_id: string }>(`
        SELECT er.id::text AS exchange_record_id, res.id::text AS resource_id, er.organization_id::text AS provider_organization_id
        FROM exchange_records er JOIN resources res ON res.exchange_record_id = er.id
        WHERE er.public_id = $1 AND res.archived_at IS NULL LIMIT 1
      `, [recordId]);
      const target = record.rows[0];
      if (!target) throw new Error("Active resource not found.");
      exchangeRecordUuid = target.exchange_record_id;
      const request = await client.query<{ id: string }>(`
        INSERT INTO resource_requests (resource_id, requester_organization_id, provider_organization_id, requester_user_id, request_details)
        VALUES ($1, $2, $3, $4, $5::jsonb)
        RETURNING id::text
      `, [target.resource_id, actor.organizationId, target.provider_organization_id, actor.userId, JSON.stringify({ scope: text(payload.scope, "Requested scope", true), neededBy: text(payload.neededBy, "Needed by"), message: text(payload.message, "Message", true) })]);
      result = { requestId: request.rows[0].id, status: "requested" };
    }

    if (action === "archive-resource") {
      if (!recordId) throw new Error("recordId is required.");
      const owned = await ownedRecord(client, recordId, actor, "resource");
      exchangeRecordUuid = owned.id;
      await client.query("UPDATE resources SET archived_at = now() WHERE id = $1", [owned.domain_id]);
      await client.query("UPDATE exchange_records SET status = 'archived', updated_at = now() WHERE id = $1", [owned.id]);
      result = { recordId, status: "archived" };
    }

    if (action === "add-insight") {
      const publicId = `intel-${randomUUID()}`;
      const title = text(payload.title, "Insight title", true)!;
      const summary = text(payload.summary, "Summary", true)!;
      const geography = text(payload.geography, "Geography", true)!;
      const signalType = text(payload.signalType, "Signal type", true)!;
      const exchange = await client.query<{ id: string }>(`
        INSERT INTO exchange_records (public_id, record_type, organization_id, title, summary, status, metadata)
        VALUES ($1, 'intelligence', $2, $3, $4, 'active', $5::jsonb)
        RETURNING id::text
      `, [publicId, actor.organizationId, title, summary, JSON.stringify({ geography, classifications: [signalType] })]);
      exchangeRecordUuid = exchange.rows[0].id;
      await client.query(`
        INSERT INTO intelligence_records (exchange_record_id, signal_type, observed_at, source_context, source_type, provenance)
        VALUES ($1, $2, now(), $3::jsonb, 'participant-observation', $4::jsonb)
      `, [exchangeRecordUuid, signalType, JSON.stringify({ observedPeriod: text(payload.observedPeriod, "Observed period"), sourceLabel: text(payload.sourceLabel, "Source label", true) }), JSON.stringify({ contributorUserId: actor.userId, contributorOrganizationId: actor.organizationId })]);
      recordId = publicId;
      result = { recordId: publicId, status: "active" };
    }

    if (action === "edit-insight") {
      if (!recordId) throw new Error("recordId is required.");
      const owned = await ownedRecord(client, recordId, actor, "intelligence");
      exchangeRecordUuid = owned.id;
      const title = text(payload.title, "Insight title", true)!;
      const summary = text(payload.summary, "Summary", true)!;
      const geography = text(payload.geography, "Geography", true)!;
      const signalType = text(payload.signalType, "Signal type", true)!;
      await client.query("UPDATE exchange_records SET title = $2, summary = $3, metadata = metadata || $4::jsonb, updated_at = now() WHERE id = $1", [owned.id, title, summary, JSON.stringify({ geography, classifications: [signalType] })]);
      await client.query("UPDATE intelligence_records SET signal_type = $2, source_context = source_context || $3::jsonb WHERE id = $1", [owned.domain_id, signalType, JSON.stringify({ observedPeriod: text(payload.observedPeriod, "Observed period"), sourceLabel: text(payload.sourceLabel, "Source label", true) })]);
      result = { recordId, status: "updated" };
    }

    if (action === "add-note") {
      if (!recordId) throw new Error("recordId is required.");
      const target = await client.query<{ exchange_record_id: string; intelligence_record_id: string }>(`
        SELECT er.id::text AS exchange_record_id, ir.id::text AS intelligence_record_id
        FROM exchange_records er JOIN intelligence_records ir ON ir.exchange_record_id = er.id
        WHERE er.public_id = $1 LIMIT 1
      `, [recordId]);
      if (!target.rows[0]) throw new Error("Intelligence record not found.");
      exchangeRecordUuid = target.rows[0].exchange_record_id;
      const note = await client.query<{ id: string }>(`
        INSERT INTO intelligence_notes (intelligence_record_id, author_user_id, organization_id, visibility, body)
        VALUES ($1, $2, $3, 'organization', $4)
        RETURNING id::text
      `, [target.rows[0].intelligence_record_id, actor.userId, actor.organizationId, text(payload.note ?? payload.body, "Note", true)]);
      result = { noteId: note.rows[0].id, status: "created" };
    }

    if (!exchangeRecordUuid) throw new Error(`Unsupported domain workflow: ${action}`);
    await client.query(`INSERT INTO activity_events (event_name, actor_user_id, organization_id, exchange_record_id, payload) VALUES ($1, $2, $3, $4, $5::jsonb)`, [`Workflow:${action}`, actor.userId, actor.organizationId, exchangeRecordUuid, JSON.stringify({ result })]);
    return { action, durable: true, ...result };
  });
}
