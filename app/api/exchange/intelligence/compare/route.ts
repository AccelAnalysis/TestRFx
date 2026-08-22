import { NextRequest, NextResponse } from "next/server";
import type { IntelligenceCompareDimension } from "@/lib/exchange/intelligence-runtime";
import { resolveExchangeActor } from "@/lib/server/exchange/actor";
import { compareIntelligence } from "@/lib/server/exchange/intelligence-service";
import { intelligenceErrorResponse } from "@/lib/server/exchange/intelligence-http";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const actor = await resolveExchangeActor(request);
    const body = await request.json().catch(() => ({})) as { dimension?: unknown; left?: unknown; right?: unknown };
    const dimension = (typeof body.dimension === "string" ? body.dimension : "insights") as IntelligenceCompareDimension;
    const left = typeof body.left === "string" ? body.left : "";
    const right = typeof body.right === "string" ? body.right : "";
    return NextResponse.json({ comparison: await compareIntelligence(actor, dimension, left, right), persistence: "computed" });
  } catch (error) { return intelligenceErrorResponse(error); }
}
