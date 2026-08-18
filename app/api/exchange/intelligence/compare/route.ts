import { NextRequest, NextResponse } from "next/server";
import type { IntelligenceCompareDimension } from "@/lib/exchange/intelligence";
import { compareIntelligence } from "@/lib/server/intelligence-repository";
import { requireExchangeActor } from "@/lib/server/exchange-session";
import { serviceErrorResponse } from "@/lib/server/http-errors";

const dimensions = new Set<IntelligenceCompareDimension>(["insights", "organizations", "geographies"]);

export async function POST(request: NextRequest) {
  try {
    const actor = await requireExchangeActor(request);
    const body = await request.json() as Record<string, unknown>;
    const dimension = typeof body.dimension === "string" ? body.dimension as IntelligenceCompareDimension : "insights";
    const left = typeof body.left === "string" ? body.left.trim() : "";
    const right = typeof body.right === "string" ? body.right.trim() : "";
    if (!dimensions.has(dimension) || !left || !right || left === right) return NextResponse.json({ error: "Choose two different insights, organizations, or geographies to compare." }, { status: 400 });
    return NextResponse.json(await compareIntelligence(actor, dimension, left, right));
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
