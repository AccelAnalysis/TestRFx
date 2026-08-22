import type { RfxDetail, RfxWorkflowNode, RfxWorkflowPerspective, RfxWorkspace, RfxWorkspaceValue } from "./contracts";

export type RfxMobileTreatment =
  | "chapter-home"
  | "need-capture"
  | "choice"
  | "single-task"
  | "list-builder"
  | "checklist"
  | "market-preview"
  | "opportunity-decision"
  | "response-home"
  | "preflight"
  | "preview"
  | "hosted-submission"
  | "external-submission"
  | "receipt"
  | "activity"
  | "handoff";

export type RfxExperienceMode = "quick" | "guided" | "formal";

export interface RfxTypeRecommendation {
  type: RfxDetail["rfxType"];
  reason: string;
  alternatives: RfxDetail["rfxType"][];
  mode: RfxExperienceMode;
}

export interface RfxChapterSummary {
  id: string;
  label: string;
  description: string;
  path: string[];
  complete: number;
  total: number;
  percent: number;
  nextPath?: string[];
  blockers: number;
}

export interface RfxPreflightItem {
  id: string;
  label: string;
  state: "complete" | "warning" | "blocker";
  message: string;
  path?: string[];
}

export interface RfxPreflightResult {
  percent: number;
  complete: number;
  total: number;
  blockers: RfxPreflightItem[];
  warnings: RfxPreflightItem[];
  items: RfxPreflightItem[];
  ready: boolean;
}

const QUICK_PUBLICATION = new Set([
  "need",
  "select-rfx-type",
  "scope",
  "requirements",
  "schedule",
  "preview",
]);

const GUIDED_PUBLICATION = new Set([
  ...QUICK_PUBLICATION,
  "deliverables",
  "response-instructions",
  "pre-publication-validation",
]);

const FORMAL_PUBLICATION = new Set([
  ...GUIDED_PUBLICATION,
  "evaluation-criteria",
  "evaluation-governance",
  "approval-gates",
  "publication-readiness",
]);

const RESPONSE_REQUIRED = new Set([
  "plan-response",
  "draft",
  "reused-profile-confirmation",
  "validate-compliance",
  "review",
]);

const RESPONSE_WARNING = new Set([
  "assess-fit",
  "go-no-go",
  "qa-addenda",
  "collaborate",
]);

function stringValue(value: RfxWorkspaceValue | undefined) {
  return value === null || value === undefined ? "" : String(value).trim();
}

export function nodeRequiredFieldsComplete(node: RfxWorkflowNode, workspace: RfxWorkspace) {
  return (node.fields ?? [])
    .filter((field) => field.required)
    .every((field) => stringValue(workspace.values[field.id]).length > 0);
}

export function nodeChecklistComplete(node: RfxWorkflowNode, workspace: RfxWorkspace) {
  return (node.checklist ?? []).every((_, index) => Boolean(workspace.values[`check:${node.id}:${index}`]));
}

export function nodeHasListItem(node: RfxWorkflowNode, workspace: RfxWorkspace) {
  if (node.kind !== "list") return true;
  if (!(node.fields ?? []).some((field) => field.required)) return true;
  return workspace.items.some((item) => item.nodeId === node.id);
}

export function isNodeComplete(node: RfxWorkflowNode, workspace: RfxWorkspace) {
  if (node.children?.length) {
    const leaves = collectLeafNodes(node);
    return leaves.length > 0 && leaves.every(({ node: leaf }) => isNodeComplete(leaf, workspace));
  }
  if (workspace.completedNodeIds.includes(node.id)) return true;
  if (!nodeRequiredFieldsComplete(node, workspace)) return false;
  if (!nodeChecklistComplete(node, workspace)) return false;
  if (!nodeHasListItem(node, workspace)) return false;
  const hasWork = Boolean(node.fields?.length || node.checklist?.length || node.kind === "list");
  return hasWork;
}

export function collectLeafNodes(node: RfxWorkflowNode, path: string[] = []): { node: RfxWorkflowNode; path: string[] }[] {
  const nextPath = [...path, node.id];
  if (!node.children?.length) return [{ node, path: nextPath }];
  return node.children.flatMap((child) => collectLeafNodes(child, nextPath));
}

export function collectTreeLeaves(nodes: RfxWorkflowNode[]) {
  return nodes.flatMap((node) => collectLeafNodes(node));
}

