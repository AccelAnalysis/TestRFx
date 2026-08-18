import { NextRequest, NextResponse } from "next/server";
import { resolveExchangeActor } from "@/lib/server/exchange/actor";
import { exchangeServiceErrorResponse } from "@/lib/server/exchange/http";
import { parseOrganizationMessage } from "@/lib/server/exchange/resource-input";
import { sendResourceShare } from "@/lib/server/exchange/resource-service";

export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ recordId: string }> };

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const actor = await resolveExchangeActor(request);
    const { recordId } = await params;
    const input = parseOrganizationMessage(await request.json());
    const share = await sendResourceShare(actor, recordId, input);
    return NextResponse.json({ share }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return exchangeServiceErrorResponse(error);
  }
}
