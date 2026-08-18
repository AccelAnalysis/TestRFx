import { NextRequest, NextResponse } from "next/server";
import { resolveExchangeActor } from "@/lib/server/exchange/actor";
import { exchangeServiceErrorResponse } from "@/lib/server/exchange/http";
import { parseResourceDraft } from "@/lib/server/exchange/resource-input";
import { archiveResourceOffer, getResourceRecord, updateResourceOffer } from "@/lib/server/exchange/resource-service";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ recordId: string }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const actor = await resolveExchangeActor(request);
    const { recordId } = await params;
    const record = await getResourceRecord(actor, recordId);
    return NextResponse.json({ record }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return exchangeServiceErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const actor = await resolveExchangeActor(request);
    const { recordId } = await params;
    const draft = parseResourceDraft(await request.json());
    const record = await updateResourceOffer(actor, recordId, draft);
    return NextResponse.json({ record }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return exchangeServiceErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const actor = await resolveExchangeActor(request);
    const { recordId } = await params;
    await archiveResourceOffer(actor, recordId);
    return NextResponse.json({ status: "archived" }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return exchangeServiceErrorResponse(error);
  }
}
