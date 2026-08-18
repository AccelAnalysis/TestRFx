import { NextRequest, NextResponse } from "next/server";
import { resolveExchangeActor } from "@/lib/server/exchange/actor";
import { exchangeServiceErrorResponse } from "@/lib/server/exchange/http";
import { parseReferral } from "@/lib/server/exchange/resource-input";
import { createResourceReferral } from "@/lib/server/exchange/resource-service";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const actor = await resolveExchangeActor(request);
    const input = parseReferral(await request.json());
    const referral = await createResourceReferral(actor, input.recordId, {
      recipientOrganization: input.recipientOrganization,
      message: input.message,
    });
    return NextResponse.json({ referral }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return exchangeServiceErrorResponse(error);
  }
}
