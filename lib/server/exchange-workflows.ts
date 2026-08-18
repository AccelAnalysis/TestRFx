import type { ExchangeLens, ExchangeRecord } from "@/lib/exchange/contracts";
import type { SharedWorkflowId } from "@/lib/exchange/shared-workflows";
import type { ExchangeActor } from "./exchange-actor";
import { setRecordRelationship } from "./record-relationships";
import { withTransaction } from "./database";

export class WorkflowServiceUnavailableError extends Error {
  constructor(public readonly service: string, message: string) {
    super(message);
    this.name = "WorkflowServiceUnavailableError";
  }
}

export interface WorkflowExecutionInput {
  workflow: SharedWorkflowId;
  lens: ExchangeLens;
  record: ExchangeRecord;
  actor: ExchangeActor;
  source: "action-rail" | "detail" | "menu";
  payload?: Record<string, unknown>;
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

async function recordUuid(client: Parameters<Parameters<typeof withTransaction>[0]>[0], publicId: string) {
  const result = await client.query<{ id: string; organization_id: string }>(
    "SELECT id::text, organization_id::text FROM exchange_records WHERE public_id = $1 LIMIT 1",
    [publicId],
  );
  return result.rows[0];
}

export async function executeSharedWorkflow(input: WorkflowExecutionInput) {
  const { workflow, lens, record, actor, source } = input;
  const payload = input.payload ?? {};
  if (workflow === "save") {
    const active = typeof payload.active === "boolean" ? payload.active : true;
    const relationships = await setRecordRelationship(actor, record, "saved", active);
    return { workflow, durable: true, relationships, saved: relationships.includes("saved") };
  }
  if (workflow === "watch") {
    const active = typeof payload.active === "boolean" ? payload.active : true;
    const relationships = await setRecordRelationship(actor, record, "watching", active);
    return { workflow, durable: true, relationships };
  }
  if (workflow === "track") {
    const active = typeof payload.active === "boolean" ? payload.active : true;
    const relationships = await setRecordRelationship(actor, record, "tracking", active);
    return { workflow, durable: true, relationships };
  }
  if (workflow === "follow") {
    const active = typeof payload.active === "boolean" ? payload.active : true;
    const relationships = await setRecordRelationship(actor, record, "following", active);
    return { workflow, durable: true, relationships };
  }
  if (workflow === "match") {
    throw new WorkflowServiceUnavailableError(
      "matching",
      "Matching is unavailable until a governed AMACS/matching service is configured. No deterministic reference match will be returned.",
    );
  }

  return withTransaction(async (client) => {
    const target = await recordUuid(client, record.id);
    if (!target) throw new Error("Record not found.");
    const execution = await client.query<{ id: string }>(`
      INSERT INTO workflow_executions (
        workflow_id, source_lens, source_surface, actor_user_id, actor_organization_id, exchange_record_id, state, payload
      ) VALUES ($1, $2, $3, $4, $5, $6, 'started', $7::jsonb)
      RETURNING id::text
    `, [workflow, lens, source, actor.userId, actor.organizationId, target.id, JSON.stringify(payload)]);
    const executionId = execution.rows[0].id;

    let result: Record<string, unknown>;
    if (workflow === "share") {
      const share = await client.query<{ id: string }>(`
        INSERT INTO share_links (exchange_record_id, created_by_user_id, audience)
        VALUES ($1, $2, $3::jsonb)
        RETURNING id::text
      `, [target.id, actor.userId, JSON.stringify({ mode: "authenticated-exchange" })]);
      result = { shareLinkId: share.rows[0].id, deepLink: `/exchange/${lens}/${record.id}` };
    } else if (workflow === "refer") {
      const recipientOrganizationId = text(payload.recipientOrganizationId) ?? target.organization_id;
      if (!recipientOrganizationId || recipientOrganizationId === actor.organizationId) throw new Error("Choose a recipient organization other than your active organization.");
      const referral = await client.query<{ id: string }>(`
        INSERT INTO referrals (
          sender_organization_id, recipient_organization_id, exchange_record_id, created_by_user_id, source_lens, note, terms
        ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
        RETURNING id::text
      `, [actor.organizationId, recipientOrganizationId, target.id, actor.userId, lens, text(payload.note) ?? null, JSON.stringify(payload.terms ?? {})]);
      await client.query(`INSERT INTO referral_events (referral_id, event_name, actor_user_id, payload) VALUES ($1, 'ReferralCreated', $2, $3::jsonb)`, [referral.rows[0].id, actor.userId, JSON.stringify({ sourceLens: lens })]);
      result = { referralId: referral.rows[0].id, status: "proposed" };
    } else if (workflow === "team" || workflow === "connect") {
      const collaboration = await client.query<{ id: string }>(`
        INSERT INTO collaboration_requests (
          request_kind, exchange_record_id, sender_organization_id, recipient_organization_id, created_by_user_id, message, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
        RETURNING id::text
      `, [workflow === "team" ? "teaming" : "connection", target.id, actor.organizationId, target.organization_id, actor.userId, text(payload.message) ?? null, JSON.stringify({ sourceLens: lens })]);
      result = { collaborationRequestId: collaboration.rows[0].id, status: "requested" };
    } else {
      throw new Error(`Unsupported durable shared workflow: ${workflow}`);
    }

    await client.query(`
      UPDATE workflow_executions SET state = 'completed', completed_at = now(), payload = payload || $2::jsonb WHERE id = $1
    `, [executionId, JSON.stringify({ result })]);
    await client.query(`
      INSERT INTO activity_events (event_name, actor_user_id, organization_id, exchange_record_id, payload)
      VALUES ($1, $2, $3, $4, $5::jsonb)
    `, [`Workflow:${workflow}`, actor.userId, actor.organizationId, target.id, JSON.stringify({ source, lens, executionId })]);
    return { workflow, durable: true, executionId, ...result };
  });
}
