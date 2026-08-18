import type { RfxPursuitState, RfxStatus, RfxWorkflowEntry, RfxWorkflowPerspective, RfxWorkspace, RfxWorkspaceValue } from "./contracts";
import { perspectiveForEntry, rootForEntry } from "./workflow-tree";

export function createRfxWorkspace(recordId: string, entry: RfxWorkflowEntry): RfxWorkspace {
  const now = new Date().toISOString();
  const perspective = perspectiveForEntry(entry);
  return {
    id: `${recordId}:${perspective}`,
    recordId,
    perspective,
    entry,
    activePath: [rootForEntry(entry)],
    values: {},
    completedNodeIds: [],
    items: [],
    pursuitState: perspective === "responder" ? "discovered" : undefined,
    rfxStatus: perspective === "issuer" ? "draft" : undefined,
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
}

export function withWorkspaceEntry(workspace: RfxWorkspace, entry: RfxWorkflowEntry): RfxWorkspace {
  const perspective = perspectiveForEntry(entry);
  if (workspace.perspective !== perspective) return createRfxWorkspace(workspace.recordId, entry);
  return { ...workspace, entry, activePath: [rootForEntry(entry)], updatedAt: new Date().toISOString() };
}

export function setWorkspaceValues(workspace: RfxWorkspace, values: Record<string, RfxWorkspaceValue>): RfxWorkspace {
  return { ...workspace, values: { ...workspace.values, ...values }, version: workspace.version + 1, updatedAt: new Date().toISOString() };
}

export function completeWorkspaceNode(workspace: RfxWorkspace, nodeId: string): RfxWorkspace {
  const completed = workspace.completedNodeIds.includes(nodeId) ? workspace.completedNodeIds : [...workspace.completedNodeIds, nodeId];
  return { ...workspace, completedNodeIds: completed, version: workspace.version + 1, updatedAt: new Date().toISOString() };
}

export function setPursuitState(workspace: RfxWorkspace, pursuitState: RfxPursuitState): RfxWorkspace {
  return { ...workspace, pursuitState, version: workspace.version + 1, updatedAt: new Date().toISOString() };
}

export function setRfxStatus(workspace: RfxWorkspace, rfxStatus: RfxStatus): RfxWorkspace {
  return { ...workspace, rfxStatus, version: workspace.version + 1, updatedAt: new Date().toISOString() };
}

export function coerceRfxWorkspace(value: unknown, recordId: string, entry: RfxWorkflowEntry): RfxWorkspace {
  if (!value || typeof value !== "object") return createRfxWorkspace(recordId, entry);
  const candidate = value as Partial<RfxWorkspace>;
  const perspective: RfxWorkflowPerspective = perspectiveForEntry(entry);
  if (candidate.recordId !== recordId || candidate.perspective !== perspective) return createRfxWorkspace(recordId, entry);
  return {
    ...createRfxWorkspace(recordId, entry),
    ...candidate,
    recordId,
    perspective,
    entry,
    activePath: Array.isArray(candidate.activePath) && candidate.activePath.length ? candidate.activePath : [rootForEntry(entry)],
    values: candidate.values && typeof candidate.values === "object" ? candidate.values : {},
    completedNodeIds: Array.isArray(candidate.completedNodeIds) ? candidate.completedNodeIds : [],
    items: Array.isArray(candidate.items) ? candidate.items : [],
  };
}
