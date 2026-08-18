import { NextRequest, NextResponse } from "next/server";
import type { ExchangeLens, ExchangeRecordType } from "@/lib/exchange/contracts";
import { isExchangeLens } from "@/lib/exchange/lenses";
import { sharedServiceDefinitions, sharedWorkflowDefinitions, workflowForAction } from "@/lib/exchange/shared-workflows";
import { resolveExchangeActor } from "@/lib/server/exchange-actor";
import { DatabaseUnavailableError } from "@/lib/server/database";
import { getExchangeRecord } from "@/lib/server/exchange-record-repository";
import { executeSharedWorkflow, WorkflowServiceUnavailableError } from "@/lib/server/exchange-workflows";

const recordLens: Record<ExchangeRecordType, ExchangeLens> = {
  rfx: "rfx",
  resource: "resources",
  intelligence: "intelligence",
  capability: "capabilities",
};

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    workflows: Object.values(sharedWorkflowDefinitions).map((workflow) => ({ ...workflow, persistence: workflow.id === "match" ? "external-service-required" : "database" })),
    services: Object.values(sharedServiceDefinitions),
  });
}

export async function POST(request: NextRequest) {
  try {
    const actor = await resolveExchangeActor(request);
    if (!actor) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    const body = await request.json().catch(() => null) as { actionId?: string; lens?: string; recordId?: string; source?: "action-rail" | "detail" | "menu"; payload?: Record<string, unknown> } | null;
    if (!body?.actionId || !body.lens || !body.recordId) return NextResponse.json({ error: "actionId, lens, and recordId are required" }, { status: 400 });
    if (!isExchangeLens(body.lens)) return NextResponse.json({ error: "Unsupported lens" }, { status: 400 });
    const workflow = workflowForAction(body.actionId);
    if (!workflow) return NextResponse.json({ error: "Action is not owned by the shared-workflow service" }, { status: 400 });
    const record = await getExchangeRecord(body.recordId, actor);
    if (!record) return NextResponse.json({ error: "Record not found" }, { status: 404 });
    if (recordLens[record.type] !== body.lens) return NextResponse.json({ error: "Record does not belong to the requested lens" }, { status: 409 });
    const result = await executeSharedWorkflow({
      workflow,
      lens: body.lens,
      record,
      actor,
      source: body.source ?? "action-rail",
      payload: body.payload,
    });
    return NextResponse.json({ accepted: true, ...result }, { status: 200 });
  } catch (error) {
    if (error instanceof DatabaseUnavailableError) return NextResponse.json({ error: error.message }, { status: 503 });
    if (error instanceof WorkflowServiceUnavailableError) return NextResponse.json({ error: error.message, service: error.service, state: "unavailable" }, { status: 503 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Workflow failed." }, { status: 400 });
  }
}
