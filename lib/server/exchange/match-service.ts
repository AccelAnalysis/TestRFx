import type { ExchangeServerActor } from "@/lib/server/exchange/actor";
import { getDatabase } from "@/lib/server/database";
import { SharedExchangeWorkflowError } from "@/lib/server/exchange/shared-workflow-service";

export interface GovernedMatchResult {
  recordId: string;
  title: string;
  organization: string;
  coverage: "strong" | "partial" | "gap" | "uncertain";
  aligned: number;
  missing: number;
  uncertain: number;
  total: number;
  summary: string;
  requirements: Array<{ key: string; label: string; state: "aligned" | "missing" | "uncertain"; mandatory: boolean; amacsConceptId?: string }>;
}

type RfxRequirementRow = {
  rfx_record_id: string;
  exchange_record_id: string;
  public_id: string;
  title: string;
  organization: string;
  requirement_key: string | null;
  label: string | null;
  mandatory: boolean | null;
  metadata: unknown;
};

function structuredAmacsConcept(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return undefined;
  const record = metadata as Record<string, unknown>;
  const value = record.amacsConceptId ?? record.amacs_concept_id ?? record.amacsNodeId ?? record.amacs_node_id;
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function coverage(aligned: number, missing: number, uncertain: number, total: number): GovernedMatchResult["coverage"] {
  if (!total || uncertain === total) return "uncertain";
  if (missing > 0 && aligned === 0) return "gap";
  if (missing > 0 || uncertain > 0) return "partial";
  return "strong";
}

export async function requestGovernedMatch(input: { actor: ExchangeServerActor; recordPublicId: string }) {
  const sql = getDatabase();
  const source = await sql<{ id: string; organization_id: string; record_type: string }[]>`
    SELECT id::text, organization_id::text, record_type::text
    FROM exchange_records
    WHERE public_id = ${input.recordPublicId} AND status = 'active'
    LIMIT 1
  `;
  const record = source[0];
  if (!record) throw new SharedExchangeWorkflowError(404, "Exchange record not found.");
  if (record.record_type !== "capability") {
    throw new SharedExchangeWorkflowError(503, `Governed matching is not configured for ${record.record_type} records yet.`);
  }

  const capabilityConcepts = await sql<{ concept_id: string }[]>`
    SELECT DISTINCT amacs_concept_id AS concept_id
    FROM organization_capability_claims
    WHERE organization_id = ${record.organization_id}::uuid
      AND claim_status = 'active'
      AND mapping_status = 'accepted'
      AND amacs_concept_id IS NOT NULL
  `;
  const conceptIds = new Set(capabilityConcepts.map((item) => item.concept_id));

  const queriedRows = await sql<RfxRequirementRow[]>`
    SELECT rr.id::text AS rfx_record_id,
           er.id::text AS exchange_record_id,
           er.public_id,
           er.title,
           o.name AS organization,
           req.requirement_key,
           req.label,
           req.mandatory,
           req.metadata
    FROM rfx_records rr
    JOIN exchange_records er ON er.id = rr.exchange_record_id
    JOIN organizations o ON o.id = er.organization_id
    LEFT JOIN rfx_requirements req ON req.rfx_record_id = rr.id
    WHERE er.status = 'active'
      AND COALESCE(rr.lifecycle_status, 'open') IN ('open', 'issued', 'active')
    ORDER BY er.updated_at DESC, er.public_id, req.sort_order, req.requirement_key
  `;
  const rfxRows: RfxRequirementRow[] = Array.from(queriedRows);

  const grouped = new Map<string, RfxRequirementRow[]>();
  for (const row of rfxRows) {
    const list = grouped.get(row.exchange_record_id) ?? [];
    list.push(row);
    grouped.set(row.exchange_record_id, list);
  }

  const results: GovernedMatchResult[] = [];
  for (const rows of grouped.values()) {
    const head = rows[0];
    if (!head) continue;
    const requirements = rows
      .filter((row) => row.requirement_key && row.label)
      .map((row) => {
        const amacsConceptId = structuredAmacsConcept(row.metadata);
        const state: "aligned" | "missing" | "uncertain" = !amacsConceptId
          ? "uncertain"
          : conceptIds.has(amacsConceptId)
            ? "aligned"
            : "missing";
        return { key: row.requirement_key as string, label: row.label as string, state, mandatory: Boolean(row.mandatory), amacsConceptId };
      });
    const aligned = requirements.filter((item) => item.state === "aligned").length;
    const missing = requirements.filter((item) => item.state === "missing" && item.mandatory).length;
    const uncertain = requirements.filter((item) => item.state === "uncertain").length;
    const total = requirements.length;
    const status = coverage(aligned, missing, uncertain, total);
    const summary = total
      ? `${aligned} aligned · ${missing} mandatory gap${missing === 1 ? "" : "s"} · ${uncertain} unstructured/uncertain`
      : "No structured RFx requirements are published for governed matching.";
    results.push({ recordId: head.public_id, title: head.title, organization: head.organization, coverage: status, aligned, missing, uncertain, total, summary, requirements });

    const score = total ? aligned / total : null;
    await sql`
      INSERT INTO match_decisions (source_exchange_record_id, matched_exchange_record_id, requested_by_user_id, score, rationale, status)
      VALUES (${record.id}::uuid, ${head.exchange_record_id}::uuid, ${input.actor.userId}::uuid, ${score}, ${sql.json(requirements)}, 'suggested')
      ON CONFLICT (source_exchange_record_id, matched_exchange_record_id, requested_by_user_id)
      DO UPDATE SET score = EXCLUDED.score, rationale = EXCLUDED.rationale, status = EXCLUDED.status, created_at = now()
    `;
  }

  return results.sort((left, right) => {
    const rank = { strong: 0, partial: 1, gap: 2, uncertain: 3 } as const;
    return rank[left.coverage] - rank[right.coverage] || right.aligned - left.aligned || left.title.localeCompare(right.title);
  });
}
