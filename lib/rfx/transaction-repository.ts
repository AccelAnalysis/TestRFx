import "server-only";

import { neon } from "@neondatabase/serverless";
import type { RfxActorContext } from "./runtime-actor";
import type { RfxWorkspace } from "./contracts";

function database() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) throw new Error("RFx transactions require DATABASE_URL.");
  return neon(url);
}

function value(workspace: RfxWorkspace, key: string) {
  const current = workspace.values[key];
  return current === null || current === undefined ? "" : String(current).trim();
}

function titleFromWorkspace(workspace: RfxWorkspace) {
  const explicit = value(workspace, "rfx.title");
  if (explicit) return explicit.slice(0, 180);
  const need = value(workspace, "mobile.needStatement") || value(workspace, "need.statement") || "RFx opportunity";
  const sentence = need.split(/[.!?\n]/)[0]?.trim() || need;
  return sentence.length > 110 ? `${sentence.slice(0, 107).trim()}…` : sentence;
}

function jsonArray(workspace: RfxWorkspace, nodeId: string) {
  return workspace.items.filter((item) => item.nodeId === nodeId).map((item) => ({ label: item.label, note: item.note }));
}

export async function publishCanonicalRfx(actor: RfxActorContext, recordId: string, workspace: RfxWorkspace, requestedType?: string) {
  const sql = database();
  const title = titleFromWorkspace(workspace);
  const summary = value(workspace, "mobile.needStatement") || value(workspace, "need.statement") || title;
  const scope = value(workspace, "scope.summary") || summary;
  const dueAt = value(workspace, "schedule.responseDeadline");
  const geography = value(workspace, "capabilities.geography");
  const estimatedValue = value(workspace, "commercial.estimatedValue");
  const rfxType = requestedType?.trim() || value(workspace, "mobile.recommendedType") || value(workspace, "need.rfxType") || "RFP";
  const deliverables = jsonArray(workspace, "deliverables");
  const requirements = jsonArray(workspace, "requirements");

  const rows = await sql.query(
    `WITH existing AS (
       SELECT er.id, er.organization_id::text AS organization_id
         FROM exchange_records er
        WHERE er.public_id = $1 AND er.record_type = 'rfx'
        LIMIT 1
     ), authorized_existing AS (
       SELECT id FROM existing WHERE organization_id = $2
     ), created AS (
       INSERT INTO exchange_records (public_id, record_type, organization_id, title, summary, status, metadata)
       SELECT $1, 'rfx', $2::uuid, $3, $4, 'active', jsonb_build_object('source', 'rfxchange')
        WHERE NOT EXISTS (SELECT 1 FROM existing)
       RETURNING id
     ), target AS (
       SELECT id FROM authorized_existing
       UNION ALL
       SELECT id FROM created
       LIMIT 1
     ), updated_exchange AS (
       UPDATE exchange_records er
          SET title = $3, summary = $4, status = 'active', updated_at = now()
         FROM target
        WHERE er.id = target.id
       RETURNING er.id
     ), upsert_rfx AS (
       INSERT INTO rfx_records (
         exchange_record_id, solicitation_type, due_at, requirements,
         source, lifecycle_status, issued_at, performance_geography,
         estimated_value, scope, deliverables, response_requirements,
         external_submission_required
       )
       SELECT id, $5, NULLIF($6, '')::timestamptz, $7::jsonb,
              'rfxchange', 'open', now(), jsonb_build_object('label', NULLIF($8, '')),
              jsonb_build_object('label', NULLIF($9, '')), jsonb_build_object('text', $10),
              $11::jsonb, '[]'::jsonb, false
         FROM updated_exchange
       ON CONFLICT (exchange_record_id)
       DO UPDATE SET solicitation_type = EXCLUDED.solicitation_type,
                     due_at = EXCLUDED.due_at,
                     requirements = EXCLUDED.requirements,
                     source = 'rfxchange',
                     lifecycle_status = 'open',
                     issued_at = COALESCE(rfx_records.issued_at, now()),
                     performance_geography = EXCLUDED.performance_geography,
                     estimated_value = EXCLUDED.estimated_value,
                     scope = EXCLUDED.scope,
                     deliverables = EXCLUDED.deliverables,
                     external_submission_required = false
       RETURNING id, exchange_record_id, issued_at
     ), activity AS (
       INSERT INTO activity_events (event_name, actor_user_id, organization_id, exchange_record_id, payload)
       SELECT 'RFxPublished', $12::uuid, $2::uuid, exchange_record_id,
              jsonb_build_object('publicId', $1, 'workspaceVersion', $13, 'rfxType', $5)
         FROM upsert_rfx
       RETURNING id, occurred_at
     )
     SELECT u.id::text AS rfx_id, a.id::text AS activity_id, a.occurred_at
       FROM upsert_rfx u CROSS JOIN activity a`,
    [recordId, actor.organizationId, title, summary, rfxType, dueAt, JSON.stringify(requirements), geography, estimatedValue, scope, JSON.stringify(deliverables), actor.userId, workspace.version],
  ) as Array<{ rfx_id: string; activity_id: string; occurred_at: string }>;

  if (!rows.length) throw new Error("RFx publication could not be committed. Confirm that the active organization owns this RFx.");
  return { receiptId: `PUB-${rows[0].activity_id}`, committedAt: rows[0].occurred_at, state: "open" };
}

async function targetRfx(recordId: string) {
  const sql = database();
  const rows = await sql.query(
    `SELECT rr.id::text AS rfx_id, er.organization_id::text AS issuer_organization_id,
            rr.source, rr.external_submission_required, rr.lifecycle_status
       FROM exchange_records er
       JOIN rfx_records rr ON rr.exchange_record_id = er.id
      WHERE er.public_id = $1 AND er.record_type = 'rfx'
      LIMIT 1`,
    [recordId],
  ) as Array<{ rfx_id: string; issuer_organization_id: string; source: string; external_submission_required: boolean; lifecycle_status: string }>;
  if (!rows.length) throw new Error("RFx record was not found.");
  return rows[0];
}

