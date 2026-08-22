import { randomBytes, createHash } from "node:crypto";
import type { ExchangeServerActor } from "@/lib/server/exchange/actor";
import { getDatabase } from "@/lib/server/database";
import type { RelationshipKind } from "@/lib/exchange/shared-workflows";

export class SharedExchangeWorkflowError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "SharedExchangeWorkflowError";
  }
}

interface RecordRow {
  id: string;
  public_id: string;
  record_type: "rfx" | "resource" | "intelligence" | "capability";
  organization_id: string;
  title: string;
  summary: string;
}

interface ReferralPolicyRow {
  organization_id: string;
  policy_summary: string | null;
  fee_summary: string | null;
  active: boolean;
  rules: unknown;
  eligibility_criteria: unknown;
}

function sourceLens(type: RecordRow["record_type"]) {
  if (type === "resource") return "resources";
  if (type === "intelligence") return "intelligence";
  if (type === "capability") return "capabilities";
  return "rfx";
}

async function resolveRecord(publicId: string): Promise<RecordRow> {
  const sql = getDatabase();
  const rows = await sql<RecordRow[]>`
    SELECT id::text, public_id, record_type::text, organization_id::text, title, summary
    FROM exchange_records
    WHERE public_id = ${publicId}
      AND status <> 'deleted'
    LIMIT 1
  `;
  const record = rows[0];
  if (!record) throw new SharedExchangeWorkflowError(404, "Exchange record not found.");
  return record;
}

export async function setSharedRecordRelationship(input: {
  actor: ExchangeServerActor;
  recordPublicId: string;
  kind: RelationshipKind;
  active: boolean;
}) {
  const sql = getDatabase();
  const record = await resolveRecord(input.recordPublicId);

  await sql.begin(async (tx) => {
    if (input.active) {
      await tx`
        INSERT INTO record_relationships (user_id, exchange_record_id, relationship_kind, updated_at)
        VALUES (${input.actor.userId}::uuid, ${record.id}::uuid, ${input.kind}, now())
        ON CONFLICT (user_id, exchange_record_id, relationship_kind)
        DO UPDATE SET updated_at = now()
      `;
      if (input.kind === "saved") {
        await tx`
          INSERT INTO favorites (user_id, exchange_record_id)
          VALUES (${input.actor.userId}::uuid, ${record.id}::uuid)
          ON CONFLICT DO NOTHING
        `;
      }
    } else {
      await tx`
        DELETE FROM record_relationships
        WHERE user_id = ${input.actor.userId}::uuid
          AND exchange_record_id = ${record.id}::uuid
          AND relationship_kind = ${input.kind}
      `;
      if (input.kind === "saved") {
        await tx`
          DELETE FROM favorites
          WHERE user_id = ${input.actor.userId}::uuid
            AND exchange_record_id = ${record.id}::uuid
        `;
      }
    }

    await tx`
      INSERT INTO activity_events (event_name, actor_user_id, organization_id, exchange_record_id, payload)
      VALUES (
        ${input.active ? "RecordRelationshipEnabled" : "RecordRelationshipDisabled"},
        ${input.actor.userId}::uuid,
        ${input.actor.organizationId}::uuid,
        ${record.id}::uuid,
        ${tx.json({ kind: input.kind, sourceLens: sourceLens(record.record_type) })}
      )
    `;
  });

  return { recordId: record.public_id, kind: input.kind, active: input.active };
}

export async function readSharedReferralPolicy(organizationId: string) {
  const sql = getDatabase();
  const rows = await sql<ReferralPolicyRow[]>`
    SELECT organization_id::text, policy_summary, fee_summary, active, rules, eligibility_criteria
    FROM referral_policies
    WHERE organization_id = ${organizationId}::uuid
    LIMIT 1
  `;
  const policy = rows[0];
  if (!policy) return { organizationId, published: false, active: false, policySummary: null, feeSummary: null, rules: [], eligibilityCriteria: [] };
  return {
    organizationId: policy.organization_id,
    published: true,
    active: policy.active,
    policySummary: policy.policy_summary,
    feeSummary: policy.fee_summary,
    rules: Array.isArray(policy.rules) ? policy.rules : [],
    eligibilityCriteria: Array.isArray(policy.eligibility_criteria) ? policy.eligibility_criteria : [],
  };
}

