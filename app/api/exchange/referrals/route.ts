import { NextRequest, NextResponse } from "next/server";
import { DatabaseServiceUnavailableError } from "@/lib/server/database";
import { ExchangeUnauthorizedError, resolveExchangeActor } from "@/lib/server/exchange/actor";
import { listExchangeReferrals } from "@/lib/server/exchange/referral-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const actor = await resolveExchangeActor(request);
    const referrals = await listExchangeReferrals(actor);
    return NextResponse.json({ referrals, persistence: "postgresql" });
  } catch (error) {
    if (error instanceof ExchangeUnauthorizedError) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error instanceof DatabaseServiceUnavailableError) return NextResponse.json({ error: error.message }, { status: 503 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Referrals could not be loaded." }, { status: 500 });
  }
}
