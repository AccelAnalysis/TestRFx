export type CapabilityWorkflowMode =
  | "manage-capabilities"
  | "ai-amacs"
  | "capability-evidence"
  | "capability-gaps"
  | "publish-updates"
  | "match-rfx"
  | "refer";

export function isCapabilityWorkflowMode(value: string): value is CapabilityWorkflowMode {
  return value === "manage-capabilities"
    || value === "ai-amacs"
    || value === "capability-evidence"
    || value === "capability-gaps"
    || value === "publish-updates"
    || value === "match-rfx"
    || value === "refer";
}
