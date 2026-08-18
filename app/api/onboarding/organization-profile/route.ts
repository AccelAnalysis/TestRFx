import { NextRequest, NextResponse } from "next/server";
import {
  organizationProfileHandoffHref,
  validateOrganizationProfilePayload,
  type OrganizationProfileAccepted,
} from "@/lib/onboarding/organization-profile";
import { mergeOnboardingProgress } from "@/lib/onboarding/progress";
import {
  readOnboardingProgressFromRequest,
  writeOnboardingProgressCookie,
} from "@/lib/onboarding/progress-store";

export async function POST(request: NextRequest) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ errors: { form: "Organization profile details must be valid JSON." } }, { status: 400 });
  }

  const result = validateOrganizationProfilePayload(payload);
  if (!result.ok) return NextResponse.json({ errors: result.errors }, { status: 400 });

  const organizationId = result.submission.context.organizationId || crypto.randomUUID();
  const visibilityLabel = result.submission.searchable
    ? result.submission.mapVisible
      ? `Searchable · ${result.submission.locationVisibility} location preference`
      : "Searchable · no public map placement"
    : "Not discoverable in Exchange search";

  const accepted: OrganizationProfileAccepted = {
    status: "profile_complete",
    organizationId,
    organizationName: result.submission.displayName,
    nextStep: "capability_enrichment",
    handoffHref: organizationProfileHandoffHref(organizationId, result.submission.context),
    completion: {
      identity: true,
      contact: true,
      location: true,
      serviceGeography: true,
      role: true,
      visibility: true,
      capabilitySeed: true,
    },
    context: result.submission.context,
  };

  const progress = mergeOnboardingProgress(readOnboardingProgressFromRequest(request), {
    checkpoints: [
      { id: "organization_profile", status: "complete", value: result.submission.displayName },
      { id: "visibility", status: "complete", value: visibilityLabel },
    ],
    context: {
      organizationId,
      organizationName: result.submission.displayName,
      geography: result.submission.context.geography,
      visibility: visibilityLabel,
      mapPresence: "off_map",
      capabilitySummary: [result.submission.capabilitySeed],
    },
  });

  const response = NextResponse.json(accepted, { status: 201 });
  writeOnboardingProgressCookie(response, progress);
  return response;
}
