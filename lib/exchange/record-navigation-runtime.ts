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
]);

export function isRecordNavigationCommandOperational(node: RecordNavigationNode) {
  return Boolean(node.command && operationalCommands.has(node.command));
}

export function recordNavigationUnavailableReason(node: RecordNavigationNode) {
  if (node.service === "amacs") return "AMACS/AI mapping is not configured. RFxchange will not fabricate taxonomy suggestions.";
  if (node.service === "matching") return "A governed matching service is not configured. RFxchange will not return deterministic fixture matches as production results.";
  if (node.service === "rfx" && node.command) return "This RFx lifecycle command does not yet have a production command service behind it.";
  if (node.service === "capabilities" && node.command) return "This capability write requires the production capability/evidence service; the reference workflow has been removed.";
  if (node.command && !operationalCommands.has(node.command)) return "This source-defined handoff is not yet connected to a production service.";
  return undefined;
}
