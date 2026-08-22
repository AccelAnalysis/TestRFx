import { NextRequest, NextResponse } from "next/server";
import { resolveExchangeActor, ExchangeForbiddenError, ExchangeUnauthorizedError } from "@/lib/server/exchange/actor";
import { DatabaseServiceUnavailableError } from "@/lib/server/database";
import { CapabilityExchangeServiceError, listCapabilityProfiles, publishCapabilityProfile } from "@/lib/server/exchange/capability-service";

export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  if (error instanceof CapabilityExchangeServiceError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof ExchangeUnauthorizedError) return NextResponse.json({ error: error.message }, { status: 401 });
  if (error instanceof ExchangeForbiddenError) return NextResponse.json({ error: error.message }, { status: 403 });
  if (error instanceof DatabaseServiceUnavailableError) return NextResponse.json({ error: error.message, service: "postgresql" }, { status: 503 });
  console.error(error);
  return NextResponse.json({ error: "Capabilities service failed." }, { status: 500 });
}

export async function GET(request: NextRequest) {
  try {
    const actor = await resolveExchangeActor(request);
    const profiles = await listCapabilityProfiles(actor);
    return NextResponse.json({
      profiles,
      records: profiles.map((profile) => ({
        id: profile.exchangeRecordId,
        type: "capability" as const,
        title: profile.capabilities[0]?.name ?? "Capability profile",
        organization: profile.organizationName,
        summary: profile.summary,
        geography: profile.geography,
      })),
      persistence: "postgresql",
      actorOrganizationId: actor.organizationId,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await resolveExchangeActor(request);
    const body = await request.json().catch(() => null) as { action?: unknown } | null;
    if (body?.action !== "publish") return NextResponse.json({ error: "Unsupported Capabilities action." }, { status: 400 });
    const result = await publishCapabilityProfile(actor);
    return NextResponse.json({ ...result, persistence: "postgresql" });
  } catch (error) {
    return errorResponse(error);
  }
}
