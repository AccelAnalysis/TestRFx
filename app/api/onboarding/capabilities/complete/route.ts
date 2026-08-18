import { NextRequest, NextResponse } from "next/server";
import type { CapabilityDraft } from "@/lib/onboarding/capability-enrichment";
import { mergeOnboardingProgress } from "@/lib/onboarding/progress";
import {
  readOnboardingProgressFromRequest,
  writeOnboardingProgressCookie,
} from "@/lib/onboarding/progress-store";

interface CapabilityCompletionPayload {
  capabilities?: unknown;
  keywords?: unknown;
}

function isCapabilityDraft(value: unknown): value is CapabilityDraft {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<CapabilityDraft>;
  return Boolean(
    typeof candidate.id === "string" &&
      typeof candidate.name === "string" &&
      candidate.name.trim() &&
      typeof candidate.description === "string" &&
      Array.isArray(candidate.evidence) &&
      (candidate.mappingStatus === "suggested" || candidate.mappingStatus === "accepted" || candidate.mappingStatus === "needs-review") &&
      (candidate.publicationStatus === "draft" || candidate.publicationStatus === "ready" || candidate.publicationStatus === "published"),
  );
}

export async function POST(request: NextRequest) {
  let body: CapabilityCompletionPayload;
  try {
    body = (await request.json()) as CapabilityCompletionPayload;
  } catch {
    return NextResponse.json({ error: "A valid capability payload is required." }, { status: 400 });
  }

  const capabilities = Array.isArray(body.capabilities) ? body.capabilities.filter(isCapabilityDraft) : [];
  const keywords = Array.isArray(body.keywords)
    ? body.keywords.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim()).slice(0, 30)
    : [];

  if (!capabilities.length) {
    return NextResponse.json({ error: "Add at least one meaningful capability before Exchange-ready review." }, { status: 422 });
  }

  if (!capabilities.some((capability) => capability.publicationStatus !== "draft")) {
    return NextResponse.json({ error: "Mark at least one capability ready before Exchange-ready review." }, { status: 422 });
  }

  const acceptedMappings = capabilities.filter((capability) => capability.mappingStatus === "accepted").length;
  const evidenceCount = capabilities.reduce((count, capability) => count + capability.evidence.length, 0);
  const capabilityNames = capabilities.map((capability) => capability.name.trim()).filter(Boolean).slice(0, 12);

  const progress = mergeOnboardingProgress(readOnboardingProgressFromRequest(request), {
    checkpoints: [
      {
        id: "capability_profile",
        status: "complete",
        value: `${capabilityNames.length} capability ${capabilityNames.length === 1 ? "claim" : "claims"}`,
      },
      {
        id: "amacs_alignment",
        status: acceptedMappings > 0 ? "complete" : "recommended",
        value: acceptedMappings > 0 ? `${acceptedMappings} mapping ${acceptedMappings === 1 ? "confirmed" : "confirmed"}` : "No confirmed mapping yet",
      },
      {
        id: "evidence",
        status: evidenceCount > 0 ? "complete" : "recommended",
        value: evidenceCount > 0 ? `${evidenceCount} evidence ${evidenceCount === 1 ? "item" : "items"}` : "No evidence added yet",
      },
      {
        id: "keywords",
        status: keywords.length > 0 ? "complete" : "recommended",
        value: keywords.length > 0 ? `${keywords.length} discoverability ${keywords.length === 1 ? "term" : "terms"}` : "No additional terms yet",
      },
    ],
    context: {
      capabilitySummary: capabilityNames,
      amacsSummary: acceptedMappings > 0 ? `${acceptedMappings} organization-confirmed AMACS mapping${acceptedMappings === 1 ? "" : "s"}` : "AMACS enrichment can continue later",
    },
  });

  const response = NextResponse.json({ ok: true, nextPath: "/onboarding/completion", progress });
  writeOnboardingProgressCookie(response, progress);
  return response;
}
