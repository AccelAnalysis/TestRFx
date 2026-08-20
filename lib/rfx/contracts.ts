export type RfxType = "RFI" | "RFQ" | "RFP" | "Sources Sought" | "Supplier Request" | "Subcontractor Request" | "Service Request" | "Product Request" | "Partner Request";
export type RfxSource = "rfxchange" | "external";
export type RfxStatus =
  | "draft"
  | "internal-review"
  | "ready"
  | "open"
  | "closing-soon"
  | "closed"
  | "evaluation"
  | "clarification"
  | "selected"
  | "awarded"
  | "executing"
  | "completed"
  | "cancelled";

export type RfxRequirementKind = "capability" | "eligibility" | "documentation" | "commercial";

export interface RfxRequirement {
  id: string;
  label: string;
  kind: RfxRequirementKind;
  mandatory: boolean;
  profileState?: "matched" | "confirm" | "gap";
}

export interface RfxMatchSummary {
  matched: number;
  total: number;
  geographyMatched: boolean;
  summary: string;
}

export interface RfxDetail {
  exchangeRecordId: string;
  solicitationNumber: string;
  rfxType: RfxType;
  source: RfxSource;
  status: RfxStatus;
  issuedAt?: string;
  closesAt?: string;
  performanceGeography: string;
  estimatedValue?: string;
  scope: string;
  deliverables: string[];
  requirements: RfxRequirement[];
  responseRequirements: string[];
  evaluationMethod?: string;
  match?: RfxMatchSummary;
  externalSubmissionRequired?: boolean;
}

export type RfxPursuitState =
  | "discovered"
  | "matched"
  | "invited"
  | "watching"
  | "assessing"
  | "declined"
  | "pursuing"
  | "teaming"
  | "drafting"
  | "ready"
  | "submitted"
  | "withdrawn"
  | "clarification"
  | "selected"
  | "not-selected"
  | "executing"
  | "outcome-reported";

export type RfxWorkflowPerspective = "issuer" | "responder";
export type RfxWorkflowEntry = "create-rfx" | "manage-rfx" | "invite-team" | "respond" | "team" | "view";
export type RfxWorkflowSurfaceKind = "group" | "form" | "checklist" | "list" | "decision" | "review" | "status" | "handoff";
export type RfxWorkflowFieldType = "text" | "textarea" | "date" | "number" | "select" | "boolean";

export interface RfxWorkflowField {
  id: string;
  label: string;
  type: RfxWorkflowFieldType;
  required?: boolean;
  placeholder?: string;
  options?: string[];
  help?: string;
}

export interface RfxWorkflowNode {
  id: string;
  label: string;
  description: string;
  kind: RfxWorkflowSurfaceKind;
  fields?: RfxWorkflowField[];
  checklist?: string[];
  children?: RfxWorkflowNode[];
  handoff?: "capabilities" | "resources" | "referrals" | "external-submission";
}

export interface RfxWorkspaceItem {
  id: string;
  nodeId: string;
  label: string;
  note?: string;
  status?: string;
  createdAt: string;
}

export type RfxWorkspaceValue = string | number | boolean | string[] | null;

export interface RfxWorkspace {
  id: string;
  recordId: string;
  perspective: RfxWorkflowPerspective;
  entry: RfxWorkflowEntry;
  activePath: string[];
  values: Record<string, RfxWorkspaceValue>;
  completedNodeIds: string[];
  items: RfxWorkspaceItem[];
  pursuitState?: RfxPursuitState;
  rfxStatus?: RfxStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface RfxWorkspaceEnvelope {
  workspace: RfxWorkspace;
  persistence: "postgres" | "local-device";
}
