import { NextRequest, NextResponse } from "next/server";
import { resolveExchangeActor } from "@/lib/server/exchange-actor";
import { DatabaseUnavailableError } from "@/lib/server/database";
import { executeRfxWorkflow, listRfxResponses, type RfxWorkflowAction } from "@/lib/server/rfx-workflows";

const actions = new Set<RfxWorkflowAction>(["create", "update", "publish", "close", "respond", "award"]);

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const actor = await resolveExchangeActor(request);
    if (!actor) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    const recordId = request.nextUrl.searchParams.get("recordId")?.trim();
    const view = request.nextUrl.searchParams.get("view");
    if (!recordId || view !== "responses") return NextResponse.json({ error: "recordId and view=responses are required." }, { status: 400 });
    const responses = await listRfxResponses(recordId, actor);
    return NextResponse.json({ recordId, responses });
  } catch (error) {
    if (error instanceof DatabaseUnavailableError) return NextResponse.json({ error: error.message }, { status: 503 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load RFx responses." }, { status: 400 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await resolveExchangeActor(request);
    if (!actor) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    const body = await request.json().catch(() => null) as { action?: string; recordId?: string; payload?: Record<string, unknown> } | null;
    if (!body?.action || !actions.has(body.action as RfxWorkflowAction)) return NextResponse.json({ error: "Unsupported RFx workflow." }, { status: 400 });
    const result = await executeRfxWorkflow({ action: body.action as RfxWorkflowAction, actor, recordId: body.recordId, payload: body.payload ?? {} });
    return NextResponse.json({ accepted: true, ...result });
  } catch (error) {
    if (error instanceof DatabaseUnavailableError) return NextResponse.json({ error: error.message }, { status: 503 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "RFx workflow failed." }, { status: 400 });
  }
}
