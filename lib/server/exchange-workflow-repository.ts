import { createHash, randomBytes } from "crypto";
import type { PoolClient } from "pg";
import type { ExchangeLens } from "@/lib/exchange/contracts";
import type { RelationshipKind, SharedWorkflowId, WorkflowSource } from "@/lib/exchange/shared-workflows";
import type { ResolvedExchangeActor } from "./exchange-actor";
import { withExchangeTransaction } from "./database";

interface RecordRow { id: string; public_id: string; title: string; organization_id: string; }
interface OrganizationRow { id: string; name: string; }

const relationshipFor: Partial<Record<SharedWorkflowId, RelationshipKind>> = {
  save: "saved",
  watch: "watching",
  track: "tracking",
  follow: "following",
};

const eventNameFor: Record<SharedWorkflowId, string> = {
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

async function getRecord(client: PoolClient, publicId: string) {
  const result = await client.query<RecordRow>("SELECT id, public_id, title, organization_id FROM exchange_records WHERE public_id = $1", [publicId]);
  if (!result.rows[0]) throw new Error("Exchange record not found in the canonical repository.");
  return result.rows[0];
}

async function recordExecution(client: PoolClient, workflow: SharedWorkflowId, lens: ExchangeLens, source: WorkflowSource, actor: ResolvedExchangeActor, recordId: string, payload: Record<string, unknown>) {
  const execution = await client.query<{ id: string }>(
    `INSERT INTO workflow_executions (workflow_id, source_lens, source_surface, actor_user_id, actor_organization_id, exchange_record_id, state, payload, completed_at)
     VALUES ($1,$2,$3,$4,$5,$6,'completed',$7::jsonb,now()) RETURNING id`,
    [workflow, lens, source, actor.userId, actor.organizationId, recordId, JSON.stringify(payload)],
  );
  await client.query(
    "INSERT INTO activity_events (event_name, actor_user_id, organization_id, exchange_record_id, payload) VALUES ($1,$2,$3,$4,$5::jsonb)",
    [eventNameFor[workflow], actor.userId, actor.organizationId, recordId, JSON.stringify(payload)],
  );
  return execution.rows[0].id;
}

async function executeRelationship(client: PoolClient, workflow: SharedWorkflowId, actor: ResolvedExchangeActor, record: RecordRow) {
  const relationshipKind = relationshipFor[workflow];
  if (!relationshipKind) throw new Error("Workflow is not a relationship action.");
  const existing = await client.query("SELECT 1 FROM record_relationships WHERE user_id=$1 AND exchange_record_id=$2 AND relationship_kind=$3", [actor.userId, record.id, relationshipKind]);
  if (existing.rowCount) {
    await client.query("DELETE FROM record_relationships WHERE user_id=$1 AND exchange_record_id=$2 AND relationship_kind=$3", [actor.userId, record.id, relationshipKind]);
    return { active: false, relationshipKind };
  }
  await client.query(
    `INSERT INTO record_relationships (user_id, exchange_record_id, relationship_kind)
     VALUES ($1,$2,$3)
     ON CONFLICT (user_id, exchange_record_id, relationship_kind) DO UPDATE SET updated_at=now()`,
    [actor.userId, record.id, relationshipKind],
  );
  return { active: true, relationshipKind };
}

async function executeShare(client: PoolClient, actor: ResolvedExchangeActor, record: RecordRow, lens: ExchangeLens) {
  const token = randomBytes(24).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const row = await client.query<{ id: string }>(
    "INSERT INTO share_links (exchange_record_id, created_by_user_id, token_hash, audience) VALUES ($1,$2,$3,$4::jsonb) RETURNING id",
    [record.id, actor.userId, tokenHash, JSON.stringify({ type: "link" })],
  );
  return { shareId: row.rows[0].id, deepLink: `/exchange/${lens}/${record.public_id}?share=${encodeURIComponent(token)}` };
}

async function findRecipient(client: PoolClient, name: string) {
  const result = await client.query<OrganizationRow>("SELECT id, name FROM organizations WHERE lower(name)=lower($1) LIMIT 1", [name]);
  return result.rows[0];
}

async function executeReferral(client: PoolClient, actor: ResolvedExchangeActor, record: RecordRow, lens: ExchangeLens, payload: Record<string, unknown>) {
  const recipientName = typeof payload.recipientOrganization === "string" ? payload.recipientOrganization.trim() : "";
  if (!recipientName) throw new Error("Receiving organization is required.");
  const recipient = await findRecipient(client, recipientName);
  if (!recipient) throw new Error("Receiving organization was not found in RFxchange.");
  const note = typeof payload.note === "string" ? payload.note.trim() : null;
  const referral = await client.query<{ id: string }>(
    `INSERT INTO referrals (sender_organization_id, recipient_organization_id, exchange_record_id, status, terms, created_by_user_id, source_lens, note)
     VALUES ($1,$2,$3,'proposed','{}'::jsonb,$4,$5,$6) RETURNING id`,
    [actor.organizationId, recipient.id, record.id, actor.userId, lens, note],
  );
  await client.query(
    "INSERT INTO referral_events (referral_id, event_name, actor_user_id, payload) VALUES ($1,'ReferralCreated',$2,$3::jsonb)",
    [referral.rows[0].id, actor.userId, JSON.stringify({ sourceRecordPublicId: record.public_id, recipientOrganization: recipient.name })],
  );
  return { referralId: referral.rows[0].id, recipientOrganization: recipient.name, status: "proposed" };
}

async function executeCollaboration(client: PoolClient, workflow: "team" | "connect", actor: ResolvedExchangeActor, record: RecordRow, payload: Record<string, unknown>) {
  const message = typeof payload.note === "string" ? payload.note.trim() : typeof payload.message === "string" ? payload.message.trim() : null;
  const result = await client.query<{ id: string }>(
    `INSERT INTO collaboration_requests (request_kind, exchange_record_id, sender_organization_id, recipient_organization_id, created_by_user_id, status, message)
     VALUES ($1,$2,$3,$4,$5,'requested',$6) RETURNING id`,
    [workflow === "team" ? "teaming" : "connection", record.id, actor.organizationId, record.organization_id, actor.userId, message],
  );
  return { collaborationRequestId: result.rows[0].id, status: "requested" };
}

async function executeMatch(client: PoolClient, actor: ResolvedExchangeActor, record: RecordRow) {
  const result = await client.query<{ id: string; public_id: string; title: string; score: number }>(
    `WITH source AS (SELECT title, summary FROM exchange_records WHERE id=$1), ranked AS (
       SELECT er.id, er.public_id, er.title,
         ts_rank_cd(er.search_document, plainto_tsquery('english', source.title || ' ' || source.summary)) AS score
       FROM exchange_records er, source WHERE er.id <> $1
     ) SELECT id, public_id, title, score FROM ranked WHERE score > 0 ORDER BY score DESC, title LIMIT 8`,
    [record.id],
  );
  for (const match of result.rows) {
    await client.query(
      `INSERT INTO match_decisions (source_exchange_record_id, matched_exchange_record_id, requested_by_user_id, score, rationale)
       VALUES ($1,$2,$3,$4,$5::jsonb)
       ON CONFLICT (source_exchange_record_id, matched_exchange_record_id, requested_by_user_id)
       DO UPDATE SET score=excluded.score, rationale=excluded.rationale`,
      [record.id, match.id, actor.userId, match.score, JSON.stringify(["PostgreSQL full-text relevance"])],
    );
  }
  return { matches: result.rows.map(({ id: _id, ...match }) => match) };
}

export async function executeSharedWorkflow(input: {
  workflow: SharedWorkflowId;
  lens: ExchangeLens;
  recordPublicId: string;
  source: WorkflowSource;
  actor: ResolvedExchangeActor;
  payload: Record<string, unknown>;
}) {
  return withExchangeTransaction(async (client) => {
    const record = await getRecord(client, input.recordPublicId);
    let result: Record<string, unknown> = {};
    if (relationshipFor[input.workflow]) result = await executeRelationship(client, input.workflow, input.actor, record);
    else if (input.workflow === "share") result = await executeShare(client, input.actor, record, input.lens);
    else if (input.workflow === "refer") result = await executeReferral(client, input.actor, record, input.lens, input.payload);
    else if (input.workflow === "team" || input.workflow === "connect") result = await executeCollaboration(client, input.workflow, input.actor, record, input.payload);
    else if (input.workflow === "match") result = await executeMatch(client, input.actor, record);
    const executionId = await recordExecution(client, input.workflow, input.lens, input.source, input.actor, record.id, { ...input.payload, ...result });
    return { executionId, eventName: eventNameFor[input.workflow], workflow: input.workflow, recordId: record.public_id, result };
  });
}

export async function getReferralPolicy(recipientOrganization: string) {
  return withExchangeTransaction(async (client) => {
    const recipient = await findRecipient(client, recipientOrganization);
    if (!recipient) return null;
    const policy = await client.query<{ policy: Record<string, unknown>; fee: Record<string, unknown> }>(
      "SELECT policy, fee FROM organization_referral_policies WHERE organization_id=$1",
      [recipient.id],
    );
    return { organization: recipient.name, policy: policy.rows[0]?.policy ?? null, fee: policy.rows[0]?.fee ?? null };
  });
}
