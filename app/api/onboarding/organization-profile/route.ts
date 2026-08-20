import { NextRequest, NextResponse } from "next/server";
import { DatabaseServiceUnavailableError } from "@/lib/server/database";
import {
  OnboardingForbiddenError,
  OnboardingUnauthorizedError,
  resolveOnboardingActor,
} from "@/lib/server/onboarding/actor";
import {
  createOrganizationInvitation,
  getOrganizationProfileSnapshot,
  removeOrganizationMember,
  revokeOrganizationInvitation,
  saveOrganizationProfile,
  updateOrganizationMember,
} from "@/lib/server/onboarding/organization-profile-service";
import { validateOrganizationProfilePayload } from "@/lib/onboarding/organization-profile";

export const runtime = "nodejs";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function serviceError(error: unknown) {
  if (error instanceof DatabaseServiceUnavailableError) {
    return NextResponse.json({ error: error.message }, { status: 503 });
  }
  if (error instanceof OnboardingUnauthorizedError) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  if (error instanceof OnboardingForbiddenError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  console.error("Organization Profile service failure", error);
  return NextResponse.json({ error: "The Organization Profile service could not complete the request." }, { status: 500 });
}

function requestedOrganization(request: NextRequest) {
  const organizationId = request.nextUrl.searchParams.get("organization")?.trim();
  return organizationId && uuidPattern.test(organizationId) ? organizationId : undefined;
}

export async function GET(request: NextRequest) {
  try {
    const organizationId = requestedOrganization(request);
    if (!organizationId) return NextResponse.json({ error: "A valid organization identifier is required." }, { status: 400 });
    const actor = await resolveOnboardingActor(request, organizationId);
    return NextResponse.json(await getOrganizationProfileSnapshot(actor));
  } catch (error) {
    return serviceError(error);
  }
}

export async function PUT(request: NextRequest) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ errors: { form: "Organization profile details must be valid JSON." } }, { status: 400 });
  }

  const mode = payload && typeof payload === "object" && !Array.isArray(payload) && (payload as Record<string, unknown>).mode === "complete"
    ? "complete"
    : "draft";
  const profilePayload = payload && typeof payload === "object" && !Array.isArray(payload)
    ? (payload as Record<string, unknown>).profile
    : undefined;
  const result = validateOrganizationProfilePayload(profilePayload, mode === "complete");
  if (!result.ok) return NextResponse.json({ errors: result.errors }, { status: 400 });

  try {
    const organizationId = result.submission.context.organizationId;
    const actor = await resolveOnboardingActor(request, organizationId);
    const accepted = await saveOrganizationProfile(actor, result.submission, mode === "complete");
    return NextResponse.json(accepted, { status: mode === "complete" ? 200 : 200 });
  } catch (error) {
    return serviceError(error);
  }
}

export async function POST(request: NextRequest) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "The Organization Profile action must be valid JSON." }, { status: 400 });
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return NextResponse.json({ error: "An Organization Profile action is required." }, { status: 400 });
  }

  const body = payload as Record<string, unknown>;
  const organizationId = typeof body.organizationId === "string" && uuidPattern.test(body.organizationId) ? body.organizationId : undefined;
  if (!organizationId) return NextResponse.json({ error: "A valid organization identifier is required." }, { status: 400 });

  try {
    const actor = await resolveOnboardingActor(request, organizationId);
    switch (body.action) {
      case "create_invitation": {
        const email = typeof body.email === "string" ? body.email : "";
        const role = typeof body.role === "string" ? body.role : "";
        const permissions = Array.isArray(body.permissions)
          ? body.permissions.filter((value): value is string => typeof value === "string")
          : [];
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          return NextResponse.json({ error: "Enter a valid invitation email address." }, { status: 400 });
        }
        return NextResponse.json(await createOrganizationInvitation(actor, { email, role, permissions }), { status: 201 });
      }
      case "revoke_invitation": {
        const invitationId = typeof body.invitationId === "string" && uuidPattern.test(body.invitationId) ? body.invitationId : undefined;
        if (!invitationId) return NextResponse.json({ error: "A valid invitation identifier is required." }, { status: 400 });
        return NextResponse.json(await revokeOrganizationInvitation(actor, invitationId));
      }
      case "update_member": {
        const userId = typeof body.userId === "string" && uuidPattern.test(body.userId) ? body.userId : undefined;
        const role = typeof body.role === "string" ? body.role : "";
        const permissions = Array.isArray(body.permissions)
          ? body.permissions.filter((value): value is string => typeof value === "string")
          : [];
        if (!userId || !role.trim()) return NextResponse.json({ error: "A valid member and role are required." }, { status: 400 });
        return NextResponse.json(await updateOrganizationMember(actor, { userId, role, permissions }));
      }
      case "remove_member": {
        const userId = typeof body.userId === "string" && uuidPattern.test(body.userId) ? body.userId : undefined;
        if (!userId) return NextResponse.json({ error: "A valid member identifier is required." }, { status: 400 });
        return NextResponse.json(await removeOrganizationMember(actor, userId));
      }
      default:
        return NextResponse.json({ error: "Unsupported Organization Profile action." }, { status: 400 });
    }
  } catch (error) {
    return serviceError(error);
  }
}
