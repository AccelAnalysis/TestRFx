import { NextRequest, NextResponse } from "next/server";
import type { ExchangeLens, ExchangeRecordType } from "@/lib/exchange/contracts";
import { isExchangeLens } from "@/lib/exchange/lenses";
import { exchangeSeed } from "@/lib/exchange/seed";
import {
  buildReferenceWorkflowEvent,
  referenceActorContext,
  sharedServiceDefinitions,
  sharedWorkflowDefinitions,
  workflowForAction,
  type SharedWorkflowId,
} from "@/lib/exchange/shared-workflows";
import { assertPermission, ExchangeAuthenticationRequiredError, resolveServerActor } from "@/lib/server/actor-context";
import { databaseConfigured } from "@/lib/server/postgres";
import { ExchangeWorkflowValidationError, executeSharedWorkflow } from "@/lib/server/shared-workflow-service";

const recordLens: Record<ExchangeRecordType, ExchangeLens> = { rfx: "rfx", resource: "resources", intelligence: "intelligence", capability: "capabilities" };
const permissionByWorkflow: Record<SharedWorkflowId, string> = {
  save: "relationships:write",
  watch: "relationships:write",
  track: "relationships:write",
  follow: "relationships:write",
  share: "exchange:view",
  refer: "referrals:create",
  match: "exchange:view",
  team: "collaboration:create",
  connect: "collaboration:create",
};

function referenceRuntime() {
  return process.env.RFXCHANGE_REFERENCE_MODE === "1" || process.env.NODE_ENV !== "production";
}

export async function GET() {
  return NextResponse.json({
    workflows: Object.values(sharedWorkflowDefinitions),
    services: Object.values(sharedServiceDefinitions),
    persistence: databaseConfigured() ? "postgres" : referenceRuntime() ? "reference-development" : "unavailable",
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { actionId?: string; lens?: string; recordId?: string; source?: "action-rail" | "detail" | "menu"; payload?: Record<string, unknown> } | null;
  if (!body?.actionId || !body.lens || !body.recordId) return NextResponse.json({ error: "actionId, lens, and recordId are required" }, { status: 400 });
  if (!isExchangeLens(body.lens)) return NextResponse.json({ error: "Unsupported lens" }, { status: 400 });
  const workflow = workflowForAction(body.actionId);
  if (!workflow) return NextResponse.json({ error: "Action is not owned by the shared-workflow service" }, { status: 400 });

  if (!databaseConfigured()) {
    if (!referenceRuntime()) return NextResponse.json({ error: "Shared workflow service unavailable", code: "DATABASE_NOT_CONFIGURED" }, { status: 503 });
    const record = exchangeSeed.find((candidate) => candidate.id === body.recordId);
    if (!record) return NextResponse.json({ error: "Record not found in the development reference catalog" }, { status: 404 });
    if (recordLens[record.type] !== body.lens) return NextResponse.json({ error: "Record does not belong to the requested lens" }, { status: 409 });
    const event = buildReferenceWorkflowEvent({ workflow, lens: body.lens, record, actor: referenceActorContext, source: body.source ?? "action-rail" }, body.payload ?? {});
    return NextResponse.json({ accepted: true, durable: false, event, serviceMode: "reference-development" }, { status: 202 });
  }

  try {
    const actor = await resolveServerActor(request);
    assertPermission(actor, permissionByWorkflow[workflow]);
    const event = await executeSharedWorkflow({ workflow, lens: body.lens, recordId: body.recordId, actor, source: body.source ?? "action-rail", payload: body.payload ?? {} });
    return NextResponse.json({ accepted: true, durable: true, event, serviceMode: "postgres" }, { status: 201 });
  } catch (error) {
    if (error instanceof ExchangeAuthenticationRequiredError) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error instanceof ExchangeWorkflowValidationError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Shared Exchange workflow failed", error);
    return NextResponse.json({ error: "Shared workflow could not be completed" }, { status: 500 });
  }
}