export function mobileTreatmentFor(node: RfxWorkflowNode, perspective: RfxWorkflowPerspective): RfxMobileTreatment {
  if (node.id === "need") return "need-capture";
  if (node.id === "understand-market" || ["potential-matches", "required-criteria", "service-geography", "profile-completeness"].includes(node.id)) return "market-preview";
  if (perspective === "responder" && node.id === "view") return "opportunity-decision";
  if (perspective === "responder" && node.id === "respond") return "response-home";
  if (["pre-publication-validation", "publication-readiness", "validate-compliance", "review"].includes(node.id)) return "preflight";
  if (node.id === "preview") return "preview";
  if (node.id === "hosted-submission") return "hosted-submission";
  if (node.id === "external-submission") return "external-submission";
  if (node.id === "submission-receipt") return "receipt";
  if (node.kind === "handoff") return "handoff";
  if (node.kind === "decision" || node.fields?.some((field) => field.type === "select")) return "choice";
  if (node.kind === "list") return "list-builder";
  if (node.kind === "checklist") return "checklist";
  if (node.kind === "status") return "activity";
  if (node.children?.length) return "chapter-home";
  return "single-task";
}

export function summarizeChapter(node: RfxWorkflowNode, path: string[], workspace: RfxWorkspace): RfxChapterSummary {
  const leaves = collectLeafNodes(node, path.slice(0, -1));
  const completed = leaves.filter(({ node: leaf }) => isNodeComplete(leaf, workspace));
  const next = leaves.find(({ node: leaf }) => !isNodeComplete(leaf, workspace));
  const blockers = leaves.filter(({ node: leaf }) => !nodeRequiredFieldsComplete(leaf, workspace) || !nodeChecklistComplete(leaf, workspace) || !nodeHasListItem(leaf, workspace));
  return {
    id: node.id,
    label: node.label,
    description: node.description,
    path,
    complete: completed.length,
    total: leaves.length,
    percent: leaves.length ? Math.round((completed.length / leaves.length) * 100) : 0,
    nextPath: next?.path,
    blockers: blockers.length,
  };
}

export function chapterSummaries(root: RfxWorkflowNode, workspace: RfxWorkspace) {
  return (root.children ?? []).map((child) => summarizeChapter(child, [root.id, child.id], workspace));
}

export function nextIncompletePath(root: RfxWorkflowNode, workspace: RfxWorkspace) {
  return collectLeafNodes(root).find(({ node }) => !isNodeComplete(node, workspace))?.path;
}

export function progressForRoot(root: RfxWorkflowNode, workspace: RfxWorkspace) {
  const leaves = collectLeafNodes(root);
  const complete = leaves.filter(({ node }) => isNodeComplete(node, workspace)).length;
  return {
    complete,
    total: leaves.length,
    percent: leaves.length ? Math.round((complete / leaves.length) * 100) : 0,
  };
}

function containsAny(value: string, terms: string[]) {
  return terms.some((term) => value.includes(term));
}

export function recommendRfxType(needStatement: string): RfxTypeRecommendation {
  const normalized = needStatement.trim().toLowerCase();
  const words = normalized.split(/\s+/).filter(Boolean).length;
  const formal = containsAny(normalized, ["regulated", "formal procurement", "weighted evaluation", "legal review", "public agency", "multiple evaluators", "best and final"]);
  const mode: RfxExperienceMode = formal ? "formal" : words > 32 ? "guided" : "quick";

  if (containsAny(normalized, ["quote", "price", "lowest price", "unit price", "commodity"])) {
    return { type: "RFQ", reason: "The need is primarily price- and specification-driven.", alternatives: ["Product Request", "RFP"], mode };
  }
  if (containsAny(normalized, ["learn about", "information", "market research", "feedback", "understand the market"])) {
    return { type: "RFI", reason: "The immediate goal is to gather information before making a purchase or selection.", alternatives: ["Sources Sought", "RFP"], mode };
  }
  if (containsAny(normalized, ["sources sought", "who can", "capable suppliers", "capability statement"])) {
    return { type: "Sources Sought", reason: "The need is focused on identifying capable organizations and market capacity.", alternatives: ["RFI", "Supplier Request"], mode };
  }
  if (containsAny(normalized, ["subcontract", "subcontractor", "prime contractor"])) {
    return { type: "Subcontractor Request", reason: "The request is seeking a subcontractor or delivery partner for a defined pursuit or project.", alternatives: ["Partner Request", "Supplier Request"], mode };
  }
  if (containsAny(normalized, ["partner", "teaming", "joint pursuit", "collaborate"])) {
    return { type: "Partner Request", reason: "The need is centered on finding a partner or teaming relationship.", alternatives: ["Subcontractor Request", "Sources Sought"], mode };
  }
  if (containsAny(normalized, ["product", "equipment", "materials", "inventory", "supply"])) {
    return { type: "Product Request", reason: "The request is centered on a product or tangible supply need.", alternatives: ["RFQ", "Supplier Request"], mode };
  }
  if (containsAny(normalized, ["service", "consulting", "support", "maintenance", "training"])) {
    const complex = containsAny(normalized, ["approach", "strategy", "implementation", "plan", "outcome", "complex"]);
    return complex
      ? { type: "RFP", reason: "Responders need to propose an approach, team, and delivery plan—not only a price.", alternatives: ["Service Request", "RFQ"], mode: formal ? "formal" : "guided" }
      : { type: "Service Request", reason: "The need is a defined service request that can use a lighter guided path.", alternatives: ["RFP", "RFQ"], mode };
  }
  return {
    type: "RFP",
    reason: "The need appears to require responders to explain how they would deliver the desired result.",
    alternatives: ["Service Request", "RFI"],
    mode: formal ? "formal" : "guided",
  };
}

