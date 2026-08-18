import { NextResponse } from "next/server";
import {
  acceptAmacsMapping,
  addCapabilityEvidence,
  archiveCapabilityClaim,
  assertOrganizationMembership,
  CapabilityServiceError,
  deleteCapabilityEvidence,
  getCapabilityEnrichmentSnapshot,
  saveCapabilityProgress,
  saveCapabilitySolution,
  saveCapabilityTerms,
  upsertCapabilityClaim,
} from "@/lib/server/capability-enrichment-repository";
import { ServiceConfigurationError } from "@/lib/server/postgres";
import type { CapabilityEvidenceKind } from "@/lib/onboarding/capability-enrichment";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EVIDENCE_KINDS = new Set<CapabilityEvidenceKind>(["certification", "license", "case-study", "supporting-document"]);
const TERM_FIELDS = new Set(["tags", "keywords", "specialties"]);

function actorUserId(request: Request) {
  return request.headers.get("x-rfxchange-user-id")?.trim() || undefined;
}

function organizationIdFromUrl(request: Request) {
  return new URL(request.url).searchParams.get("organizationId")?.trim() ?? "";
}

function requiredString(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim()) throw new CapabilityServiceError(400, `${label} is required.`);
  return value.trim();
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function requireUuid(value: unknown, label: string) {
  const text = requiredString(value, label);
  if (!UUID.test(text)) throw new CapabilityServiceError(400, `${label} must be a UUID.`);
  return text;
}

function jsonError(error: unknown) {
  if (error instanceof CapabilityServiceError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof ServiceConfigurationError) return NextResponse.json({ error: error.message, service: "postgres" }, { status: 503 });
  console.error(error);
  return NextResponse.json({ error: "Capability Enrichment service failed." }, { status: 500 });
}

export async function GET(request: Request) {
  try {
    const organizationId = requireUuid(organizationIdFromUrl(request), "organizationId");
    await assertOrganizationMembership(actorUserId(request), organizationId);
    return NextResponse.json(await getCapabilityEnrichmentSnapshot(organizationId));
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json() as Record<string, unknown>;
    const action = requiredString(payload.action, "action");
    const organizationId = requireUuid(payload.organizationId, "organizationId");
    const userId = actorUserId(request);
    await assertOrganizationMembership(userId, organizationId);
    if (!userId) throw new CapabilityServiceError(401, "Authenticated user context is required.");

    if (action === "upsert-claim") {
      const id = optionalString(payload.id);
      if (id && !UUID.test(id)) throw new CapabilityServiceError(400, "id must be a UUID.");
      const result = await upsertCapabilityClaim({
        organizationId,
        actorUserId: userId,
        id,
        name: requiredString(payload.name, "name"),
        description: requiredString(payload.description, "description"),
      });
      return NextResponse.json(result, { status: id ? 200 : 201 });
    }

    if (action === "save-solution") {
      await saveCapabilitySolution({ organizationId, actorUserId: userId, claimId: requireUuid(payload.claimId, "claimId"), solution: requiredString(payload.solution, "solution") });
      return NextResponse.json({ ok: true });
    }

    if (action === "archive-claim") {
      await archiveCapabilityClaim({ organizationId, actorUserId: userId, claimId: requireUuid(payload.claimId, "claimId") });
      return NextResponse.json({ ok: true });
    }

    if (action === "accept-amacs-mapping") {
      await acceptAmacsMapping({
        organizationId,
        actorUserId: userId,
        claimId: requireUuid(payload.claimId, "claimId"),
        releaseId: requireUuid(payload.releaseId, "releaseId"),
        conceptId: requiredString(payload.conceptId, "conceptId"),
      });
      return NextResponse.json({ ok: true });
    }

    if (action === "add-evidence") {
      const kind = requiredString(payload.kind, "kind") as CapabilityEvidenceKind;
      if (!EVIDENCE_KINDS.has(kind)) throw new CapabilityServiceError(400, "Unsupported evidence kind.");
      const sourceUrl = optionalString(payload.sourceUrl);
      if (kind === "supporting-document" && !sourceUrl) throw new CapabilityServiceError(400, "Supporting documents require an authoritative source URL.");
      if (sourceUrl) {
        try { new URL(sourceUrl); } catch { throw new CapabilityServiceError(400, "sourceUrl must be a valid absolute URL."); }
      }
      const result = await addCapabilityEvidence({
        organizationId,
        actorUserId: userId,
        claimId: requireUuid(payload.claimId, "claimId"),
        kind,
        label: requiredString(payload.label, "label"),
        issuer: optionalString(payload.issuer),
        sourceUrl,
        notes: optionalString(payload.notes),
      });
      return NextResponse.json(result, { status: 201 });
    }

    if (action === "delete-evidence") {
      await deleteCapabilityEvidence({ organizationId, actorUserId: userId, evidenceId: requireUuid(payload.evidenceId, "evidenceId") });
      return NextResponse.json({ ok: true });
    }

    if (action === "save-terms") {
      const field = requiredString(payload.field, "field");
      if (!TERM_FIELDS.has(field)) throw new CapabilityServiceError(400, "field must be tags, keywords, or specialties.");
      if (!Array.isArray(payload.values)) throw new CapabilityServiceError(400, "values must be an array.");
      const values = [...new Set(payload.values.filter((value): value is string => typeof value === "string").map((value) => value.trim()).filter(Boolean))].slice(0, 100);
      await saveCapabilityTerms({ organizationId, actorUserId: userId, field: field as "tags" | "keywords" | "specialties", values });
      return NextResponse.json({ ok: true });
    }

    if (action === "save-progress") {
      if (!Array.isArray(payload.path) || !payload.path.every((value) => typeof value === "string")) throw new CapabilityServiceError(400, "path must be a string array.");
      await saveCapabilityProgress({ organizationId, actorUserId: userId, path: payload.path as string[], completedLeafPath: optionalString(payload.completedLeafPath) });
      return NextResponse.json({ ok: true });
    }

    throw new CapabilityServiceError(400, "Unsupported capability enrichment action.");
  } catch (error) {
    return jsonError(error);
  }
}
