import type { PoolClient } from "pg";
import type { ExchangeLens, ExchangeRecordType } from "@/lib/exchange/contracts";
import type { ServerActorContext } from "./actor-context";
import { withDatabaseTransaction } from "./postgres";
import type { RelationshipKind, SharedWorkflowEvent, SharedWorkflowId, WorkflowSource } from "@/lib/exchange/shared-workflows";

const recordLens: Record<ExchangeRecordType, ExchangeLens> = {
  rfx: "rfx",
  resource: "resources",
  intelligence: "intelligence",
  capability: "capabilities",
};

const eventNames: Record<SharedWorkflowId, string> = {
  save: "RecordSaved",
  watch: "RFxWatched",
  track: "IntelligenceTracked",
  follow: "OrganizationFollowed",
  share: "RecordShared",
  refer: "ReferralCreated",
  match: "MatchRequested",
  team: "TeamingRequested",
  connect: "ConnectionRequested",
};

const relationshipKind: Partial<Record<SharedWorkflowId, RelationshipKind>> = {
  save: "saved",
  watch: "watching",
  track: "tracking",
  follow: "following",
};

type RecordRow = {
  id: string;
  public_id: string;
  record_type: ExchangeRecordType;
  title: string;
  organization_id: string;
  organization_name: string;
};

async function resolveRecord(client: PoolClient, publicId: string) {
  const result = await client.query<RecordRow>(
    `SELECT er.id, er.public_id, er.record_type, er.title, er.organization_id, o.name AS organization_name
       FROM exchange_records er
       JOIN organizations o ON o.id = er.organization_id
      WHERE er.public_id = $1
      LIMIT 1`,
    [publicId],
  );
  return result.rows[0];
}

async function resolveRecipientOrganization(client: PoolClient, recipient: string) {
  const result = await client.query<{ id: string; name: string }>(
    `SELECT id, name FROM organizations WHERE lower(name) = lower($1) LIMIT 1`,
    [recipient.trim()],
  );
  return result.rows[0];
}

async function persistRelationship(client: PoolClient, actor: ServerActorContext, record: RecordRow, kind: RelationshipKind, active: boolean) {
  if (active) {
    await client.query(
      `INSERT INTO record_relationships (user_id, exchange_record_id, relationship_kind)
       VALUES ($1::uuid, $2::uuid, $3)
       ON CONFLICT (user_id, exchange_record_id, relationship_kind)
       DO UPDATE SET updated_at = now()`,
      [actor.userId, record.id, kind],
    );
  } else {
    await client.query(
      `DELETE FROM record_relationships WHERE user_id = $1::uuid AND exchange_record_id = $2::uuid AND relationship_kind = $3`,
      [actor.userId, record.id, kind],
    );
  }
}

export class ExchangeWorkflowValidationError extends Error {
  status: number;
  constructor(message: string, status = 422) {
    super(message);
    this.name = "ExchangeWorkflowValidationError";
    this.status = status;
  }
}

