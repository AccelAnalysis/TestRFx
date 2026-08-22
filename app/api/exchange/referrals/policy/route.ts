import { NextRequest, NextResponse } from "next/server";
import { DatabaseServiceUnavailableError } from "@/lib/server/database";
import { ExchangeUnauthorizedError, resolveExchangeActor } from "@/lib/server/exchange/actor";
import { readSharedReferralPolicy } from "@/lib/server/exchange/shared-workflow-service";

export const dynamic = "force-dynamic";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  try {
    await resolveExchangeActor(request);
    const organizationId = request.nextUrl.searchParams.get("organizationId")?.trim() ?? "";
    if (!uuidPattern.test(organizationId)) return NextResponse.json({ error: "A valid recipient organizationId is required." }, { status: 400 });
    const policy = await readSharedReferralPolicy(organizationId);
    return NextResponse.json({ policy, persistence: "postgresql" });
  } catch (error) {
    if (error instanceof ExchangeUnauthorizedError) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error instanceof DatabaseServiceUnavailableError) return NextResponse.json({ error: error.message }, { status: 503 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Referral policy is unavailable." }, { status: 500 });
  }
}
