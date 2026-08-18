import { NextRequest, NextResponse } from "next/server";
import { createIntelligenceReferral } from "@/lib/server/intelligence-repository";
import { requireExchangeActor } from "@/lib/server/exchange-session";
import { serviceErrorResponse } from "@/lib/server/http-errors";

export async function POST(request: NextRequest, context: { params: Promise<{ recordId: string }> }) {
  try {
    const actor = await requireExchangeActor(request);
    const { recordId } = await context.params;
    const body = await request.json() as Record<string, unknown>;
    const recipientOrganizationId = typeof body.recipientOrganizationId === "string" ? body.recipientOrganizationId.trim() : "";
    const note = typeof body.note === "string" ? body.note.trim() : undefined;
    if (!recipientOrganizationId) return NextResponse.json({ error: "Choose a recipient organization." }, { status: 400 });
    return NextResponse.json(await createIntelligenceReferral(actor, recordId, { recipientOrganizationId, note }), { status: 201 });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
