import { NextRequest, NextResponse } from "next/server";
import type { IntelligenceNote } from "@/lib/exchange/intelligence-runtime";
import { resolveExchangeActor } from "@/lib/server/exchange/actor";
import { addIntelligenceNote, getIntelligenceDetail } from "@/lib/server/exchange/intelligence-service";
import { intelligenceErrorResponse } from "@/lib/server/exchange/intelligence-http";

export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ recordId: string }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const actor = await resolveExchangeActor(request); const { recordId } = await params;
    const detail = await getIntelligenceDetail(actor, recordId);
    return NextResponse.json({ notes: detail.notes, persistence: "postgresql" });
  } catch (error) { return intelligenceErrorResponse(error); }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const actor = await resolveExchangeActor(request); const { recordId } = await params;
    const body = await request.json().catch(() => ({})) as { body?: unknown; visibility?: unknown };
    const text = typeof body.body === "string" ? body.body : "";
    const visibility = (typeof body.visibility === "string" ? body.visibility : "organization") as IntelligenceNote["visibility"];
    const note = await addIntelligenceNote(actor, recordId, text, visibility);
    return NextResponse.json({ note, persistence: "postgresql" }, { status: 201 });
  } catch (error) { return intelligenceErrorResponse(error); }
}
