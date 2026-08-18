import { NextRequest, NextResponse } from "next/server";
import { isExchangeLens } from "@/lib/exchange/lenses";
import { sharedServiceDefinitions, sharedWorkflowDefinitions, workflowForAction } from "@/lib/exchange/shared-workflows";
import { ExchangeAuthenticationError, resolveExchangeActor } from "@/lib/server/exchange-actor";
import { ExchangeServiceUnavailableError, exchangeDatabaseConfigured } from "@/lib/server/database";
import { executeSharedWorkflow, getReferralPolicy } from "@/lib/server/exchange-workflow-repository";

export const runtime = "nodejs";

function errorResponse(error: unknown) {
  if (error instanceof ExchangeAuthenticationError) return NextResponse.json({ error: error.message }, { status: 401 });
  if (error instanceof ExchangeServiceUnavailableError) return NextResponse.json({ error: error.message, configured: false }, { status: 503 });
  const message = error instanceof Error ? error.message : "Exchange workflow failed.";
  const status = /not found|required/i.test(message) ? 422 : 500;
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: NextRequest) {
  const recipientOrganization = request.nextUrl.searchParams.get("recipientOrganization");
  if (recipientOrganization) {
    try {
      return NextResponse.json({ recipientPolicy: await getReferralPolicy(recipientOrganization) });
    } catch (error) {
      return errorResponse(error);
    }
  }

  return NextResponse.json({
    workflows: Object.values(sharedWorkflowDefinitions),
    services: Object.values(sharedServiceDefinitions),
    persistence: exchangeDatabaseConfigured() ? "postgresql" : "unconfigured",
    actorResolution: "trusted auth/BFF headers",
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as {
    actionId?: string;
    lens?: string;
    recordId?: string;
    source?: "action-rail" | "detail" | "menu";
    payload?: Record<string, unknown>;
  } | null;

  if (!body?.actionId || !body.lens || !body.recordId) return NextResponse.json({ error: "actionId, lens, and recordId are required" }, { status: 400 });
  if (!isExchangeLens(body.lens)) return NextResponse.json({ error: "Unsupported lens" }, { status: 400 });
  const workflow = workflowForAction(body.actionId);
  if (!workflow) return NextResponse.json({ error: "Action is not owned by the shared-workflow service" }, { status: 400 });

  try {
    const actor = resolveExchangeActor(request.headers);
    const execution = await executeSharedWorkflow({
      workflow,
      lens: body.lens,
      recordPublicId: body.recordId,
      source: body.source ?? "action-rail",
      actor,
      payload: body.payload ?? {},
    });
    return NextResponse.json({ accepted: true, durable: true, execution }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
