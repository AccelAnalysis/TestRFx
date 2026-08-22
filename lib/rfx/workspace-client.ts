"use client";

import type { RfxWorkflowEntry, RfxWorkspace, RfxWorkspaceEnvelope } from "./contracts";
import { coerceRfxWorkspace, createRfxWorkspace, withWorkspaceEntry } from "./workspace";
import { perspectiveForEntry } from "./workflow-tree";

const prefix = "rfxchange:rfx-workspace:";

function storageKey(recordId: string, entry: RfxWorkflowEntry) {
  return `${prefix}${recordId}:${perspectiveForEntry(entry)}`;
}

function readLocal(recordId: string, entry: RfxWorkflowEntry): RfxWorkspace {
  if (typeof window === "undefined") return createRfxWorkspace(recordId, entry);
  try {
    const raw = window.localStorage.getItem(storageKey(recordId, entry));
    if (!raw) return createRfxWorkspace(recordId, entry);
    return withWorkspaceEntry(coerceRfxWorkspace(JSON.parse(raw), recordId, entry), entry);
  } catch {
    return createRfxWorkspace(recordId, entry);
  }
}

function writeLocal(workspace: RfxWorkspace) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(`${prefix}${workspace.recordId}:${workspace.perspective}`, JSON.stringify(workspace));
}

function hasMeaningfulLocalWork(workspace: RfxWorkspace) {
  return workspace.version > 1 || Object.keys(workspace.values).length > 0 || workspace.items.length > 0 || workspace.completedNodeIds.length > 0;
}

function isLocalNewer(local: RfxWorkspace, remote: RfxWorkspace) {
  if (!hasMeaningfulLocalWork(local)) return false;
  if (local.version !== remote.version) return local.version > remote.version;
  return new Date(local.updatedAt).getTime() > new Date(remote.updatedAt).getTime();
}

async function putShared(workspace: RfxWorkspace): Promise<RfxWorkspaceEnvelope | undefined> {
  try {
    const response = await fetch("/api/rfx/workspaces", {
      method: "PUT",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workspace }),
    });
    if (response.ok) return await response.json() as RfxWorkspaceEnvelope;
  } catch {
    // Offline/static clients deliberately remain on the durable device workspace.
  }
  return undefined;
}

export async function loadRfxWorkspace(recordId: string, entry: RfxWorkflowEntry): Promise<RfxWorkspaceEnvelope> {
  const perspective = perspectiveForEntry(entry);
  const local = readLocal(recordId, entry);

  try {
    const params = new URLSearchParams({ recordId, perspective, entry });
    const response = await fetch(`/api/rfx/workspaces?${params.toString()}`, { cache: "no-store", credentials: "same-origin" });
    if (response.ok) {
      const payload = await response.json() as RfxWorkspaceEnvelope;
      const remote = withWorkspaceEntry(coerceRfxWorkspace(payload.workspace, recordId, entry), entry);
      if (isLocalNewer(local, remote)) {
        const promoted = await putShared({ ...local, entry, activePath: local.activePath.length ? local.activePath : remote.activePath });
        if (promoted) return { workspace: withWorkspaceEntry(coerceRfxWorkspace(promoted.workspace, recordId, entry), entry), persistence: "postgres" };
      }
      return { workspace: remote, persistence: "postgres" };
    }
  } catch {
    // Static previews and offline clients intentionally fall through to the durable device workspace.
  }

  return { workspace: local, persistence: "local-device" };
}

export async function saveRfxWorkspace(workspace: RfxWorkspace, persistence: RfxWorkspaceEnvelope["persistence"]): Promise<RfxWorkspaceEnvelope> {
  if (persistence === "postgres") {
    const saved = await putShared(workspace);
    if (saved) return saved;
  }
  writeLocal(workspace);
  return { workspace, persistence: "local-device" };
}

export function clearLocalRfxWorkspace(recordId: string, entry: RfxWorkflowEntry) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(storageKey(recordId, entry));
}
