import { NextRequest, NextResponse } from "next/server";
import { DatabaseServiceUnavailableError } from "@/lib/server/database";
import {
  ExchangeForbiddenError,
  ExchangeUnauthorizedError,
  resolveExchangeActor,
} from "@/lib/server/exchange/actor";
import {
  createSharedCollaboration,
  createSharedLink,
  createSharedReferral,
  requestSharedMatch,
  setSharedRecordRelationship,
  SharedExchangeWorkflowError,
} from "@/lib/server/exchange/shared-workflow-service";
import {
  relationshipKindForWorkflow,
  sharedServiceDefinitions,
  sharedWorkflowDefinitions,
  workflowForAction,
  type WorkflowSource,
} from "@/lib/exchange/shared-workflows";

export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  if (error instanceof ExchangeUnauthorizedError) return NextResponse.json({ error: error.message }, { status: 401 });
  if (error instanceof ExchangeForbiddenError) return NextResponse.json({ error: error.message }, { status: 403 });
  if (error instanceof SharedExchangeWorkflowError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof DatabaseServiceUnavailableError) return NextResponse.json({ error: error.message }, { status: 503 });
  return NextResponse.json({ error: error instanceof Error ? error.message : "Shared Exchange workflow failed." }, { status: 500 });
}

export async function GET() {
  return NextResponse.json({
    workflows: Object.values(sharedWorkflowDefinitions),
    services: Object.values(sharedServiceDefinitions),
    persistence: "postgresql",
    actorAuthority: "platform-identity-session",
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as {
    actionId?: string;
    lens?: string;
    recordId?: string;
    source?: WorkflowSource;
    payload?: Record<string, unknown>;
  } | null;

  if (!body?.actionId || !body.recordId) {
    return NextResponse.json({ error: "actionId and recordId are required." }, { status: 400 });
  }

  const workflow = workflowForAction(body.actionId);
  if (!workflow) return NextResponse.json({ error: "Action is not owned by the shared-workflow service." }, { status: 400 });

  try {
    const actor = await resolveExchangeActor(request);
    const relationshipKind = relationshipKindForWorkflow(workflow);

    if (relationshipKind) {
      const requestedActive = body.payload?.active;
      const active = typeof requestedActive === "boolean" ? requestedActive : true;
      const relationship = await setSharedRecordRelationship({ actor, recordPublicId: body.recordId, kind: relationshipKind, active });
      return NextResponse.json({ accepted: true, durable: true, workflow, relationship });
    }

    if (workflow === "refer") {
      const recipientOrganizationId = typeof body.payload?.recipientOrganizationId === "string" ? body.payload.recipientOrganizationId.trim() : "";
      if (!recipientOrganizationId) return NextResponse.json({ error: "recipientOrganizationId is required for referrals." }, { status: 400 });
      const note = typeof body.payload?.note === "string" ? body.payload.note : undefined;
      const referral = await createSharedReferral({ actor, recordPublicId: body.recordId, recipientOrganizationId, note });
      return NextResponse.json({ accepted: true, durable: true, workflow, referral }, { status: 201 });
    }

    if (workflow === "share") {
      const audience = body.payload?.audience && typeof body.payload.audience === "object" && !Array.isArray(body.payload.audience)
        ? body.payload.audience as Record<string, unknown>
        : undefined;
      const share = await createSharedLink({ actor, recordPublicId: body.recordId, audience });
      return NextResponse.json({ accepted: true, durable: true, workflow, share }, { status: 201 });
    }

    if (workflow === "team" || workflow === "connect") {
      const recipientOrganizationId = typeof body.payload?.recipientOrganizationId === "string" ? body.payload.recipientOrganizationId.trim() : undefined;
      const message = typeof body.payload?.message === "string" ? body.payload.message : undefined;
      const collaboration = await createSharedCollaboration({
        actor,
        recordPublicId: body.recordId,
        kind: workflow === "team" ? "teaming" : "connection",
        recipientOrganizationId,
        message,
      });
      return NextResponse.json({ accepted: true, durable: true, workflow, collaboration }, { status: 201 });
    }

    if (workflow === "match") {
      const matches = await requestSharedMatch({ actor, recordPublicId: body.recordId });
      return NextResponse.json({ accepted: true, durable: true, workflow, matches });
    }

    return NextResponse.json({ error: "Unsupported shared workflow." }, { status: 400 });
  } catch (error) {
    return errorResponse(error);
  }
}
