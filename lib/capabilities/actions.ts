import type { CapabilityNavigationNodeId } from "./navigation";

export type CapabilityWorkflowMode = Exclude<CapabilityNavigationNodeId, "open-capabilities" | "own-organization" | "other-organization">;
const actionModes = new Set<string>(["manage-capabilities", "ai-amacs", "capability-evidence", "capability-gaps", "match-rfx", "refer", "view-capabilities", "save-follow"]);
export function isCapabilityWorkflowMode(value: string): value is CapabilityWorkflowMode { return actionModes.has(value); }
