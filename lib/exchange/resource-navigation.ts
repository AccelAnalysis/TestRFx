import type { ExchangeRecord } from "./contracts";

export type ResourceNavigationAction =
  | "offer"
  | "edit"
  | "share"
  | "save-archive"
  | "request"
  | "view"
  | "save-follow"
  | "referral"
  | "open-referrals-management";

export type ResourceNavigationAudience = "any" | "own" | "other";

export interface ResourceNavigationNode {
  id: string;
  label: string;
  description?: string;
  audience: ResourceNavigationAudience;
  requiresRecord?: boolean;
  action?: ResourceNavigationAction;
  children?: ResourceNavigationNode[];
}

export interface ResourceNavigationState { path: string[]; }
export const initialResourceNavigationState: ResourceNavigationState = { path: [] };

export const resourceNavigationTree: ResourceNavigationNode[] = [
  {
    id: "own-view", label: "My Organization’s Resources", audience: "own", children: [
      { id: "offer-resource", label: "Offer Resource", audience: "own", children: [{ id: "offer-resource-modal", label: "Offer Resource modal", audience: "own", action: "offer" }] },
      { id: "edit-resource", label: "Edit Resource", audience: "own", requiresRecord: true, children: [{ id: "manage-edit-resource", label: "Manage / Edit Resource", audience: "own", requiresRecord: true, action: "edit" }] },
      { id: "share-own", label: "Share", audience: "own", requiresRecord: true, children: [{ id: "share-menu-send-resource", label: "Share menu / send resource", audience: "own", requiresRecord: true, action: "share" }] },
      { id: "save-archive", label: "Save / Archive", audience: "own", requiresRecord: true, children: [{ id: "save-or-archive-action", label: "Save or Archive action", audience: "own", requiresRecord: true, action: "save-archive" }] },
    ],
  },
  {
    id: "others-view", label: "Resources from Other Organizations", audience: "other", children: [
      { id: "request-resource", label: "Request Resource", audience: "other", requiresRecord: true, children: [{ id: "request-resource-modal", label: "Request Resource modal", audience: "other", requiresRecord: true, action: "request" }] },
      { id: "view-resource-detail", label: "View Resource Detail", audience: "other", requiresRecord: true, children: [{ id: "resource-detail-view", label: "Resource detail view", audience: "other", requiresRecord: true, action: "view" }] },
      { id: "share-other", label: "Share", audience: "other", requiresRecord: true, children: [{ id: "share-menu-send-organization", label: "Share menu / send to another organization", audience: "other", requiresRecord: true, action: "share" }] },
      { id: "save-other", label: "Save", audience: "other", requiresRecord: true, children: [{ id: "save-follow-action", label: "Save / follow action", audience: "other", requiresRecord: true, action: "save-follow" }] },
    ],
  },
  {
    id: "cross-lens-referral", label: "Cross-lens Referral Workflow", audience: "any", children: [
      { id: "refer-from-resource", label: "Refer from resource result or detail", audience: "any", requiresRecord: true, action: "referral", children: [
        { id: "referral-modal", label: "Referral modal", audience: "any", requiresRecord: true, action: "referral", children: [
          { id: "recipient-policy-fee", label: "Recipient referral policy / fee", audience: "any", requiresRecord: true, action: "referral", children: [
            { id: "track-referrals-management", label: "Track in Menu → Referrals Management", audience: "any", action: "open-referrals-management" },
          ] },
        ] },
      ] },
    ],
  },
];

function childrenAtPath(path: string[]) {
  let children = resourceNavigationTree;
  for (const id of path) {
    const node = children.find((candidate) => candidate.id === id);
    if (!node) return resourceNavigationTree;
    children = node.children ?? [];
  }
  return children;
}

export function resourceNavigationChildren(state: ResourceNavigationState) { return childrenAtPath(state.path); }
export function resourceNavigationTrail(state: ResourceNavigationState) {
  const trail: ResourceNavigationNode[] = [];
  let children = resourceNavigationTree;
  for (const id of state.path) {
    const node = children.find((candidate) => candidate.id === id);
    if (!node) break;
    trail.push(node);
    children = node.children ?? [];
  }
  return trail;
}

export function resourceNavigationEnabled(node: ResourceNavigationNode, record?: ExchangeRecord) {
  if (node.requiresRecord && (!record || record.type !== "resource")) return false;
  if (node.requiresRecord && node.audience === "own" && record && !record.ownedByViewer) return false;
  if (node.requiresRecord && node.audience === "other" && record?.ownedByViewer) return false;
  return true;
}
