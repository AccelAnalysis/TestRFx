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

export async function loadRfxWorkspace(recordId: string, entry: RfxWorkflowEntry): Promise<RfxWorkspaceEnvelope> {
  const perspective = perspectiveForEntry(entry);
  try {
    const params = new URLSearchParams({ recordId, perspective, entry });
    const response = await fetch(`/api/rfx/workspaces?${params.toString()}`, { cache: "no-store" });
    if (response.ok) {
      const payload = (await response.json()) as RfxWorkspaceEnvelope;
      return { workspace: withWorkspaceEntry(coerceRfxWorkspace(payload.workspace, recordId, entry), entry), persistence: "postgres" };
    }
  } catch {
    // Static previews and offline clients intentionally fall through to the durable device workspace.
  }
  return { workspace: readLocal(recordId, entry), persistence: "local-device" };
}

export async function saveRfxWorkspace(workspace: RfxWorkspace, persistence: RfxWorkspaceEnvelope["persistence"]): Promise<RfxWorkspaceEnvelope> {
  if (persistence === "postgres") {
    try {
      const response = await fetch("/api/rfx/workspaces", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workspace }),
      });
      if (response.ok) return (await response.json()) as RfxWorkspaceEnvelope;
    } catch {
      // Preserve the user's work locally if the remote data service is temporarily unreachable.
    }
  }
  writeLocal(workspace);
  return { workspace, persistence: "local-device" };
}

export function clearLocalRfxWorkspace(recordId: string, entry: RfxWorkflowEntry) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(storageKey(recordId, entry));
}
