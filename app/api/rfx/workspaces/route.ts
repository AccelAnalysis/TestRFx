import { NextRequest, NextResponse } from "next/server";
import type { RfxWorkflowEntry, RfxWorkflowPerspective, RfxWorkspace } from "@/lib/rfx/contracts";
import { loadPostgresRfxWorkspace, savePostgresRfxWorkspace } from "@/lib/rfx/postgres-repository";
import { authorizeRfxWorkspaceRecord, resolveRfxActor } from "@/lib/rfx/runtime-actor";
import { perspectiveForEntry } from "@/lib/rfx/workflow-tree";
import { IdentitySessionUnauthorizedError } from "@/lib/identity/session-gateway";

export const runtime = "nodejs";

const entries = new Set<RfxWorkflowEntry>(["create-rfx", "manage-rfx", "invite-team", "respond", "team", "view"]);
const perspectives = new Set<RfxWorkflowPerspective>(["issuer", "responder"]);

function serviceError(error: unknown) {
  const message = error instanceof Error ? error.message : "RFx workspace service is unavailable.";
  if (error instanceof IdentitySessionUnauthorizedError) return NextResponse.json({ error: message }, { status: 401 });
  const configuration = message.includes("DATABASE_URL") || message.includes("not configured") || message.includes("requires RFXCHANGE_IDENTITY_SESSION_ENDPOINT");
  const missing = message.includes("not found");
  return NextResponse.json({ error: message }, { status: configuration ? 503 : missing ? 404 : 500 });
}

export async function GET(request: NextRequest) {
  const recordId = request.nextUrl.searchParams.get("recordId")?.trim();
  const entry = request.nextUrl.searchParams.get("entry") as RfxWorkflowEntry | null;
  const perspective = request.nextUrl.searchParams.get("perspective") as RfxWorkflowPerspective | null;
  if (!recordId || !entry || !entries.has(entry) || !perspective || !perspectives.has(perspective)) {
    return NextResponse.json({ error: "recordId, perspective, and a supported RFx workflow entry are required." }, { status: 400 });
  }
  if (perspectiveForEntry(entry) !== perspective) return NextResponse.json({ error: "RFx workflow entry does not match the requested perspective." }, { status: 400 });

  try {
    const actor = await resolveRfxActor(request);
    await authorizeRfxWorkspaceRecord(actor, recordId, perspective, entry);
    const workspace = await loadPostgresRfxWorkspace(recordId, perspective, entry, actor);
    return NextResponse.json({ workspace, persistence: "postgres" });
  } catch (error) {
    return serviceError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const payload = await request.json() as { workspace?: RfxWorkspace };
    const workspace = payload.workspace;
    if (!workspace || !workspace.recordId || !entries.has(workspace.entry) || !perspectives.has(workspace.perspective) || perspectiveForEntry(workspace.entry) !== workspace.perspective) {
      return NextResponse.json({ error: "A valid RFx workspace is required." }, { status: 400 });
    }

    const actor = await resolveRfxActor(request);
    await authorizeRfxWorkspaceRecord(actor, workspace.recordId, workspace.perspective, workspace.entry);
    const saved = await savePostgresRfxWorkspace(workspace, actor);
    return NextResponse.json({ workspace: saved, persistence: "postgres" });
  } catch (error) {
    return serviceError(error);
  }
}
