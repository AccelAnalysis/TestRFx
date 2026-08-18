import { NextRequest, NextResponse } from "next/server";
import { resolveExchangeActor } from "@/lib/server/exchange-actor";
import { executeCapabilityWorkflow, getCapabilityWorkflowDetail, type CapabilityWorkflowAction } from "@/lib/server/capability-workflows";
import { DatabaseUnavailableError } from "@/lib/server/database";

const actions = new Set<CapabilityWorkflowAction>(["upsert-evidence", "remove-evidence", "publish"]);

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const actor = await resolveExchangeActor(request);
    if (!actor) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    const recordId = request.nextUrl.searchParams.get("recordId")?.trim();
    if (!recordId) return NextResponse.json({ error: "recordId is required." }, { status: 400 });
    const detail = await getCapabilityWorkflowDetail(recordId, actor);
    if (!detail) return NextResponse.json({ error: "Capability record not found." }, { status: 404 });
    return NextResponse.json({ recordId, detail, amacs: { state: "unavailable", reason: "A governed AMACS mapping provider is not configured; RFxchange will not fabricate taxonomy candidates." }, matching: { state: "unavailable", reason: "A governed matching service is not configured; RFxchange will not fabricate match scores." } });
  } catch (error) {
    if (error instanceof DatabaseUnavailableError) return NextResponse.json({ error: error.message }, { status: 503 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load capability detail." }, { status: 400 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await resolveExchangeActor(request);
    if (!actor) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    const body = await request.json().catch(() => null) as { action?: string; recordId?: string; payload?: Record<string, unknown> } | null;
    if (!body?.action || !actions.has(body.action as CapabilityWorkflowAction) || !body.recordId) return NextResponse.json({ error: "action and recordId are required." }, { status: 400 });
    const result = await executeCapabilityWorkflow({ action: body.action as CapabilityWorkflowAction, actor, recordId: body.recordId, payload: body.payload ?? {} });
    return NextResponse.json({ accepted: true, ...result });
  } catch (error) {
    if (error instanceof DatabaseUnavailableError) return NextResponse.json({ error: error.message }, { status: 503 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Capability workflow failed." }, { status: 400 });
  }
}
