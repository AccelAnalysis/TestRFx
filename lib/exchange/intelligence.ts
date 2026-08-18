import type { ExchangeLens, ExchangeRecord } from "./contracts";

export type IntelligenceSourceType = "exchange-activity" | "participant-observation" | "external-dataset";
export type IntelligenceWorkflow = "add" | "edit" | "note" | "compare";
export type IntelligenceCompareDimension = "insights" | "organizations" | "geographies";
export type IntelligenceOwnership = "own" | "other";
export type IntelligenceNavigationKind = "root" | "view" | "action" | "result" | "outcome" | "referral";
export type IntelligenceOutcomeAction = "decision-support" | "matching" | "referral-trigger" | "return-exchange" | "create-referral";

export interface IntelligenceInsightInput {
  title: string;
  summary: string;
  geography: string;
  signalType: string;
  observedFrom?: string;
  observedTo?: string;
  sourceLabel: string;
  sourceType: IntelligenceSourceType;
  sourceUri?: string;
  locationId?: string;
}

export interface IntelligenceSource {
  id: string;
  label: string;
  type: IntelligenceSourceType;
  publisher?: string;
  uri?: string;
  observedAt?: string;
  retrievedAt?: string;
}

export interface IntelligenceNote {
  id: string;
  body: string;
  visibility: "personal" | "organization" | "shared";
  authorUserId: string;
  organizationId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IntelligenceTrackingState {
  active: boolean;
  mode?: "track" | "follow";
  createdAt?: string;
  updatedAt?: string;
}

export interface IntelligenceDetail {
  record: ExchangeRecord;
  signalType: string;
  observedFrom?: string;
  observedTo?: string;
  sourceType?: IntelligenceSourceType;
  provenance: Record<string, unknown>;
  sources: IntelligenceSource[];
  notes: IntelligenceNote[];
  tracking: IntelligenceTrackingState;
  relatedCapabilities: ExchangeRecord[];
  relatedOrganizations: Array<{ id: string; name: string }>;
}

export interface IntelligenceListResponse {
  records: ExchangeRecord[];
  total: number;
  mapped: number;
  offMap: number;
  offset: number;
  limit: number;
  nextOffset?: number;
}

export interface IntelligenceCompareRequest {
  dimension: IntelligenceCompareDimension;
  left: string;
  right: string;
}

export interface IntelligenceCompareSide {
  label: string;
  records: Array<{
    id: string;
    title: string;
    organization: string;
    geography: string;
    signalType?: string;
    observedFrom?: string;
    observedTo?: string;
  }>;
}

export interface IntelligenceCompareResponse {
  dimension: IntelligenceCompareDimension;
  left: IntelligenceCompareSide;
  right: IntelligenceCompareSide;
}

export interface IntelligenceMatchCandidate {
  id: string;
  lens: Extract<ExchangeLens, "rfx" | "capabilities">;
  title: string;
  organizationId: string;
  organization: string;
  geography: string;
  rank: number;
  reasons: string[];
}

export interface IntelligenceReferralInput {
  recipientOrganizationId: string;
  note?: string;
}

export interface IntelligenceReferralResult {
  referralId: string;
  status: string;
  createdAt: string;
}

export interface IntelligenceNavigationNode {
  id: string;
  label: string;
  description: string;
  kind: IntelligenceNavigationKind;
  ownership?: IntelligenceOwnership;
  outcomeAction?: IntelligenceOutcomeAction;
  children?: IntelligenceNavigationNode[];
}

function outcomeChildren(prefix: string): IntelligenceNavigationNode[] {
  return [
    {
      id: `${prefix}.decision-support`,
      label: "Decision Support",
      description: "Inform decisions with the selected intelligence context.",
      kind: "outcome",
      outcomeAction: "decision-support",
    },
    {
      id: `${prefix}.matching`,
      label: "Opportunity / Capability Matching",
      description: "Discover relevant RFx opportunities and capabilities from the selected intelligence record.",
      kind: "outcome",
      outcomeAction: "matching",
    },
    {
      id: `${prefix}.referral`,
      label: "Referral Trigger (Cross-Lens)",
      description: "Open the shared referral workflow with this intelligence record as context.",
      kind: "outcome",
      outcomeAction: "referral-trigger",
      children: [
        {
          id: `${prefix}.referral.create`,
          label: "Create Referral",
          description: "Choose a recipient organization, review the intelligence context, then create the referral.",
          kind: "referral",
          outcomeAction: "create-referral",
        },
      ],
    },
    {
      id: `${prefix}.return`,
      label: "Save / Watch / Return to Exchange",
      description: "Keep the relationship state and return to the mounted Exchange without losing context.",
      kind: "outcome",
      outcomeAction: "return-exchange",
    },
  ];
}

function resultNode(id: string, label: string, description: string): IntelligenceNavigationNode {
  return { id, label, description, kind: "result", children: outcomeChildren(id) };
}

export const intelligenceNavigationTree: IntelligenceNavigationNode = {
  id: "intelligence",
  label: "Intelligence",
  description: "Discover, analyze, contribute, and track market intelligence within the Exchange.",
  kind: "root",
  children: [
    {
      id: "intelligence.own",
      label: "Own View",
      description: "Actions for intelligence owned by the active organization.",
      kind: "view",
      ownership: "own",
      children: [
        {
          id: "intelligence.own.add",
          label: "Add Insight",
          description: "Create an organization-owned intelligence record.",
          kind: "action",
          ownership: "own",
          children: [resultNode("intelligence.own.add.updated", "Insight record updated", "The new insight is now part of the canonical Intelligence repository.")],
        },
        {
          id: "intelligence.own.edit",
          label: "Edit Insight",
          description: "Review and edit an organization-owned insight.",
          kind: "action",
          ownership: "own",
          children: [resultNode("intelligence.own.edit.updated", "Insight record updated", "The canonical insight and its revision activity were updated.")],
        },
        {
          id: "intelligence.own.compare",
          label: "Compare",
          description: "Compare intelligence across supported source dimensions.",
          kind: "action",
          ownership: "own",
          children: [resultNode("intelligence.own.compare.analyze", "Analyze patterns / compare intelligence", "Review the returned comparison without converting missing values into zero.")],
        },
        {
          id: "intelligence.own.track",
          label: "Track",
          description: "Track changes to the selected intelligence record.",
          kind: "action",
          ownership: "own",
          children: [resultNode("intelligence.own.track.activity", "Follow changes / watch intelligence activity", "The tracking relationship is persisted for the signed-in user.")],
        },
      ],
    },
    {
      id: "intelligence.other",
      label: "Others View",
      description: "Actions for intelligence owned by another organization or RFxchange source.",
      kind: "view",
      ownership: "other",
      children: [
        {
          id: "intelligence.other.view",
          label: "View Insight Detail",
          description: "Open the nested Intelligence detail menu for the selected record.",
          kind: "action",
          ownership: "other",
          children: [resultNode("intelligence.other.view.context", "Review intelligence context", "Review the record, source, provenance, notes, relationships, and tracking state.")],
        },
        {
          id: "intelligence.other.note",
          label: "Add Note",
          description: "Contribute a note or commentary without modifying the source record.",
          kind: "action",
          ownership: "other",
          children: [resultNode("intelligence.other.note.contributed", "Contribute note or commentary", "The note is stored separately from the originating intelligence record.")],
        },
        {
          id: "intelligence.other.compare",
          label: "Compare",
          description: "Compare external intelligence across supported source dimensions.",
          kind: "action",
          ownership: "other",
          children: [resultNode("intelligence.other.compare.external", "Compare external intelligence", "Review source-backed comparisons across insights, organizations, or geographies.")],
        },
        {
          id: "intelligence.other.follow",
          label: "Follow / Track",
          description: "Follow the selected external intelligence record for updates.",
          kind: "action",
          ownership: "other",
          children: [resultNode("intelligence.other.follow.monitor", "Monitor updates and changes", "The follow relationship is persisted for the signed-in user.")],
        },
      ],
    },
  ],
};

const nodeIndex = new Map<string, IntelligenceNavigationNode>();
const parentIndex = new Map<string, string | undefined>();

function indexTree(node: IntelligenceNavigationNode, parent?: string) {
  nodeIndex.set(node.id, node);
  parentIndex.set(node.id, parent);
  node.children?.forEach((child) => indexTree(child, node.id));
}
indexTree(intelligenceNavigationTree);

export function getIntelligenceNavigationNode(id: string) {
  return nodeIndex.get(id);
}

export function getIntelligenceNavigationPath(id: string): IntelligenceNavigationNode[] {
  const path: IntelligenceNavigationNode[] = [];
  let current: string | undefined = id;
  while (current) {
    const node = nodeIndex.get(current);
    if (!node) break;
    path.unshift(node);
    current = parentIndex.get(current);
  }
  return path;
}

export const intelligenceActionNodeIds: Record<string, string> = {
  "add-insight": "intelligence.own.add",
  "edit-insight": "intelligence.own.edit",
  compare: "intelligence.own.compare",
  track: "intelligence.own.track",
  view: "intelligence.other.view",
  "add-note": "intelligence.other.note",
  "follow-track": "intelligence.other.follow",
};

export function resultNodeForAction(actionId: string, ownership: IntelligenceOwnership) {
  if (actionId === "add-insight") return "intelligence.own.add.updated";
  if (actionId === "edit-insight") return "intelligence.own.edit.updated";
  if (actionId === "compare") return ownership === "own" ? "intelligence.own.compare.analyze" : "intelligence.other.compare.external";
  if (actionId === "track") return "intelligence.own.track.activity";
  if (actionId === "view") return "intelligence.other.view.context";
  if (actionId === "add-note") return "intelligence.other.note.contributed";
  if (actionId === "follow-track") return "intelligence.other.follow.monitor";
  return undefined;
}
