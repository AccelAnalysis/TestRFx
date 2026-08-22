import { NextRequest, NextResponse } from "next/server";
import { DatabaseServiceUnavailableError } from "@/lib/server/database";
import {
  OnboardingForbiddenError,
  OnboardingUnauthorizedError,
  resolveOnboardingActor,
} from "@/lib/server/onboarding/actor";
import {
  getOrganizationMedia,
  removeOrganizationIntroVideo,
  saveLinkedOrganizationIntroVideo,
} from "@/lib/server/onboarding/organization-media-service";

export const runtime = "nodejs";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function errorResponse(error: unknown) {
  if (error instanceof DatabaseServiceUnavailableError) return NextResponse.json({ error: error.message }, { status: 503 });
  if (error instanceof OnboardingUnauthorizedError) return NextResponse.json({ error: error.message }, { status: 401 });
  if (error instanceof OnboardingForbiddenError) return NextResponse.json({ error: error.message }, { status: 403 });
  const message = error instanceof Error ? error.message : "Organization media could not be updated.";
  const status = /YouTube|Vimeo|video link/i.test(message) ? 400 : 500;
  if (status === 500) console.error("Organization media service failure", error);
  return NextResponse.json({ error: message }, { status });
}

function organizationFromRequest(request: NextRequest) {
  const organizationId = request.nextUrl.searchParams.get("organization")?.trim();
  return organizationId && uuidPattern.test(organizationId) ? organizationId : undefined;
}

export async function GET(request: NextRequest) {
  const organizationId = organizationFromRequest(request);
  if (!organizationId) return NextResponse.json({ error: "A valid organization identifier is required." }, { status: 400 });
  try {
    const actor = await resolveOnboardingActor(request, organizationId);
    return NextResponse.json(await getOrganizationMedia(actor));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    const payload = await request.json();
    body = payload && typeof payload === "object" && !Array.isArray(payload) ? payload as Record<string, unknown> : {};
  } catch {
    return NextResponse.json({ error: "Video details must be valid JSON." }, { status: 400 });
  }
  const organizationId = typeof body.organizationId === "string" && uuidPattern.test(body.organizationId) ? body.organizationId : undefined;
  const videoUrl = typeof body.videoUrl === "string" ? body.videoUrl.trim() : "";
  if (!organizationId) return NextResponse.json({ error: "A valid organization identifier is required." }, { status: 400 });
  if (!videoUrl) return NextResponse.json({ error: "Paste a YouTube or Vimeo video link." }, { status: 400 });
  try {
    const actor = await resolveOnboardingActor(request, organizationId);
    return NextResponse.json(await saveLinkedOrganizationIntroVideo(actor, videoUrl));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: NextRequest) {
  const organizationId = organizationFromRequest(request);
  if (!organizationId) return NextResponse.json({ error: "A valid organization identifier is required." }, { status: 400 });
  try {
    const actor = await resolveOnboardingActor(request, organizationId);
    return NextResponse.json(await removeOrganizationIntroVideo(actor));
  } catch (error) {
    return errorResponse(error);
  }
}
