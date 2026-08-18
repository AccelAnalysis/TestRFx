import { randomUUID } from "node:crypto";
import type { ExchangeActor } from "./exchange-actor";
import { withTransaction } from "./database";

export type RfxWorkflowAction = "create" | "update" | "publish" | "close" | "respond" | "award";

export interface RfxDraftInput {
  title?: unknown;
  summary?: unknown;
  solicitationType?: unknown;
  solicitationNumber?: unknown;
  dueAt?: unknown;
  geography?: unknown;
  scope?: unknown;
  deliverables?: unknown;
  responseRequirements?: unknown;
  evaluationMethod?: unknown;
  externalSubmissionRequired?: unknown;
  publish?: unknown;
}

export interface RfxResponseInput {
  responseSummary?: unknown;
  externalSubmissionReference?: unknown;
  submit?: unknown;
}

function requiredText(value: unknown, field: string) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) throw new Error(`${field} is required.`);
  return text;
}

function optionalText(value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";
  return text || undefined;
}

function stringList(value: unknown) {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim());
  if (typeof value === "string") return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
  return [];
}

async function ownedRfx(client: Parameters<Parameters<typeof withTransaction>[0]>[0], publicId: string, actor: ExchangeActor) {
  const result = await client.query<{ exchange_record_id: string; rfx_record_id: string; external_submission_required: boolean }>(`
    SELECT er.id::text AS exchange_record_id, rr.id::text AS rfx_record_id, rr.external_submission_required
    FROM exchange_records er
    JOIN rfx_records rr ON rr.exchange_record_id = er.id
    WHERE er.public_id = $1
      AND er.organization_id = $2::uuid
    LIMIT 1
  `, [publicId, actor.organizationId]);
  const row = result.rows[0];
  if (!row) throw new Error("RFx record not found or not manageable by the active organization.");
  return row;
}

async function anyRfx(client: Parameters<Parameters<typeof withTransaction>[0]>[0], publicId: string) {
  const result = await client.query<{ exchange_record_id: string; rfx_record_id: string; issuer_organization_id: string; external_submission_required: boolean }>(`
    SELECT er.id::text AS exchange_record_id, rr.id::text AS rfx_record_id, er.organization_id::text AS issuer_organization_id, rr.external_submission_required
    FROM exchange_records er
    JOIN rfx_records rr ON rr.exchange_record_id = er.id
    WHERE er.public_id = $1
    LIMIT 1
  `, [publicId]);
  const row = result.rows[0];
  if (!row) throw new Error("RFx record not found.");
  return row;
}

async function activity(client: Parameters<Parameters<typeof withTransaction>[0]>[0], eventName: string, actor: ExchangeActor, exchangeRecordId: string, payload: Record<string, unknown> = {}) {
  await client.query(`
    INSERT INTO activity_events (event_name, actor_user_id, organization_id, exchange_record_id, payload)
    VALUES ($1, $2, $3, $4, $5::jsonb)
  `, [eventName, actor.userId, actor.organizationId, exchangeRecordId, JSON.stringify(payload)]);
}

