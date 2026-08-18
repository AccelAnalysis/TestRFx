import { NextRequest, NextResponse } from "next/server";
import { resolveExchangeActor } from "@/lib/server/exchange/actor";
import { exchangeServiceErrorResponse } from "@/lib/server/exchange/http";
import { parseResourceRelationship } from "@/lib/server/exchange/resource-input";
import { setResourceRelationship } from "@/lib/server/exchange/resource-service";

export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ recordId: string }> };

export async function PUT(request: NextRequest, { params }: RouteContext) {
  try {
    const actor = await resolveExchangeActor(request);
    const { recordId } = await params;
    const { kind, active } = parseResourceRelationship(await request.json());
    const relationship = await setResourceRelationship(actor, recordId, kind, active);
    return NextResponse.json({ relationship }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return exchangeServiceErrorResponse(error);
  }
}
