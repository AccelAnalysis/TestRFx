import { NextRequest, NextResponse } from "next/server";
import type { IntelligenceNote } from "@/lib/exchange/intelligence";
import { addIntelligenceNote } from "@/lib/server/intelligence-repository";
import { requireExchangeActor } from "@/lib/server/exchange-session";
import { serviceErrorResponse } from "@/lib/server/http-errors";

const visibility = new Set<IntelligenceNote["visibility"]>(["personal", "organization", "shared"]);

export async function POST(request: NextRequest, context: { params: Promise<{ recordId: string }> }) {
  try {
    const actor = await requireExchangeActor(request);
    const { recordId } = await context.params;
    const body = await request.json() as Record<string, unknown>;
    const note = typeof body.body === "string" ? body.body.trim() : "";
    const scope = typeof body.visibility === "string" ? body.visibility as IntelligenceNote["visibility"] : "organization";
    if (!note || !visibility.has(scope)) return NextResponse.json({ error: "A note and valid visibility are required." }, { status: 400 });
    return NextResponse.json(await addIntelligenceNote(actor, recordId, { body: note, visibility: scope }), { status: 201 });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
