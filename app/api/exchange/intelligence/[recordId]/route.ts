import { NextRequest, NextResponse } from "next/server";
import { resolveExchangeActor } from "@/lib/server/exchange/actor";
import { getIntelligenceDetail } from "@/lib/server/exchange/intelligence-service";
import { intelligenceErrorResponse } from "@/lib/server/exchange/intelligence-http";

export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ recordId: string }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const actor = await resolveExchangeActor(request);
    const { recordId } = await params;
    const detail = await getIntelligenceDetail(actor, recordId);
    return NextResponse.json({ detail, record: detail.record, persistence: "postgresql" });
  } catch (error) {
    return intelligenceErrorResponse(error);
  }
}