export async function executeSharedWorkflow(input: {
  workflow: SharedWorkflowId;
  lens: ExchangeLens;
  recordId: string;
  source: WorkflowSource;
  payload: Record<string, unknown>;
  actor: ServerActorContext;
}): Promise<SharedWorkflowEvent> {
  return withDatabaseTransaction(async (client) => {
    const record = await resolveRecord(client, input.recordId);
    if (!record) throw new ExchangeWorkflowValidationError("Exchange record not found", 404);
    if (recordLens[record.record_type] !== input.lens) throw new ExchangeWorkflowValidationError("Record does not belong to the requested lens", 409);

    const kind = relationshipKind[input.workflow];
    if (kind) {
      const active = input.payload.active !== false;
      await persistRelationship(client, input.actor, record, kind, active);
    }

    if (input.workflow === "refer") {
      const recipientName = typeof input.payload.recipientOrganization === "string" ? input.payload.recipientOrganization.trim() : "";
      if (!recipientName) throw new ExchangeWorkflowValidationError("A receiving organization is required.");
      const recipient = await resolveRecipientOrganization(client, recipientName);
      if (!recipient) throw new ExchangeWorkflowValidationError("The receiving organization could not be resolved in RFxchange.");
      if (recipient.id === input.actor.organizationId) throw new ExchangeWorkflowValidationError("A referral recipient must be another organization.");
      const referral = await client.query<{ id: string }>(
        `INSERT INTO referrals (sender_organization_id, recipient_organization_id, exchange_record_id, created_by_user_id, source_lens, note, terms)
         VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, $6, $7::jsonb)
         RETURNING id`,
        [input.actor.organizationId, recipient.id, record.id, input.actor.userId, input.lens, typeof input.payload.note === "string" ? input.payload.note : null, JSON.stringify(input.payload.terms ?? {})],
      );
      await client.query(
        `INSERT INTO referral_events (referral_id, event_name, actor_user_id, payload)
         VALUES ($1::uuid, 'ReferralCreated', $2::uuid, $3::jsonb)`,
        [referral.rows[0].id, input.actor.userId, JSON.stringify({ sourceLens: input.lens, recordPublicId: record.public_id })],
      );
    }

    if (input.workflow === "team" || input.workflow === "connect") {
      if (record.organization_id === input.actor.organizationId) throw new ExchangeWorkflowValidationError("Select another organization's record for this collaboration request.");
      await client.query(
        `INSERT INTO collaboration_requests (request_kind, exchange_record_id, sender_organization_id, recipient_organization_id, created_by_user_id, message, metadata)
         VALUES ($1, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6, $7::jsonb)`,
        [input.workflow === "team" ? "teaming" : "connection", record.id, input.actor.organizationId, record.organization_id, input.actor.userId, typeof input.payload.note === "string" ? input.payload.note : null, JSON.stringify({ sourceLens: input.lens })],
      );
    }

    if (input.workflow === "share") {
      await client.query(
        `INSERT INTO share_links (exchange_record_id, created_by_user_id, audience)
         VALUES ($1::uuid, $2::uuid, $3::jsonb)`,
        [record.id, input.actor.userId, JSON.stringify(input.payload.audience ?? {})],
      );
    }

    if (input.workflow === "match") {
      const ids = Array.isArray(input.payload.matchRecordIds) ? input.payload.matchRecordIds.filter((item): item is string => typeof item === "string") : [];
      for (const publicId of ids) {
        const matched = await resolveRecord(client, publicId);
        if (!matched || matched.id === record.id) continue;
        await client.query(
          `INSERT INTO match_decisions (source_exchange_record_id, matched_exchange_record_id, requested_by_user_id, status)
           VALUES ($1::uuid, $2::uuid, $3::uuid, 'suggested')
           ON CONFLICT (source_exchange_record_id, matched_exchange_record_id, requested_by_user_id)
           DO UPDATE SET status = EXCLUDED.status`,
          [record.id, matched.id, input.actor.userId],
        );
      }
    }

    const execution = await client.query<{ id: string; completed_at: string }>(
      `INSERT INTO workflow_executions (workflow_id, source_lens, source_surface, actor_user_id, actor_organization_id, exchange_record_id, state, payload, completed_at)
       VALUES ($1, $2, $3, $4::uuid, $5::uuid, $6::uuid, 'completed', $7::jsonb, now())
       RETURNING id, completed_at::text`,
      [input.workflow, input.lens, input.source, input.actor.userId, input.actor.organizationId, record.id, JSON.stringify(input.payload)],
    );

    await client.query(
      `INSERT INTO activity_events (event_name, actor_user_id, organization_id, exchange_record_id, payload)
       VALUES ($1, $2::uuid, $3::uuid, $4::uuid, $5::jsonb)`,
      [eventNames[input.workflow], input.actor.userId, input.actor.organizationId, record.id, JSON.stringify({ workflow: input.workflow, source: input.source })],
    );

    return {
      id: execution.rows[0].id,
      eventName: eventNames[input.workflow],
      workflow: input.workflow,
      lens: input.lens,
      recordId: record.public_id,
      recordTitle: record.title,
      actorOrganizationId: input.actor.organizationId,
      actorOrganizationName: input.actor.organizationName,
      source: input.source,
      occurredAt: execution.rows[0].completed_at,
      payload: input.payload,
    };
  });
}
