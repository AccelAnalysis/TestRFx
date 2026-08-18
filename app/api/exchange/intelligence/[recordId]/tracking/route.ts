import { NextRequest, NextResponse } from "next/server";
import { setIntelligenceTracking } from "@/lib/server/intelligence-repository";
import { requireExchangeActor } from "@/lib/server/exchange-session";
import { serviceErrorResponse } from "@/lib/server/http-errors";

export async function PUT(request: NextRequest, context: { params: Promise<{ recordId: string }> }) {
  try {
    const actor = await requireExchangeActor(request);
    const { recordId } = await context.params;
    const body = await request.json() as Record<string, unknown>;
    const mode = body.mode === "follow" ? "follow" : "track";
    const active = body.active !== false;
    return NextResponse.json(await setIntelligenceTracking(actor, recordId, { active, mode }));
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
