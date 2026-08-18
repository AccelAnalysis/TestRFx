import { NextRequest, NextResponse } from "next/server";
import type { RfxWorkflowEntry, RfxWorkflowPerspective, RfxWorkspace } from "@/lib/rfx/contracts";
import { loadPostgresRfxWorkspace, savePostgresRfxWorkspace } from "@/lib/rfx/postgres-repository";
import { isTrustedRfxWorkspaceRequest, sharedRfxWorkspaceConfiguration } from "@/lib/rfx/workspace-service-auth";
import { perspectiveForEntry } from "@/lib/rfx/workflow-tree";

export const runtime = "nodejs";

const entries = new Set<RfxWorkflowEntry>(["create-rfx", "manage-rfx", "invite-team", "respond", "team", "view"]);
const perspectives = new Set<RfxWorkflowPerspective>(["issuer", "responder"]);

function serviceError(error: unknown) {
  const message = error instanceof Error ? error.message : "RFx workspace service is unavailable.";
  const configuration = message.includes("DATABASE_URL") || message.includes("not configured");
  return NextResponse.json({ error: message }, { status: configuration ? 503 : 500 });
}

function requireTrustedService(request: NextRequest) {
  const configuration = sharedRfxWorkspaceConfiguration();
  if (!configuration.databaseConfigured || !configuration.serviceCredentialConfigured) {
    return NextResponse.json({ error: "Shared RFx workspace persistence is not configured. The client should use its local-device workspace until the authenticated server service is configured." }, { status: 503 });
  }
  if (!isTrustedRfxWorkspaceRequest(request)) {
    return NextResponse.json({ error: "Authenticated server authority is required for shared RFx workspace persistence." }, { status: 401 });
  }
  return undefined;
}

export async function GET(request: NextRequest) {
  const trustError = requireTrustedService(request);
  if (trustError) return trustError;
  const recordId = request.nextUrl.searchParams.get("recordId")?.trim();
  const entry = request.nextUrl.searchParams.get("entry") as RfxWorkflowEntry | null;
  const perspective = request.nextUrl.searchParams.get("perspective") as RfxWorkflowPerspective | null;
  if (!recordId || !entry || !entries.has(entry) || !perspective || !perspectives.has(perspective)) {
    return NextResponse.json({ error: "recordId, perspective, and a supported RFx workflow entry are required." }, { status: 400 });
  }
  if (perspectiveForEntry(entry) !== perspective) return NextResponse.json({ error: "RFx workflow entry does not match the requested perspective." }, { status: 400 });
  try {
    const workspace = await loadPostgresRfxWorkspace(recordId, perspective, entry);
    return NextResponse.json({ workspace, persistence: "postgres" });
  } catch (error) {
    return serviceError(error);
  }
}

export async function PUT(request: NextRequest) {
  const trustError = requireTrustedService(request);
  if (trustError) return trustError;
  try {
    const payload = await request.json() as { workspace?: RfxWorkspace };
    const workspace = payload.workspace;
    if (!workspace || !workspace.recordId || !entries.has(workspace.entry) || !perspectives.has(workspace.perspective) || perspectiveForEntry(workspace.entry) !== workspace.perspective) {
      return NextResponse.json({ error: "A valid RFx workspace is required." }, { status: 400 });
    }
    const saved = await savePostgresRfxWorkspace(workspace);
    return NextResponse.json({ workspace: saved, persistence: "postgres" });
  } catch (error) {
    return serviceError(error);
  }
}
