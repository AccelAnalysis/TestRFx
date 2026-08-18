import { NextRequest, NextResponse } from "next/server";
import { resolveExchangeActor } from "@/lib/server/exchange-actor";
import { DatabaseUnavailableError } from "@/lib/server/database";
import { executeDomainWorkflow, type DomainWorkflowAction } from "@/lib/server/domain-workflows";

const actions = new Set<DomainWorkflowAction>([
  "offer-resource",
  "edit-resource",
  "request-resource",
  "archive-resource",
  "add-insight",
  "edit-insight",
  "add-note",
]);

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const actor = await resolveExchangeActor(request);
    if (!actor) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    const body = await request.json().catch(() => null) as { action?: string; recordId?: string; payload?: Record<string, unknown> } | null;
    if (!body?.action || !actions.has(body.action as DomainWorkflowAction)) return NextResponse.json({ error: "Unsupported domain workflow." }, { status: 400 });
    const result = await executeDomainWorkflow({ action: body.action as DomainWorkflowAction, actor, recordId: body.recordId, payload: body.payload ?? {} });
    return NextResponse.json({ accepted: true, ...result });
  } catch (error) {
    if (error instanceof DatabaseUnavailableError) return NextResponse.json({ error: error.message }, { status: 503 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Domain workflow failed." }, { status: 400 });
  }
}