export async function createSharedReferral(input: {
  actor: ExchangeServerActor;
  recordPublicId: string;
  recipientOrganizationId: string;
  note?: string;
}) {
  const sql = getDatabase();
  const record = await resolveRecord(input.recordPublicId);
  if (input.recipientOrganizationId === input.actor.organizationId) {
    throw new SharedExchangeWorkflowError(409, "A referral recipient must be a different organization.");
  }

  const recipient = await sql<{ id: string; name: string }[]>`
    SELECT id::text, name FROM organizations WHERE id = ${input.recipientOrganizationId}::uuid LIMIT 1
  `;
  if (!recipient[0]) throw new SharedExchangeWorkflowError(404, "Referral recipient organization not found.");

  const policy = await readSharedReferralPolicy(input.recipientOrganizationId);
  if (policy.published && !policy.active) throw new SharedExchangeWorkflowError(409, "The recipient is not currently accepting referrals.");

  const rows = await sql<{ id: string; status: string }[]>`
    INSERT INTO referrals (
      sender_organization_id,
      recipient_organization_id,
      exchange_record_id,
      created_by_user_id,
      source_lens,
      note,
      status,
      policy_snapshot,
      fee_snapshot,
      terms
    ) VALUES (
      ${input.actor.organizationId}::uuid,
      ${input.recipientOrganizationId}::uuid,
      ${record.id}::uuid,
      ${input.actor.userId}::uuid,
      ${sourceLens(record.record_type)},
      ${input.note?.trim() || null},
      'proposed',
      ${sql.json(policy)},
      ${sql.json({ summary: policy.feeSummary })},
      '{}'::jsonb
    )
    RETURNING id::text, status
  `;
  const referral = rows[0];
  if (!referral) throw new SharedExchangeWorkflowError(500, "Referral could not be created.");

  await sql.begin(async (tx) => {
    await tx`
      INSERT INTO referral_events (referral_id, event_name, actor_user_id, payload)
      VALUES (${referral.id}::uuid, 'ReferralCreated', ${input.actor.userId}::uuid, ${tx.json({ recordPublicId: record.public_id, recipientOrganizationId: input.recipientOrganizationId })})
    `;
    await tx`
      INSERT INTO activity_events (event_name, actor_user_id, organization_id, exchange_record_id, payload)
      VALUES ('ReferralCreated', ${input.actor.userId}::uuid, ${input.actor.organizationId}::uuid, ${record.id}::uuid, ${tx.json({ referralId: referral.id, recipientOrganizationId: input.recipientOrganizationId })})
    `;
  });

  return { id: referral.id, status: referral.status, recordId: record.public_id, recipientOrganization: recipient[0], policy };
}

export async function createSharedLink(input: { actor: ExchangeServerActor; recordPublicId: string; audience?: Record<string, unknown> }) {
  const sql = getDatabase();
  const record = await resolveRecord(input.recordPublicId);
  const token = randomBytes(24).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const audience = JSON.parse(JSON.stringify(input.audience ?? {}));
  const rows = await sql<{ id: string }[]>`
    INSERT INTO share_links (exchange_record_id, created_by_user_id, token_hash, audience)
    VALUES (${record.id}::uuid, ${input.actor.userId}::uuid, ${tokenHash}, ${sql.json(audience)})
    RETURNING id::text
  `;
  return { id: rows[0]?.id, token, recordId: record.public_id, deepLink: `/exchange/${sourceLens(record.record_type)}/${record.public_id}` };
}

export async function createSharedCollaboration(input: {
  actor: ExchangeServerActor;
  recordPublicId: string;
  kind: "teaming" | "connection";
  recipientOrganizationId?: string;
  message?: string;
}) {
  const sql = getDatabase();
  const record = await resolveRecord(input.recordPublicId);
  const recipient = input.recipientOrganizationId ?? (record.organization_id !== input.actor.organizationId ? record.organization_id : undefined);
  const rows = await sql<{ id: string; status: string }[]>`
    INSERT INTO collaboration_requests (
      request_kind, exchange_record_id, sender_organization_id, recipient_organization_id, created_by_user_id, status, message
    ) VALUES (
      ${input.kind}, ${record.id}::uuid, ${input.actor.organizationId}::uuid,
      ${recipient ?? null}::uuid, ${input.actor.userId}::uuid, 'requested', ${input.message?.trim() || null}
    ) RETURNING id::text, status
  `;
  return { id: rows[0]?.id, status: rows[0]?.status ?? "requested", kind: input.kind, recordId: record.public_id };
}

export async function requestSharedMatch(input: { actor: ExchangeServerActor; recordPublicId: string }) {
  const record = await resolveRecord(input.recordPublicId);
  // Matching is a single shared boundary. Domain PRs may contribute governed
  // criteria/projections, but they must not create parallel match repositories.
  throw new SharedExchangeWorkflowError(
    503,
    `Governed matching is not configured for ${record.public_id}; no heuristic match is fabricated.`,
  );
}
