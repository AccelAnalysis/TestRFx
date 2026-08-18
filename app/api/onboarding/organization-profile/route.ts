import { NextResponse } from "next/server";
import {
  organizationProfileHandoffHref,
  validateOrganizationProfilePayload,
  type OrganizationProfileAccepted,
} from "@/lib/onboarding/organization-profile";

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ errors: { form: "Organization profile details must be valid JSON." } }, { status: 400 });
  }

  const result = validateOrganizationProfilePayload(payload);
  if (!result.ok) return NextResponse.json({ errors: result.errors }, { status: 400 });

  const organizationId = result.submission.context.organizationId || crypto.randomUUID();
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
    adapter: "reference",
  };

  return NextResponse.json(accepted, { status: 201 });
}
