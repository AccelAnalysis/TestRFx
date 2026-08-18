import { NextRequest, NextResponse } from "next/server";
import { resolveExchangeActor } from "@/lib/server/exchange/actor";
import { exchangeServiceErrorResponse } from "@/lib/server/exchange/http";
import { parseResourceDraft } from "@/lib/server/exchange/resource-input";
import { createResourceOffer, listResourceRecords } from "@/lib/server/exchange/resource-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const actor = await resolveExchangeActor(request);
    const records = await listResourceRecords(actor);
    return NextResponse.json({ records }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return exchangeServiceErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await resolveExchangeActor(request);
    const draft = parseResourceDraft(await request.json());
    const record = await createResourceOffer(actor, draft);
    return NextResponse.json({ record }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return exchangeServiceErrorResponse(error);
  }
}
