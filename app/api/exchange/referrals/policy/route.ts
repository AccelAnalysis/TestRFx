import { NextRequest, NextResponse } from "next/server";
import { resolveExchangeActor } from "@/lib/server/exchange/actor";
import { exchangeServiceErrorResponse } from "@/lib/server/exchange/http";
import { ExchangeInvalidInputError } from "@/lib/server/exchange/resource-input";
import { getRecipientReferralPolicy } from "@/lib/server/exchange/resource-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const actor = await resolveExchangeActor(request);
    const recipientOrganization = request.nextUrl.searchParams.get("recipientOrganization")?.trim();
    if (!recipientOrganization) throw new ExchangeInvalidInputError("Receiving organization is required.");
    const policy = await getRecipientReferralPolicy(actor, recipientOrganization);
    return NextResponse.json({ policy }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return exchangeServiceErrorResponse(error);
  }
}
