import type { PoolClient } from "pg";
import type { ServerActorContext } from "./actor-context";
import { withDatabaseTransaction } from "./postgres";
import type { RfxWorkflowCommand } from "@/lib/exchange/drawer-workflows";

export interface RfxWorkflowPayload {
  title?: string;
  summary?: string;
  rfxType?: string;
  performanceGeography?: string;
  dueAt?: string;
  response?: string;
  externalSubmissionReference?: string;
  collaboratorOrganization?: string;
  message?: string;
  nextStatus?: "evaluation" | "selected";
}

export interface RfxWorkflowResult {
  recordId: string;
  command: RfxWorkflowCommand;
  status: string;
  message: string;
  data?: Record<string, unknown>;
}

type RfxRow = {
  exchange_record_id: string;
  rfx_record_id: string;
  public_id: string;
  organization_id: string;
  title: string;
  lifecycle_status: string;
  external_submission_required: boolean;
};

export class RfxWorkflowValidationError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 422) {
    super(message);
    this.name = "RfxWorkflowValidationError";
    this.statusCode = statusCode;
  }
}

async function resolveRfx(client: PoolClient, publicId: string) {
  const result = await client.query<RfxRow>(
    `SELECT er.id AS exchange_record_id, rr.id AS rfx_record_id, er.public_id, er.organization_id, er.title,
            rr.lifecycle_status, rr.external_submission_required
       FROM exchange_records er
       JOIN rfx_records rr ON rr.exchange_record_id = er.id
      WHERE er.public_id = $1 AND er.record_type = 'rfx'
      LIMIT 1`,
    [publicId],
  );
  return result.rows[0];
}

async function logEvent(client: PoolClient, actor: ServerActorContext, record: RfxRow | undefined, eventName: string, payload: Record<string, unknown>) {
  await client.query(
    `INSERT INTO activity_events (event_name, actor_user_id, organization_id, exchange_record_id, payload)
     VALUES ($1, $2::uuid, $3::uuid, $4::uuid, $5::jsonb)`,
    [eventName, actor.userId, actor.organizationId, record?.exchange_record_id ?? null, JSON.stringify(payload)],
  );
}

function requireOwned(record: RfxRow, actor: ServerActorContext) {
  if (record.organization_id !== actor.organizationId) throw new RfxWorkflowValidationError("Only the owning organization may manage this RFx.", 403);
}

