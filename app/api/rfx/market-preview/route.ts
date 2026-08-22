import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { IdentitySessionUnauthorizedError } from "@/lib/identity/session-gateway";
import { loadPostgresRfxWorkspace } from "@/lib/rfx/postgres-repository";
import { actorCanWriteRfx, authorizeRfxWorkspaceRecord, resolveRfxActor } from "@/lib/rfx/runtime-actor";

export const runtime = "nodejs";

const stopWords = new Set(["about", "after", "before", "could", "deliver", "need", "provide", "request", "service", "services", "should", "their", "there", "these", "those", "through", "under", "using", "want", "with", "work"]);

function database() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) throw new Error("RFx market preview requires DATABASE_URL.");
  return neon(url);
}

function text(value: unknown) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function searchTerms(values: string[]) {
  const terms = values
    .flatMap((value) => value.toLowerCase().split(/[^a-z0-9+#.-]+/))
    .map((value) => value.trim())
    .filter((value) => value.length >= 4 && !stopWords.has(value));
  return [...new Set(terms)].slice(0, 20);
}

function serviceError(error: unknown) {
  const message = error instanceof Error ? error.message : "RFx market preview is unavailable.";
  if (error instanceof IdentitySessionUnauthorizedError) return NextResponse.json({ error: message }, { status: 401 });
  if (message.includes("DATABASE_URL") || message.includes("session service") || message.includes("RFXCHANGE_IDENTITY_SESSION_ENDPOINT")) return NextResponse.json({ error: message }, { status: 503 });
  if (message.includes("not found")) return NextResponse.json({ error: message }, { status: 404 });
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function GET(request: NextRequest) {
  try {
    const recordId = request.nextUrl.searchParams.get("recordId")?.trim();
    if (!recordId) return NextResponse.json({ error: "recordId is required." }, { status: 400 });

    const actor = await resolveRfxActor(request);
    if (!actorCanWriteRfx(actor)) throw new IdentitySessionUnauthorizedError("Your organization role cannot preview the RFx market.");
    await authorizeRfxWorkspaceRecord(actor, recordId, "issuer", "create-rfx");
    const workspace = await loadPostgresRfxWorkspace(recordId, "issuer", "create-rfx", actor);

    const requirementLabels = workspace.items.filter((item) => item.nodeId === "requirements").map((item) => item.label);
    const need = text(workspace.values["mobile.needStatement"] ?? workspace.values["need.statement"]);
    const terms = searchTerms(requirementLabels.length ? requirementLabels : [need]);
    const geography = text(workspace.values["capabilities.geography"]);

    const sql = database();
    const rows = await sql.query(
      `WITH org_capability AS (
         SELECT er.organization_id::text AS organization_id,
                bool_or(
                  cardinality($2::text[]) = 0 OR EXISTS (
                    SELECT 1
                      FROM unnest($2::text[]) AS term
                     WHERE lower(coalesce(er.title, '') || ' ' || coalesce(er.summary, '') || ' ' || coalesce(er.metadata::text, '') || ' ' || coalesce(c.amacs_node_id, ''))
                           LIKE '%' || term || '%'
                  )
                ) AS criteria_match,
                bool_or(
                  $3 = '' OR lower(coalesce(er.metadata::text, '') || ' ' || coalesce(l.address, '') || ' ' || coalesce(l.city, '') || ' ' || coalesce(l.state, ''))
                           LIKE '%' || lower($3) || '%'
                ) AS geography_match,
                bool_or(
                  c.amacs_node_id IS NOT NULL
                  OR jsonb_array_length(coalesce(c.evidence, '[]'::jsonb)) > 0
                  OR length(trim(coalesce(er.summary, ''))) >= 40
                ) AS structured_profile
           FROM exchange_records er
           JOIN capabilities c ON c.exchange_record_id = er.id
           LEFT JOIN locations l ON l.organization_id = er.organization_id
          WHERE er.record_type = 'capability'
            AND er.status = 'active'
            AND er.organization_id::text <> $1
          GROUP BY er.organization_id
       )
       SELECT count(*)::int AS potential,
              count(*) FILTER (WHERE criteria_match)::int AS criteria,
              count(*) FILTER (WHERE criteria_match AND geography_match)::int AS geography,
              count(*) FILTER (WHERE criteria_match AND geography_match AND structured_profile)::int AS structured
         FROM org_capability`,
      [actor.organizationId, terms, geography],
    ) as Array<{ potential: number; criteria: number; geography: number; structured: number }>;

    const counts = rows[0] ?? { potential: 0, criteria: 0, geography: 0, structured: 0 };
    return NextResponse.json({
      ...counts,
      terms,
      geography: counts.geography,
      geographyConstraint: geography || null,
      definitions: {
        potential: "Organizations with an active visible Capability record.",
        criteria: "Organizations whose visible capability content represents at least one RFx requirement/search term.",
        geography: geography ? "Criteria-aligned organizations with visible location context matching the RFx service geography." : "Criteria-aligned organizations; no RFx service-geography constraint is currently set.",
        structured: "Criteria/geography-aligned organizations with structured AMACS/evidence context or a substantive visible capability summary.",
      },
      qualificationBoundary: "Discovery context only. These counts are not qualification, eligibility, endorsement, or award prediction.",
    });
  } catch (error) {
    return serviceError(error);
  }
}