export function experienceMode(workspace: RfxWorkspace): RfxExperienceMode {
  const value = stringValue(workspace.values["experience.mode"]);
  return value === "quick" || value === "formal" ? value : "guided";
}

function publicationRequired(mode: RfxExperienceMode) {
  return mode === "quick" ? QUICK_PUBLICATION : mode === "formal" ? FORMAL_PUBLICATION : GUIDED_PUBLICATION;
}

function findNodeAndPath(root: RfxWorkflowNode, id: string) {
  return collectLeafNodes(root).find(({ node }) => node.id === id);
}

function checkNode(root: RfxWorkflowNode, id: string, workspace: RfxWorkspace, label?: string): RfxPreflightItem {
  const found = findNodeAndPath(root, id);
  if (!found) return { id, label: label ?? id, state: "warning", message: "This workflow item is not available in the current RFx template." };
  const complete = isNodeComplete(found.node, workspace);
  return {
    id,
    label: label ?? found.node.label,
    state: complete ? "complete" : "blocker",
    message: complete ? "Complete" : "Required work remains.",
    path: found.path,
  };
}

function finishPreflight(items: RfxPreflightItem[]): RfxPreflightResult {
  const complete = items.filter((item) => item.state === "complete").length;
  const blockers = items.filter((item) => item.state === "blocker");
  const warnings = items.filter((item) => item.state === "warning");
  return {
    complete,
    total: items.length,
    percent: items.length ? Math.round((complete / items.length) * 100) : 0,
    blockers,
    warnings,
    items,
    ready: blockers.length === 0,
  };
}

export function publicationPreflight(root: RfxWorkflowNode, workspace: RfxWorkspace) {
  const required = publicationRequired(experienceMode(workspace));
  const items = [...required].map((id) => checkNode(root, id, workspace));
  const qa = stringValue(workspace.values["schedule.qaDeadline"]);
  const response = stringValue(workspace.values["schedule.responseDeadline"]);
  if (qa && response && new Date(qa).getTime() >= new Date(response).getTime()) {
    items.push({ id: "date-conflict", label: "Q&A and response dates", state: "blocker", message: "The response deadline must occur after the Q&A deadline.", path: [root.id, "build-scope", "schedule"] });
  }
  return finishPreflight(items);
}

export function responsePreflight(root: RfxWorkflowNode, workspace: RfxWorkspace) {
  const items: RfxPreflightItem[] = [...RESPONSE_REQUIRED].map((id) => checkNode(root, id, workspace));
  for (const id of RESPONSE_WARNING) {
    const found = findNodeAndPath(root, id);
    if (found && !isNodeComplete(found.node, workspace)) {
      items.push({ id, label: found.node.label, state: "warning", message: "Recommended before final submission.", path: found.path });
    }
  }
  return finishPreflight(items);
}

export function matchBreakdown(detail?: RfxDetail) {
  const requirements = detail?.requirements ?? [];
  return {
    matched: requirements.filter((item) => item.profileState === "matched").length,
    confirm: requirements.filter((item) => item.profileState === "confirm").length,
    gap: requirements.filter((item) => item.profileState === "gap").length,
    total: requirements.length,
  };
}

export function estimateResponseEffort(detail?: RfxDetail) {
  const count = (detail?.responseRequirements.length ?? 0) + (detail?.requirements.length ?? 0);
  if (count <= 5) return { label: "Light", detail: "A short response with a small number of required elements." };
  if (count <= 10) return { label: "Medium", detail: "A structured response with several sections and confirmations." };
  return { label: "High", detail: "A formal response with multiple sections, attachments, and review work." };
}

export function submissionReceipt(workspace: RfxWorkspace) {
  return [...workspace.items].reverse().find((item) => item.nodeId === "submission-receipt" || item.nodeId === "external-submission");
}