export async function executeRfxWorkflow(input: {
  command: RfxWorkflowCommand;
  recordId?: string;
  payload: RfxWorkflowPayload;
  actor: ServerActorContext;
}): Promise<RfxWorkflowResult> {
  return withDatabaseTransaction(async (client) => {
    if (input.command === "create" || input.command === "draft") {
      if (!input.payload.title?.trim() || !input.payload.summary?.trim()) throw new RfxWorkflowValidationError("Title and summary are required to create an RFx draft.");
      const record = await client.query<{ id: string; public_id: string }>(
        `INSERT INTO exchange_records (public_id, record_type, organization_id, title, summary, status, metadata)
         VALUES ('rfx-' || substring(replace(gen_random_uuid()::text, '-', '') from 1 for 12), 'rfx', $1::uuid, $2, $3, 'draft', $4::jsonb)
         RETURNING id, public_id`,
        [input.actor.organizationId, input.payload.title.trim(), input.payload.summary.trim(), JSON.stringify({ source: "rfxchange" })],
      );
      await client.query(
        `INSERT INTO rfx_records (exchange_record_id, solicitation_type, due_at, source, lifecycle_status, performance_geography, scope)
         VALUES ($1::uuid, $2, $3::timestamptz, 'rfxchange', 'draft', $4::jsonb, $5::jsonb)`,
        [record.rows[0].id, input.payload.rfxType ?? null, input.payload.dueAt || null, JSON.stringify({ label: input.payload.performanceGeography ?? "" }), JSON.stringify({ summary: input.payload.summary.trim() })],
      );
      await client.query(
        `INSERT INTO rfx_pursuits (rfx_record_id, organization_id, state, started_at)
         SELECT id, $2::uuid, 'drafting', now() FROM rfx_records WHERE exchange_record_id = $1::uuid
         ON CONFLICT (rfx_record_id, organization_id) DO UPDATE SET state = 'drafting', updated_at = now()`,
        [record.rows[0].id, input.actor.organizationId],
      );
      await client.query(
        `INSERT INTO activity_events (event_name, actor_user_id, organization_id, exchange_record_id, payload)
         VALUES ('RFxDraftCreated', $1::uuid, $2::uuid, $3::uuid, '{}'::jsonb)`,
        [input.actor.userId, input.actor.organizationId, record.rows[0].id],
      );
      return { recordId: record.rows[0].public_id, command: input.command, status: "draft", message: "RFx draft created." };
    }

    if (!input.recordId) throw new RfxWorkflowValidationError("An RFx record is required for this workflow.");
    const record = await resolveRfx(client, input.recordId);
    if (!record) throw new RfxWorkflowValidationError("RFx record not found.", 404);

    if (input.command === "save" || input.command === "manage" || input.command === "update") {
      requireOwned(record, input.actor);
      if (input.payload.title?.trim() || input.payload.summary?.trim()) {
        await client.query(
          `UPDATE exchange_records SET title = COALESCE(NULLIF($2, ''), title), summary = COALESCE(NULLIF($3, ''), summary), updated_at = now() WHERE id = $1::uuid`,
          [record.exchange_record_id, input.payload.title?.trim() ?? "", input.payload.summary?.trim() ?? ""],
        );
      }
      await logEvent(client, input.actor, record, "RFxUpdated", { command: input.command });
      return { recordId: record.public_id, command: input.command, status: record.lifecycle_status, message: "RFx changes saved." };
    }

    if (input.command === "publish") {
      requireOwned(record, input.actor);
      await client.query(`UPDATE exchange_records SET status = 'active', updated_at = now() WHERE id = $1::uuid`, [record.exchange_record_id]);
      await client.query(`UPDATE rfx_records SET lifecycle_status = 'open' WHERE id = $1::uuid`, [record.rfx_record_id]);
      await logEvent(client, input.actor, record, "RFxPublished", {});
      return { recordId: record.public_id, command: input.command, status: "open", message: "RFx published to the Exchange." };
    }

    if (input.command === "close") {
      requireOwned(record, input.actor);
      await client.query(`UPDATE exchange_records SET status = 'closed', updated_at = now() WHERE id = $1::uuid`, [record.exchange_record_id]);
      await client.query(`UPDATE rfx_records SET lifecycle_status = 'closed' WHERE id = $1::uuid`, [record.rfx_record_id]);
      await logEvent(client, input.actor, record, "RFxClosed", {});
      return { recordId: record.public_id, command: input.command, status: "closed", message: "RFx closed." };
    }

    if (input.command === "award-advance") {
      requireOwned(record, input.actor);
      if (input.payload.nextStatus !== "evaluation" && input.payload.nextStatus !== "selected") throw new RfxWorkflowValidationError("Choose whether the RFx advances to evaluation or selected status.");
      await client.query(`UPDATE rfx_records SET lifecycle_status = $2 WHERE id = $1::uuid`, [record.rfx_record_id, input.payload.nextStatus]);
      await client.query(`UPDATE exchange_records SET status = $2, updated_at = now() WHERE id = $1::uuid`, [record.exchange_record_id, input.payload.nextStatus]);
      await logEvent(client, input.actor, record, "RFxAdvanced", { status: input.payload.nextStatus });
      return { recordId: record.public_id, command: input.command, status: input.payload.nextStatus, message: `RFx advanced to ${input.payload.nextStatus}.` };
    }

    if (input.command === "invite") {
      requireOwned(record, input.actor);
      const organizationName = input.payload.collaboratorOrganization?.trim();
      if (!organizationName) throw new RfxWorkflowValidationError("Select an organization to invite as a collaborator.");
      const recipient = await client.query<{ id: string }>(`SELECT id FROM organizations WHERE lower(name) = lower($1) LIMIT 1`, [organizationName]);
      if (!recipient.rows[0]) throw new RfxWorkflowValidationError("The collaborator organization could not be resolved in RFxchange.");
      await client.query(
        `INSERT INTO collaboration_requests (request_kind, exchange_record_id, sender_organization_id, recipient_organization_id, created_by_user_id, message, metadata)
         VALUES ('teaming', $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, $6::jsonb)`,
        [record.exchange_record_id, input.actor.organizationId, recipient.rows[0].id, input.actor.userId, input.payload.message ?? null, JSON.stringify({ invitation: true, sourceLens: "rfx" })],
      );
      await logEvent(client, input.actor, record, "RFxCollaboratorInvited", { recipientOrganization: organizationName });
      return { recordId: record.public_id, command: input.command, status: record.lifecycle_status, message: "Collaborator invitation created." };
    }

    if (input.command === "responses") {
      requireOwned(record, input.actor);
      const responses = await client.query<{ id: string; organization: string; status: string; submitted_at: string | null }>(
        `SELECT resp.id, o.name AS organization, resp.status, resp.submitted_at::text
           FROM rfx_responses resp
           JOIN organizations o ON o.id = resp.respondent_organization_id
          WHERE resp.rfx_record_id = $1::uuid
          ORDER BY resp.updated_at DESC`,
        [record.rfx_record_id],
      );
      return { recordId: record.public_id, command: input.command, status: record.lifecycle_status, message: "Responses loaded.", data: { responses: responses.rows } };
    }

    if (input.command === "respond" || input.command === "submit") {
      if (record.organization_id === input.actor.organizationId) throw new RfxWorkflowValidationError("The issuer organization cannot respond to its own RFx.");
      if (!input.payload.response?.trim()) throw new RfxWorkflowValidationError("Response content is required.");
      if (input.command === "submit" && record.external_submission_required && !input.payload.externalSubmissionReference?.trim()) {
        throw new RfxWorkflowValidationError("This RFx requires authoritative external submission. Record the external submission reference before marking it submitted.");
      }
      const status = input.command === "submit" ? "submitted" : "draft";
      await client.query(
        `INSERT INTO rfx_responses (rfx_record_id, respondent_organization_id, status, response_data, submitted_at, external_submission_reference)
         VALUES ($1::uuid, $2::uuid, $3, $4::jsonb, CASE WHEN $3 = 'submitted' THEN now() ELSE NULL END, $5)
         ON CONFLICT (rfx_record_id, respondent_organization_id)
         DO UPDATE SET status = EXCLUDED.status, response_data = EXCLUDED.response_data,
                       submitted_at = EXCLUDED.submitted_at, external_submission_reference = EXCLUDED.external_submission_reference, updated_at = now()`,
        [record.rfx_record_id, input.actor.organizationId, status, JSON.stringify({ response: input.payload.response.trim() }), input.payload.externalSubmissionReference?.trim() || null],
      );
      await client.query(
        `INSERT INTO rfx_pursuits (rfx_record_id, organization_id, state, started_at, submitted_at)
         VALUES ($1::uuid, $2::uuid, $3::rfx_pursuit_state, now(), CASE WHEN $3 = 'submitted' THEN now() ELSE NULL END)
         ON CONFLICT (rfx_record_id, organization_id)
         DO UPDATE SET state = EXCLUDED.state, submitted_at = EXCLUDED.submitted_at, updated_at = now()`,
        [record.rfx_record_id, input.actor.organizationId, status === "submitted" ? "submitted" : "drafting"],
      );
      await logEvent(client, input.actor, record, status === "submitted" ? "RFxResponseSubmitted" : "RFxResponseDrafted", {});
      return { recordId: record.public_id, command: input.command, status, message: status === "submitted" ? "RFx response submitted." : "RFx response draft saved." };
    }

    throw new RfxWorkflowValidationError(`RFx command ${input.command} is not supported.`);
  });
}
