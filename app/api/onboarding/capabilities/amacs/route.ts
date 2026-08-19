import { NextResponse } from "next/server";
import { assertOrganizationMembership, CapabilityServiceError, searchActiveAmacsConcepts } from "@/lib/server/capability-enrichment-repository";
import { query, ServiceConfigurationError } from "@/lib/server/postgres";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function jsonError(error: unknown) {
  if (error instanceof CapabilityServiceError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof ServiceConfigurationError) return NextResponse.json({ error: error.message, service: "postgres" }, { status: 503 });
  console.error(error);
  return NextResponse.json({ error: "AMACS service failed." }, { status: 500 });
}

export async function GET(request: Request) {
  try {
    const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
    if (q.length < 2) return NextResponse.json({ candidates: [] });
    return NextResponse.json({ candidates: await searchActiveAmacsConcepts(q) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json() as { organizationId?: unknown; text?: unknown };
    const organizationId = typeof payload.organizationId === "string" ? payload.organizationId.trim() : "";
    const text = typeof payload.text === "string" ? payload.text.trim() : "";
    const userId = request.headers.get("x-rfxchange-user-id")?.trim() || undefined;
    if (!UUID.test(organizationId)) throw new CapabilityServiceError(400, "organizationId must be a UUID.");
    if (text.length < 4) throw new CapabilityServiceError(400, "Capability text is required for interpretation.");
    await assertOrganizationMembership(userId, organizationId);

    const interpretationUrl = process.env.AMACS_INTERPRETATION_URL?.trim();
    if (!interpretationUrl) {
      return NextResponse.json({
        error: "AI-to-AMACS interpretation is not configured. Use the deployed AMACS Suggestions workflow for manual search and confirmation.",
        service: "amacs-interpretation",
      }, { status: 503 });
    }

    const release = await query<{ id: string; version: string; source_commit_sha: string }>(
      "SELECT id, version, source_commit_sha FROM amacs_runtime_releases WHERE active = true LIMIT 1",
    );
    if (!release.rowCount) throw new CapabilityServiceError(503, "No AMACS release has been deployed to RFxchange.");
    const active = release.rows[0];

    const response = await fetch(interpretationUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(process.env.AMACS_INTERPRETATION_TOKEN ? { authorization: `Bearer ${process.env.AMACS_INTERPRETATION_TOKEN}` } : {}),
      },
      body: JSON.stringify({
        source_text: text,
        amacs_release: { id: active.id, version: active.version, source_commit_sha: active.source_commit_sha.trim() },
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new CapabilityServiceError(502, `Configured interpretation service returned ${response.status}.`);

    const result = await response.json() as { candidates?: Array<{ conceptId?: unknown; confidence?: unknown; rationale?: unknown }> };
    const requested = (result.candidates ?? [])
      .filter((item) => typeof item.conceptId === "string")
      .slice(0, 12)
      .map((item) => ({ conceptId: item.conceptId as string, confidence: typeof item.confidence === "number" ? item.confidence : undefined, rationale: typeof item.rationale === "string" ? item.rationale : undefined }));
    if (!requested.length) return NextResponse.json({ release: { version: active.version, sourceCommitSha: active.source_commit_sha.trim() }, candidates: [] });

    const concepts = await query<{ concept_id: string; preferred_label: string; definition: string; primary_parent_id: string | null }>(
      `SELECT concept_id, preferred_label, definition, primary_parent_id
       FROM amacs_runtime_concepts
       WHERE release_id = $1::uuid AND matchable = true AND status = 'active' AND concept_id = ANY($2::text[])`,
      [active.id, requested.map((item) => item.conceptId)],
    );
    const canonical = new Map(concepts.rows.map((row) => [row.concept_id, row]));
    const candidates = requested.flatMap((candidate) => {
      const concept = canonical.get(candidate.conceptId);
      if (!concept) return [];
      return [{
        releaseId: active.id,
        releaseVersion: active.version,
        conceptId: concept.concept_id,
        label: concept.preferred_label,
        definition: concept.definition,
        parentId: concept.primary_parent_id ?? undefined,
        sourceCommitSha: active.source_commit_sha.trim(),
        confidence: candidate.confidence,
        rationale: candidate.rationale,
      }];
    });

    return NextResponse.json({ release: { version: active.version, sourceCommitSha: active.source_commit_sha.trim() }, candidates });
  } catch (error) {
    return jsonError(error);
  }
}