export async function executeRfxWorkflow({
  action,
  actor,
  recordId,
  payload = {},
}: {
  action: RfxWorkflowAction;
  actor: ExchangeActor;
  recordId?: string;
  payload?: Record<string, unknown>;
}) {
  return withTransaction(async (client) => {
    if (action === "create") {
      const title = requiredText(payload.title, "RFx title");
      const summary = requiredText(payload.summary, "Summary");
      const solicitationType = requiredText(payload.solicitationType, "Solicitation type");
      const geography = requiredText(payload.geography, "Performance geography");
      const scope = requiredText(payload.scope, "Scope");
      const publish = payload.publish === true;
      const publicId = `rfx-${randomUUID()}`;
      const exchange = await client.query<{ id: string }>(`
        INSERT INTO exchange_records (public_id, record_type, organization_id, title, summary, status, metadata)
        VALUES ($1, 'rfx', $2, $3, $4, $5, $6::jsonb)
        RETURNING id::text
      `, [publicId, actor.organizationId, title, summary, publish ? "active" : "draft", JSON.stringify({ geography, classifications: [solicitationType] })]);
      const exchangeRecordId = exchange.rows[0].id;
      await client.query(`
        INSERT INTO rfx_records (
          exchange_record_id, solicitation_type, solicitation_number, source, lifecycle_status,
          issued_at, due_at, performance_geography, scope, deliverables, response_requirements,
          evaluation_method, external_submission_required
        ) VALUES ($1, $2, $3, 'rfxchange', $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb, $10::jsonb, $11::jsonb, $12)
      `, [
        exchangeRecordId,
        solicitationType,
        optionalText(payload.solicitationNumber) ?? null,
        publish ? "open" : "draft",
        publish ? new Date().toISOString() : null,
        optionalText(payload.dueAt) ?? null,
        JSON.stringify({ label: geography }),
        JSON.stringify({ text: scope }),
        JSON.stringify(stringList(payload.deliverables)),
        JSON.stringify(stringList(payload.responseRequirements)),
        JSON.stringify({ text: optionalText(payload.evaluationMethod) }),
        payload.externalSubmissionRequired === true,
      ]);
      await activity(client, publish ? "RfxPublished" : "RfxDraftCreated", actor, exchangeRecordId, { publicId });
      return { action, durable: true, recordId: publicId, status: publish ? "open" : "draft" };
    }

    if (action === "update") {
      if (!recordId) throw new Error("recordId is required.");
      const target = await ownedRfx(client, recordId, actor);
      const title = requiredText(payload.title, "RFx title");
      const summary = requiredText(payload.summary, "Summary");
      const solicitationType = requiredText(payload.solicitationType, "Solicitation type");
      const geography = requiredText(payload.geography, "Performance geography");
      const scope = requiredText(payload.scope, "Scope");
      await client.query(`
        UPDATE exchange_records
        SET title = $2, summary = $3, metadata = metadata || $4::jsonb, updated_at = now()
        WHERE id = $1
      `, [target.exchange_record_id, title, summary, JSON.stringify({ geography, classifications: [solicitationType] })]);
      await client.query(`
        UPDATE rfx_records
        SET solicitation_type = $2, solicitation_number = $3, due_at = $4,
            performance_geography = $5::jsonb, scope = $6::jsonb, deliverables = $7::jsonb,
            response_requirements = $8::jsonb, evaluation_method = $9::jsonb,
            external_submission_required = $10
        WHERE id = $1
      `, [
        target.rfx_record_id,
        solicitationType,
        optionalText(payload.solicitationNumber) ?? null,
        optionalText(payload.dueAt) ?? null,
        JSON.stringify({ label: geography }),
        JSON.stringify({ text: scope }),
        JSON.stringify(stringList(payload.deliverables)),
        JSON.stringify(stringList(payload.responseRequirements)),
        JSON.stringify({ text: optionalText(payload.evaluationMethod) }),
        payload.externalSubmissionRequired === true,
      ]);
      await activity(client, "RfxUpdated", actor, target.exchange_record_id);
      return { action, durable: true, recordId, status: "updated" };
    }

    if (action === "publish") {
      if (!recordId) throw new Error("recordId is required.");
      const target = await ownedRfx(client, recordId, actor);
      await client.query("UPDATE exchange_records SET status = 'active', updated_at = now() WHERE id = $1", [target.exchange_record_id]);
      await client.query("UPDATE rfx_records SET lifecycle_status = 'open', issued_at = COALESCE(issued_at, now()) WHERE id = $1", [target.rfx_record_id]);
      await activity(client, "RfxPublished", actor, target.exchange_record_id);
      return { action, durable: true, recordId, status: "open" };
    }

    if (action === "close") {
      if (!recordId) throw new Error("recordId is required.");
      const target = await ownedRfx(client, recordId, actor);
      await client.query("UPDATE exchange_records SET status = 'closed', updated_at = now() WHERE id = $1", [target.exchange_record_id]);
      await client.query("UPDATE rfx_records SET lifecycle_status = 'closed' WHERE id = $1", [target.rfx_record_id]);
      await activity(client, "RfxClosed", actor, target.exchange_record_id);
      return { action, durable: true, recordId, status: "closed" };
    }

    if (action === "respond") {
      if (!recordId) throw new Error("recordId is required.");
      const target = await anyRfx(client, recordId);
      if (target.issuer_organization_id === actor.organizationId) throw new Error("An issuing organization cannot respond to its own RFx.");
      const responseSummary = requiredText(payload.responseSummary, "Response summary");
      const submit = payload.submit === true;
      const externalReference = optionalText(payload.externalSubmissionReference);
      if (submit && target.external_submission_required && !externalReference) {
        throw new Error("This RFx requires an external submission reference before RFxchange can record it as submitted.");
      }
      const status = submit ? "submitted" : "draft";
      const response = await client.query<{ id: string }>(`
        INSERT INTO rfx_responses (
          rfx_record_id, respondent_organization_id, status, response_data, submitted_at, external_submission_reference
        ) VALUES ($1, $2, $3, $4::jsonb, $5, $6)
        ON CONFLICT (rfx_record_id, respondent_organization_id)
        DO UPDATE SET status = EXCLUDED.status, response_data = EXCLUDED.response_data,
          submitted_at = EXCLUDED.submitted_at, external_submission_reference = EXCLUDED.external_submission_reference, updated_at = now()
        RETURNING id::text
      `, [target.rfx_record_id, actor.organizationId, status, JSON.stringify({ summary: responseSummary }), submit ? new Date().toISOString() : null, externalReference ?? null]);
      await client.query(`
        INSERT INTO rfx_pursuits (rfx_record_id, organization_id, state, started_at, submitted_at)
        VALUES ($1, $2, $3::rfx_pursuit_state, now(), $4)
        ON CONFLICT (rfx_record_id, organization_id)
        DO UPDATE SET state = EXCLUDED.state, submitted_at = EXCLUDED.submitted_at, updated_at = now()
      `, [target.rfx_record_id, actor.organizationId, submit ? "submitted" : "drafting", submit ? new Date().toISOString() : null]);
      await activity(client, submit ? "RfxResponseSubmitted" : "RfxResponseDraftSaved", actor, target.exchange_record_id, { responseId: response.rows[0].id });
      return { action, durable: true, recordId, responseId: response.rows[0].id, status };
    }

    if (action === "award") {
      if (!recordId) throw new Error("recordId is required.");
      const responseId = requiredText(payload.responseId, "Response selection");
      const target = await ownedRfx(client, recordId, actor);
      const selected = await client.query<{ respondent_organization_id: string }>(`
        UPDATE rfx_responses
        SET status = CASE WHEN id = $2::uuid THEN 'selected' ELSE CASE WHEN status = 'submitted' THEN 'not_selected' ELSE status END END,
            updated_at = now()
        WHERE rfx_record_id = $1
        RETURNING id::text, respondent_organization_id::text
      `, [target.rfx_record_id, responseId]);
      const winner = selected.rows.find((row) => row.respondent_organization_id && row);
      const selectedResponse = await client.query<{ respondent_organization_id: string }>(`
        SELECT respondent_organization_id::text FROM rfx_responses WHERE id = $1::uuid AND rfx_record_id = $2 LIMIT 1
      `, [responseId, target.rfx_record_id]);
      if (!selectedResponse.rows[0]) throw new Error("Selected response was not found for this RFx.");
      await client.query(`
        UPDATE rfx_pursuits SET state = CASE WHEN organization_id = $2::uuid THEN 'selected'::rfx_pursuit_state ELSE CASE WHEN state = 'submitted' THEN 'not_selected'::rfx_pursuit_state ELSE state END END, updated_at = now()
        WHERE rfx_record_id = $1
      `, [target.rfx_record_id, selectedResponse.rows[0].respondent_organization_id]);
      await client.query("UPDATE rfx_records SET lifecycle_status = 'selected' WHERE id = $1", [target.rfx_record_id]);
      await client.query("UPDATE exchange_records SET status = 'selected', updated_at = now() WHERE id = $1", [target.exchange_record_id]);
      await activity(client, "RfxAwardAdvanced", actor, target.exchange_record_id, { responseId, respondentOrganizationId: selectedResponse.rows[0].respondent_organization_id });
      return { action, durable: true, recordId, responseId, status: "selected" };
    }

    throw new Error(`Unsupported RFx workflow: ${action}`);
  });
}

export async function listRfxResponses(recordId: string, actor: ExchangeActor) {
  return withTransaction(async (client) => {
    const target = await ownedRfx(client, recordId, actor);
    const responses = await client.query<{ id: string; organization_id: string; organization_name: string; status: string; submitted_at: string | null; response_data: unknown; external_submission_reference: string | null }>(`
      SELECT rrsp.id::text AS id, rrsp.respondent_organization_id::text AS organization_id, o.name AS organization_name,
             rrsp.status, rrsp.submitted_at::text, rrsp.response_data, rrsp.external_submission_reference
      FROM rfx_responses rrsp
      JOIN organizations o ON o.id = rrsp.respondent_organization_id
      WHERE rrsp.rfx_record_id = $1
      ORDER BY rrsp.submitted_at DESC NULLS LAST, o.name
    `, [target.rfx_record_id]);
    return responses.rows;
  });
}
