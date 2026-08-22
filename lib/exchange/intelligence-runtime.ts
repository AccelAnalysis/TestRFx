import type { ExchangeRecord } from "./contracts";

export type IntelligenceSourceType = "exchange-activity" | "participant-observation" | "external-dataset";
export type IntelligenceWorkflow = "add" | "edit" | "note" | "compare";
export type IntelligenceCompareDimension = "insights" | "organizations" | "geographies";
export type IntelligenceOwnership = "own" | "other";
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

export interface IntelligenceDetail {
  record: ExchangeRecord;
  signalType: string;
  observedFrom?: string;
  observedTo?: string;
  sourceType?: IntelligenceSourceType;
  provenance: Record<string, unknown>;
  sources: IntelligenceSource[];
  notes: IntelligenceNote[];
  tracking: { active: boolean; mode?: "track" | "follow"; updatedAt?: string };
  relatedRecords: ExchangeRecord[];
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

export interface IntelligenceCompareSide {
  label: string;
  records: Array<{ id: string; title: string; organization: string; geography: string; signalType?: string; observedFrom?: string; observedTo?: string }>;
}
export interface IntelligenceCompareResponse { dimension: IntelligenceCompareDimension; left: IntelligenceCompareSide; right: IntelligenceCompareSide; }

export interface IntelligenceActivityItem {
  id: string;
  eventName: string;
  actorUserId?: string;
  organizationId?: string;
  payload: Record<string, unknown>;
  occurredAt: string;
}

export interface IntelligenceNavigationNode {
  id: string;
  label: string;
  description: string;
  kind: "root" | "view" | "action" | "result" | "outcome" | "referral";
  ownership?: IntelligenceOwnership;
  outcomeAction?: IntelligenceOutcomeAction;
  children?: IntelligenceNavigationNode[];
}

function outcomes(prefix: string): IntelligenceNavigationNode[] {
  return [
    { id: `${prefix}.decision-support`, label: "Decision Support", description: "Use the selected intelligence context to inform a decision.", kind: "outcome", outcomeAction: "decision-support" },
    { id: `${prefix}.matching`, label: "Opportunity / Capability Matching", description: "Open governed related RFx and capability context without inventing a match.", kind: "outcome", outcomeAction: "matching" },
    { id: `${prefix}.referral`, label: "Referral Trigger (Cross-Lens)", description: "Open the shared referral workflow with this intelligence record as context.", kind: "outcome", outcomeAction: "referral-trigger", children: [
      { id: `${prefix}.referral.create`, label: "Create Referral", description: "Choose the recipient, review any published referral policy/fee, and create the referral.", kind: "referral", outcomeAction: "create-referral" },
    ] },
    { id: `${prefix}.return`, label: "Save / Watch / Return to Exchange", description: "Persist Track/Follow in the shared relationship service and return to the mounted Exchange.", kind: "outcome", outcomeAction: "return-exchange" },
  ];
}

function result(id: string, label: string, description: string): IntelligenceNavigationNode {
  return { id, label, description, kind: "result", children: outcomes(id) };
}

export const intelligenceNavigationTree: IntelligenceNavigationNode = {
  id: "intelligence", label: "Intelligence", description: "Discover, analyze, contribute, and track intelligence inside the Exchange.", kind: "root", children: [
    { id: "intelligence.own", label: "Own View", description: "Actions for intelligence owned by the active organization.", kind: "view", ownership: "own", children: [
      { id: "intelligence.own.add", label: "Add Insight", description: "Create an organization-owned intelligence record.", kind: "action", ownership: "own", children: [result("intelligence.own.add.updated", "Insight record updated", "The new insight is part of the canonical Intelligence repository.")] },
      { id: "intelligence.own.edit", label: "Edit Insight", description: "Edit an organization-owned insight.", kind: "action", ownership: "own", children: [result("intelligence.own.edit.updated", "Insight record updated", "The canonical insight and activity history were updated.")] },
      { id: "intelligence.own.compare", label: "Compare", description: "Compare intelligence across insights, organizations, or geographies.", kind: "action", ownership: "own", children: [result("intelligence.own.compare.analyze", "Analyze patterns / compare intelligence", "Review the returned source-backed comparison.")] },
      { id: "intelligence.own.track", label: "Track", description: "Track the selected intelligence record through the shared relationship service.", kind: "action", ownership: "own", children: [result("intelligence.own.track.activity", "Follow changes / watch intelligence activity", "Review persisted Intelligence activity while tracking remains active.")] },
    ] },
    { id: "intelligence.other", label: "Others View", description: "Actions for intelligence owned by another organization.", kind: "view", ownership: "other", children: [
      { id: "intelligence.other.view", label: "View Insight Detail", description: "Review source, provenance, notes, relationships, and activity.", kind: "action", ownership: "other", children: [result("intelligence.other.view.context", "Review intelligence context", "Review the canonical Intelligence record and its provenance.")] },
      { id: "intelligence.other.note", label: "Add Note", description: "Add commentary without altering the source record.", kind: "action", ownership: "other", children: [result("intelligence.other.note.contributed", "Contribute note or commentary", "The note is stored independently of the source record.")] },
      { id: "intelligence.other.compare", label: "Compare", description: "Compare external intelligence across supported source dimensions.", kind: "action", ownership: "other", children: [result("intelligence.other.compare.external", "Compare external intelligence", "Review source-backed differences without treating missing data as zero.")] },
      { id: "intelligence.other.follow", label: "Follow / Track", description: "Follow the selected external intelligence record.", kind: "action", ownership: "other", children: [result("intelligence.other.follow.monitor", "Monitor updates and changes", "Follow state is stored in the shared relationship service.")] },
    ] },
  ],
};

const nodeIndex = new Map<string, IntelligenceNavigationNode>();
const parentIndex = new Map<string, string | undefined>();
function index(node: IntelligenceNavigationNode, parent?: string) { nodeIndex.set(node.id, node); parentIndex.set(node.id, parent); node.children?.forEach((child) => index(child, node.id)); }
index(intelligenceNavigationTree);
export function getIntelligenceNavigationNode(id: string) { return nodeIndex.get(id); }
export function getIntelligenceNavigationPath(id: string) { const path: IntelligenceNavigationNode[] = []; let current: string | undefined = id; while (current) { const node = nodeIndex.get(current); if (!node) break; path.unshift(node); current = parentIndex.get(current); } return path; }
