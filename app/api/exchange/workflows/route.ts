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
} from "@/lib/exchange/shared-workflows";

const recordLens: Record<ExchangeRecordType, ExchangeLens> = {
  rfx: "rfx",
  resource: "resources",
  intelligence: "intelligence",
  capability: "capabilities",
};

export async function GET() {
  return NextResponse.json({
    workflows: Object.values(sharedWorkflowDefinitions),
    services: Object.values(sharedServiceDefinitions),
    persistence: "reference-session-only",
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { actionId?: string; lens?: string; recordId?: string; source?: "action-rail" | "detail" | "menu"; payload?: Record<string, unknown> } | null;
  if (!body?.actionId || !body.lens || !body.recordId) return NextResponse.json({ error: "actionId, lens, and recordId are required" }, { status: 400 });
  if (!isExchangeLens(body.lens)) return NextResponse.json({ error: "Unsupported lens" }, { status: 400 });

  const workflow = workflowForAction(body.actionId);
  if (!workflow) return NextResponse.json({ error: "Action is not owned by the shared-workflow service" }, { status: 400 });

  const record = exchangeSeed.find((candidate) => candidate.id === body.recordId);
  if (!record) return NextResponse.json({ error: "Record not found" }, { status: 404 });
  if (recordLens[record.type] !== body.lens) return NextResponse.json({ error: "Record does not belong to the requested lens" }, { status: 409 });

  const event = buildReferenceWorkflowEvent({
    workflow,
    lens: body.lens,
    record,
    actor: referenceActorContext,
    source: body.source ?? "action-rail",
  }, body.payload ?? {});

  return NextResponse.json({
    accepted: true,
    durable: false,
    event,
    productionBoundary: sharedWorkflowDefinitions[workflow].productionAdapter,
  }, { status: 202 });
}
