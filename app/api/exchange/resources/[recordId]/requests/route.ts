import { NextRequest, NextResponse } from "next/server";
import { resolveExchangeActor } from "@/lib/server/exchange/actor";
import { exchangeServiceErrorResponse } from "@/lib/server/exchange/http";
import { parseResourceRequest } from "@/lib/server/exchange/resource-input";
import { createResourceRequest } from "@/lib/server/exchange/resource-service";

export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ recordId: string }> };

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const actor = await resolveExchangeActor(request);
    const { recordId } = await params;
    const input = parseResourceRequest(await request.json());
    const resourceRequest = await createResourceRequest(actor, recordId, input);
    return NextResponse.json({ request: resourceRequest }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return exchangeServiceErrorResponse(error);
  }
}
