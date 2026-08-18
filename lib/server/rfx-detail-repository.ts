import type { ExchangeActor } from "./exchange-actor";
import { query } from "./database";

function textFromJson(value: unknown) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    return typeof record.text === "string" ? record.text : typeof record.label === "string" ? record.label : "";
  }
  return "";
}

function listFromJson(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

type RfxDetailRow = {
  record_id: string;
  title: string;
  summary: string;
  organization_id: string;
  organization_name: string;
  solicitation_type: string | null;
  solicitation_number: string | null;
  lifecycle_status: string;
  due_at: string | null;
  performance_geography: unknown;
  scope: unknown;
  deliverables: unknown;
  response_requirements: unknown;
  evaluation_method: unknown;
  external_submission_required: boolean;
  owned_by_viewer: boolean;
};

export async function getRfxWorkflowDetail(recordId: string, actor: ExchangeActor) {
  const result = await query<RfxDetailRow>(`
    SELECT
      er.public_id AS record_id,
      er.title,
      er.summary,
      er.organization_id::text,
      o.name AS organization_name,
      rr.solicitation_type,
      rr.solicitation_number,
      rr.lifecycle_status,
      rr.due_at::text,
      rr.performance_geography,
      rr.scope,
      rr.deliverables,
      rr.response_requirements,
      rr.evaluation_method,
      rr.external_submission_required,
      (m.user_id IS NOT NULL) AS owned_by_viewer
    FROM exchange_records er
    JOIN organizations o ON o.id = er.organization_id
    JOIN rfx_records rr ON rr.exchange_record_id = er.id
    LEFT JOIN organization_memberships m ON m.organization_id = er.organization_id AND m.user_id = $2::uuid
    WHERE er.public_id = $1
    LIMIT 1
  `, [recordId, actor.userId]);
  const row = result.rows[0];
  if (!row) return undefined;
  return {
    recordId: row.record_id,
    title: row.title,
    summary: row.summary,
    organizationId: row.organization_id,
    organizationName: row.organization_name,
    solicitationType: row.solicitation_type ?? "RFP",
    solicitationNumber: row.solicitation_number ?? "",
    status: row.lifecycle_status,
    dueAt: row.due_at ? row.due_at.slice(0, 16) : "",
    geography: textFromJson(row.performance_geography),
    scope: textFromJson(row.scope),
    deliverables: listFromJson(row.deliverables),
    responseRequirements: listFromJson(row.response_requirements),
    evaluationMethod: textFromJson(row.evaluation_method),
    externalSubmissionRequired: row.external_submission_required,
    ownedByViewer: row.owned_by_viewer,
  };
}
