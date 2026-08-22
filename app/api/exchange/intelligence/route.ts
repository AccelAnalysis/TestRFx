import { NextRequest, NextResponse } from "next/server";
import type { IntelligenceInsightInput } from "@/lib/exchange/intelligence-runtime";
import { resolveExchangeActor } from "@/lib/server/exchange/actor";
import { createIntelligence, listIntelligence } from "@/lib/server/exchange/intelligence-service";
import { intelligenceErrorResponse } from "@/lib/server/exchange/intelligence-http";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const actor = await resolveExchangeActor(request);
    const query = request.nextUrl.searchParams.get("q") ?? "";
    const offset = Number(request.nextUrl.searchParams.get("offset") ?? "0");
    const limit = Number(request.nextUrl.searchParams.get("limit") ?? "24");
    const result = await listIntelligence(actor, { query, offset: Number.isFinite(offset) ? offset : 0, limit: Number.isFinite(limit) ? limit : 24 });
    return NextResponse.json({ ...result, persistence: "postgresql" });
  } catch (error) { return intelligenceErrorResponse(error); }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await resolveExchangeActor(request);
    const input = await request.json() as IntelligenceInsightInput;
    const detail = await createIntelligence(actor, input);
    return NextResponse.json({ detail, record: detail.record, persistence: "postgresql" }, { status: 201 });
  } catch (error) { return intelligenceErrorResponse(error); }
}
