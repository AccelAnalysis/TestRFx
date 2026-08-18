import type { RecordNavigationNode } from "./record-navigation";

const operationalCommands = new Set([
  "save",
  "watch",
  "track",
  "follow",
  "share",
  "refer",
  "team",
  "invite-team",
  "offer-resource",
  "edit-resource",
  "request-resource",
  "archive-resource",
  "add-insight",
  "edit-insight",
  "add-note",
  "create-rfx",
  "draft-save-publish",
  "update-rfx",
  "close-rfx",
  "award-advance",
  "respond",
  "view-responses-matches",
  "capability-evidence",
  "publish-capabilities",
]);

export function isRecordNavigationCommandOperational(node: RecordNavigationNode) {
  return Boolean(node.command && operationalCommands.has(node.command));
}

export function recordNavigationUnavailableReason(node: RecordNavigationNode) {
  if (node.service === "amacs") return "AMACS/AI mapping is not configured. RFxchange will not fabricate taxonomy suggestions.";
  if (node.service === "matching") return "A governed matching service is not configured. RFxchange will not return deterministic fixture matches as production results.";
  if (node.command && !operationalCommands.has(node.command)) return "This source-defined handoff is not yet connected to a production service.";
  return undefined;
}
