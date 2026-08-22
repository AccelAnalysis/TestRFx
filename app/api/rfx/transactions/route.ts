import { NextRequest, NextResponse } from "next/server";
import { IdentitySessionUnauthorizedError } from "@/lib/identity/session-gateway";
import { publicationPreflight, responsePreflight } from "@/lib/rfx/mobile-experience";
import { loadPostgresRfxWorkspace } from "@/lib/rfx/postgres-repository";
import { actorCanSubmitRfx, actorCanWriteRfx, authorizeRfxWorkspaceRecord, resolveRfxActor } from "@/lib/rfx/runtime-actor";
import { publishCanonicalRfx, recordExternalSubmission, submitHostedResponse } from "@/lib/rfx/transaction-repository";
import { findWorkflowNode, rootForEntry, workflowTreeFor } from "@/lib/rfx/workflow-tree";

export const runtime = "nodejs";

type Action = "publish" | "submit-hosted" | "record-external";

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "RFx transaction failed.";
  if (error instanceof IdentitySessionUnauthorizedError) return NextResponse.json({ error: message }, { status: 401 });
  if (message.includes("not found")) return NextResponse.json({ error: message }, { status: 404 });
  if (message.includes("requires DATABASE_URL") || message.includes("session service") || message.includes("RFXCHANGE_IDENTITY_SESSION_ENDPOINT")) return NextResponse.json({ error: message }, { status: 503 });
  if (message.includes("cannot") || message.includes("requires submission") || message.includes("not currently accepting") || message.includes("blocker") || message.includes("valid external")) return NextResponse.json({ error: message }, { status: 409 });
  return NextResponse.json({ error: message }, { status: 500 });
}

function workflowRoot(entry: "create-rfx" | "respond") {
  const perspective = entry === "create-rfx" ? "issuer" : "responder";
  const tree = workflowTreeFor(perspective);
  const root = findWorkflowNode(tree, [rootForEntry(entry)]);
  if (!root) throw new Error("RFx workflow definition is unavailable.");
  return root;
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json() as {
      action?: Action;
      recordId?: string;
      workspaceVersion?: number;
      rfxType?: string;
      authorized?: boolean;
      externalReference?: string;
      submittedAt?: string;
      selfReported?: boolean;
    };

    const action = payload.action;
    const recordId = payload.recordId?.trim();
    if (!action || !recordId || !["publish", "submit-hosted", "record-external"].includes(action)) {
      return NextResponse.json({ error: "A supported RFx transaction action and recordId are required." }, { status: 400 });
    }

    const actor = await resolveRfxActor(request);

    if (action === "publish") {
      if (!actorCanWriteRfx(actor)) throw new IdentitySessionUnauthorizedError("Your organization role cannot publish RFx records.");
      await authorizeRfxWorkspaceRecord(actor, recordId, "issuer", "create-rfx");
      const workspace = await loadPostgresRfxWorkspace(recordId, "issuer", "create-rfx", actor);
      if (payload.workspaceVersion && workspace.version < payload.workspaceVersion) {
        return NextResponse.json({ error: "Your latest RFx edits are still syncing. Retry publication after the save indicator finishes." }, { status: 409 });
      }
      const preflight = publicationPreflight(workflowRoot("create-rfx"), workspace);
      if (!preflight.ready) return NextResponse.json({ error: "Publication blockers remain.", preflight }, { status: 409 });
      return NextResponse.json(await publishCanonicalRfx(actor, recordId, workspace, payload.rfxType));
    }

    if (!actorCanSubmitRfx(actor)) throw new IdentitySessionUnauthorizedError("Your organization role cannot submit RFx responses.");
    await authorizeRfxWorkspaceRecord(actor, recordId, "responder", "respond");
    const workspace = await loadPostgresRfxWorkspace(recordId, "responder", "respond", actor);
    if (payload.workspaceVersion && workspace.version < payload.workspaceVersion) {
      return NextResponse.json({ error: "Your latest response edits are still syncing. Retry after the save indicator finishes." }, { status: 409 });
    }
    const preflight = responsePreflight(workflowRoot("respond"), workspace);
    if (!preflight.ready) return NextResponse.json({ error: "Submission blockers remain.", preflight }, { status: 409 });

    if (action === "submit-hosted") {
      if (payload.authorized !== true) return NextResponse.json({ error: "Submitter authority confirmation is required." }, { status: 400 });
      return NextResponse.json(await submitHostedResponse(actor, recordId, workspace));
    }

    const externalReference = payload.externalReference?.trim();
    const submittedAt = payload.submittedAt?.trim();
    if (payload.selfReported !== true || !externalReference || !submittedAt) {
      return NextResponse.json({ error: "External confirmation, submitted date/time, and self-report acknowledgement are required." }, { status: 400 });
    }
    return NextResponse.json(await recordExternalSubmission(actor, recordId, workspace, externalReference, submittedAt));
  } catch (error) {
    return errorResponse(error);
  }
}