export async function submitHostedResponse(actor: RfxActorContext, recordId: string, workspace: RfxWorkspace) {
  const target = await targetRfx(recordId);
  if (target.issuer_organization_id === actor.organizationId) throw new Error("An issuer organization cannot submit a responder response to its own RFx.");
  if (target.source !== "rfxchange" || target.external_submission_required) throw new Error("This RFx requires submission through the authoritative external issuer channel.");
  if (!["open", "closing-soon"].includes(target.lifecycle_status)) throw new Error("This RFx is not currently accepting hosted responses.");

  const sql = database();
  const rows = await sql.query(
    `WITH response AS (
       INSERT INTO rfx_responses (rfx_record_id, respondent_organization_id, status, response_data, submitted_at, created_at, updated_at)
       VALUES ($1::uuid, $2::uuid, 'submitted', $3::jsonb, now(), now(), now())
       ON CONFLICT (rfx_record_id, respondent_organization_id)
       DO UPDATE SET status = 'submitted', response_data = EXCLUDED.response_data, submitted_at = now(), updated_at = now()
       RETURNING id, submitted_at
     ), pursuit AS (
       INSERT INTO rfx_pursuits (rfx_record_id, organization_id, state, started_at, submitted_at, updated_at)
       VALUES ($1::uuid, $2::uuid, 'submitted'::rfx_pursuit_state, now(), now(), now())
       ON CONFLICT (rfx_record_id, organization_id)
       DO UPDATE SET state = 'submitted'::rfx_pursuit_state, submitted_at = now(), updated_at = now()
       RETURNING id
     ), activity AS (
       INSERT INTO activity_events (event_name, actor_user_id, organization_id, payload)
       VALUES ('RFxResponseSubmitted', $4::uuid, $2::uuid, jsonb_build_object('publicId', $5, 'workspaceVersion', $6))
       RETURNING id
     )
     SELECT response.id::text AS response_id, response.submitted_at, activity.id::text AS activity_id
       FROM response CROSS JOIN pursuit CROSS JOIN activity`,
    [target.rfx_id, actor.organizationId, JSON.stringify(workspace), actor.userId, recordId, workspace.version],
  ) as Array<{ response_id: string; submitted_at: string; activity_id: string }>;

  if (!rows.length) throw new Error("The hosted response could not be committed.");
  return { receiptId: `RFXC-${rows[0].response_id.slice(0, 8).toUpperCase()}`, committedAt: rows[0].submitted_at, state: "submitted" };
}

export async function recordExternalSubmission(actor: RfxActorContext, recordId: string, workspace: RfxWorkspace, externalReference: string, submittedAt: string) {
  const target = await targetRfx(recordId);
  if (target.issuer_organization_id === actor.organizationId) throw new Error("An issuer organization cannot record a responder submission to its own RFx.");
  if (target.source === "rfxchange" && !target.external_submission_required) throw new Error("This RFx uses RFxchange-hosted submission; use the hosted submit action instead.");

  const submitted = new Date(submittedAt);
  if (Number.isNaN(submitted.getTime())) throw new Error("Enter a valid external submission date and time.");

  const sql = database();
  const rows = await sql.query(
    `WITH response AS (
       INSERT INTO rfx_responses (rfx_record_id, respondent_organization_id, status, response_data, submitted_at, external_submission_reference, created_at, updated_at)
       VALUES ($1::uuid, $2::uuid, 'external-submitted-self-reported', $3::jsonb, $4::timestamptz, $5, now(), now())
       ON CONFLICT (rfx_record_id, respondent_organization_id)
       DO UPDATE SET status = 'external-submitted-self-reported', response_data = EXCLUDED.response_data,
                     submitted_at = EXCLUDED.submitted_at, external_submission_reference = EXCLUDED.external_submission_reference, updated_at = now()
       RETURNING id, submitted_at
     ), pursuit AS (
       INSERT INTO rfx_pursuits (rfx_record_id, organization_id, state, started_at, submitted_at, updated_at)
       VALUES ($1::uuid, $2::uuid, 'submitted'::rfx_pursuit_state, now(), $4::timestamptz, now())
       ON CONFLICT (rfx_record_id, organization_id)
       DO UPDATE SET state = 'submitted'::rfx_pursuit_state, submitted_at = EXCLUDED.submitted_at, updated_at = now()
       RETURNING id
     ), activity AS (
       INSERT INTO activity_events (event_name, actor_user_id, organization_id, payload)
       VALUES ('RFxExternalSubmissionSelfReported', $6::uuid, $2::uuid,
               jsonb_build_object('publicId', $7, 'externalReference', $5, 'submittedAt', $4, 'workspaceVersion', $8))
       RETURNING id
     )
     SELECT response.id::text AS response_id, response.submitted_at, activity.id::text AS activity_id
       FROM response CROSS JOIN pursuit CROSS JOIN activity`,
    [target.rfx_id, actor.organizationId, JSON.stringify({ ...workspace, externalSubmission: { reference: externalReference, selfReported: true } }), submitted.toISOString(), externalReference, actor.userId, recordId, workspace.version],
  ) as Array<{ response_id: string; submitted_at: string; activity_id: string }>;

  if (!rows.length) throw new Error("The external submission status could not be recorded.");
  return { receiptId: `EXT-${rows[0].activity_id}`, externalReference, committedAt: rows[0].submitted_at, state: "external-submitted-self-reported" };
}
