import { NextRequest, NextResponse } from "next/server";
import type { RfxWorkflowCommand } from "@/lib/exchange/drawer-workflows";
import { assertPermission, ExchangeAuthenticationRequiredError, resolveServerActor } from "@/lib/server/actor-context";
import { databaseConfigured } from "@/lib/server/postgres";
import { executeRfxWorkflow, RfxWorkflowValidationError, type RfxWorkflowPayload } from "@/lib/server/rfx-workflow-service";

const commands = new Set<RfxWorkflowCommand>(["create", "draft", "save", "publish", "manage", "invite", "responses", "update", "close", "award-advance", "respond", "submit"]);
const manageCommands = new Set<RfxWorkflowCommand>(["create", "draft", "save", "publish", "manage", "invite", "responses", "update", "close", "award-advance"]);

export async function POST(request: NextRequest) {
  if (!databaseConfigured()) {
    return NextResponse.json({ error: "RFx workflow service requires PostgreSQL", code: "DATABASE_NOT_CONFIGURED" }, { status: 503 });
  }

  const body = await request.json().catch(() => null) as { command?: string; recordId?: string; payload?: RfxWorkflowPayload } | null;
  if (!body?.command || !commands.has(body.command as RfxWorkflowCommand)) return NextResponse.json({ error: "Unsupported RFx workflow command" }, { status: 400 });
  const command = body.command as RfxWorkflowCommand;

  try {
    const actor = await resolveServerActor(request);
    assertPermission(actor, manageCommands.has(command) ? "rfx:manage" : "rfx:respond");
    const result = await executeRfxWorkflow({ command, recordId: body.recordId, payload: body.payload ?? {}, actor });
    return NextResponse.json({ accepted: true, durable: true, result, serviceMode: "postgres" }, { status: 200 });
  } catch (error) {
    if (error instanceof ExchangeAuthenticationRequiredError) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error instanceof RfxWorkflowValidationError) return NextResponse.json({ error: error.message }, { status: error.statusCode });
    console.error("RFx workflow service failed", error);
    return NextResponse.json({ error: "RFx workflow could not be completed" }, { status: 500 });
  }
}
