import { NextRequest, NextResponse } from "next/server";
import { getIntelligenceMatches } from "@/lib/server/intelligence-repository";
import { requireExchangeActor } from "@/lib/server/exchange-session";
import { serviceErrorResponse } from "@/lib/server/http-errors";

export async function GET(request: NextRequest, context: { params: Promise<{ recordId: string }> }) {
  try {
    const actor = await requireExchangeActor(request);
    const { recordId } = await context.params;
    return NextResponse.json({ matches: await getIntelligenceMatches(actor, recordId) });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
