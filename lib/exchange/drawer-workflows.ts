import type { ExchangeLens, LensActionOwnership } from "./contracts";
import type { SharedWorkflowId } from "./shared-workflows";
import type { IntelligenceWorkflow } from "./intelligence";
import type { CapabilityWorkflowMode } from "@/lib/capabilities/actions";

export type DrawerWorkflowNodeKind = "menu" | "modal" | "action" | "detail" | "decision" | "outcome" | "handoff";
export type RfxWorkflowCommand = "create" | "draft" | "save" | "publish" | "manage" | "invite" | "responses" | "update" | "close" | "award-advance" | "respond" | "submit";
export type ResourceWorkflowCommand = "offer" | "edit" | "request" | "archive";

export type DrawerWorkflowExecution =
  | { kind: "detail" }
  | { kind: "shared"; workflow: SharedWorkflowId }
  | { kind: "rfx"; workflow: RfxWorkflowCommand }
  | { kind: "resource"; workflow: ResourceWorkflowCommand }
  | { kind: "intelligence"; workflow: IntelligenceWorkflow }
  | { kind: "capability"; workflow: CapabilityWorkflowMode }
  | { kind: "menu"; destination: "referrals" }
  | { kind: "outcome" };

export interface DrawerWorkflowNode {
  id: string;
  label: string;
  kind: DrawerWorkflowNodeKind;
  description?: string;
  execution?: DrawerWorkflowExecution;
  children?: DrawerWorkflowNode[];
}

type ActionTree = Record<string, DrawerWorkflowNode>;
type OwnershipTree = Partial<Record<LensActionOwnership, ActionTree>>;

const outcomes = (...labels: string[]): DrawerWorkflowNode[] => labels.map((label) => ({ id: `outcome-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, label, kind: "outcome", execution: { kind: "outcome" } }));

const referralBranch = (id: string, label: string): DrawerWorkflowNode => ({
  id,
  label,
  kind: "handoff",
  description: "Cross-lens referral workflow from the source record context.",
  children: [
    { id: `${id}-compose`, label: "Referral modal", kind: "modal", execution: { kind: "shared", workflow: "refer" } },
    { id: `${id}-policy`, label: "Recipient referral policy / fee", kind: "menu", description: "Review the recipient organization's configured referral policy and fee; no fee is invented when none is configured." },
    { id: `${id}-track`, label: "Track in Menu > Referrals Management", kind: "handoff", execution: { kind: "menu", destination: "referrals" } },
  ],
});

const rfxOwn: ActionTree = {
  "create-rfx": {
    id: "rfx-create",
    label: "Create RFx / Opportunity",
    kind: "modal",
    execution: { kind: "rfx", workflow: "create" },
    children: [
      { id: "rfx-create-draft", label: "Draft", kind: "modal", execution: { kind: "rfx", workflow: "draft" } },
      { id: "rfx-create-save", label: "Save", kind: "action", execution: { kind: "rfx", workflow: "save" } },
      { id: "rfx-create-publish", label: "Publish", kind: "action", execution: { kind: "rfx", workflow: "publish" } },
    ],
  },
  "manage-rfx": {
    id: "rfx-manage",
    label: "Manage RFx",
    kind: "menu",
    execution: { kind: "rfx", workflow: "manage" },
    children: [
      { id: "rfx-manage-invite", label: "Invite Team / Collaborators", kind: "modal", execution: { kind: "rfx", workflow: "invite" } },
      { id: "rfx-manage-track", label: "Track / Watch Status", kind: "action", execution: { kind: "shared", workflow: "watch" } },
      { id: "rfx-manage-responses", label: "View Responses / Matches", kind: "menu", execution: { kind: "rfx", workflow: "responses" } },
      {
        id: "rfx-manage-decision",
        label: "Decision / Next Step",
        kind: "decision",
        children: [
          { id: "rfx-decision-update", label: "Update", kind: "action", execution: { kind: "rfx", workflow: "update" } },
          { id: "rfx-decision-close", label: "Close", kind: "action", execution: { kind: "rfx", workflow: "close" } },
          { id: "rfx-decision-award", label: "Award / Advance", kind: "action", execution: { kind: "rfx", workflow: "award-advance" } },
          referralBranch("rfx-decision-refer", "Refer from Context"),
        ],
      },
    ],
  },
  "invite-team": { id: "rfx-invite", label: "Invite Team / Collaborators", kind: "modal", execution: { kind: "rfx", workflow: "invite" } },
  watch: { id: "rfx-track", label: "Track / Watch Status", kind: "action", execution: { kind: "shared", workflow: "watch" } },
};

const rfxOther: ActionTree = {
  view: {
    id: "rfx-view",
    label: "View RFx Detail",
    kind: "menu",
    execution: { kind: "detail" },
    children: [
      { id: "rfx-view-respond", label: "Respond / Submit", kind: "modal", children: [
        { id: "rfx-response-draft", label: "Draft response", kind: "modal", execution: { kind: "rfx", workflow: "respond" } },
        { id: "rfx-response-submit", label: "Submit", kind: "action", execution: { kind: "rfx", workflow: "submit" } },
      ] },
      { id: "rfx-view-team", label: "Team / Join / Collaborate", kind: "menu", execution: { kind: "shared", workflow: "team" } },
      { id: "rfx-view-watch", label: "Watch / Follow", kind: "action", execution: { kind: "shared", workflow: "watch" } },
      referralBranch("rfx-view-refer", "Refer Relevant Organization"),
      { id: "rfx-view-outcome", label: "Outcome", kind: "outcome", children: outcomes("Saved", "Submitted", "Teamed", "Referred") },
    ],
  },
  respond: { id: "rfx-respond", label: "Respond / Submit", kind: "modal", execution: { kind: "rfx", workflow: "respond" }, children: [
    { id: "rfx-respond-submit", label: "Submit", kind: "action", execution: { kind: "rfx", workflow: "submit" } },
  ] },
  team: { id: "rfx-team", label: "Team / Join / Collaborate", kind: "menu", execution: { kind: "shared", workflow: "team" } },
  watch: { id: "rfx-watch", label: "Watch / Follow", kind: "action", execution: { kind: "shared", workflow: "watch" } },
};

const resourcesOwn: ActionTree = {
  "offer-resource": { id: "resource-offer", label: "Offer Resource", kind: "modal", execution: { kind: "resource", workflow: "offer" }, children: [
    { id: "resource-offer-visible", label: "Visible in list / map", kind: "outcome", execution: { kind: "outcome" } },
    { id: "resource-offer-detail", label: "Resource detail view", kind: "detail", execution: { kind: "detail" } },
  ] },
  "edit-resource": { id: "resource-edit", label: "Manage / Edit Resource", kind: "menu", execution: { kind: "resource", workflow: "edit" } },
  share: { id: "resource-share", label: "Share / Send Resource", kind: "action", execution: { kind: "shared", workflow: "share" } },
  "archive-resource": { id: "resource-save-archive", label: "Save / Archive", kind: "action", children: [
    { id: "resource-save", label: "Save", kind: "action", execution: { kind: "shared", workflow: "save" } },
    { id: "resource-archive", label: "Archive", kind: "action", execution: { kind: "resource", workflow: "archive" } },
  ] },
};

const resourcesOther: ActionTree = {
  "request-resource": { id: "resource-request", label: "Request Resource", kind: "modal", execution: { kind: "resource", workflow: "request" }, children: [
    { id: "resource-request-connected", label: "Requested / connected", kind: "outcome", execution: { kind: "outcome" } },
  ] },
  view: { id: "resource-view", label: "View Resource Detail", kind: "menu", execution: { kind: "detail" }, children: [referralBranch("resource-refer", "Refer from resource result or detail")] },
  share: { id: "resource-share-other", label: "Share / Send to another organization", kind: "action", execution: { kind: "shared", workflow: "share" } },
  save: { id: "resource-save-other", label: "Save / Follow", kind: "action", execution: { kind: "shared", workflow: "save" } },
};

const intelligenceOwn: ActionTree = {
  "add-insight": { id: "intel-add", label: "Add Insight", kind: "modal", execution: { kind: "intelligence", workflow: "add" }, children: [{ id: "intel-add-updated", label: "Insight record updated", kind: "outcome", execution: { kind: "outcome" } }] },
  "edit-insight": { id: "intel-edit", label: "Edit Insight", kind: "menu", execution: { kind: "intelligence", workflow: "edit" }, children: [{ id: "intel-edit-updated", label: "Insight record updated", kind: "outcome", execution: { kind: "outcome" } }] },
  compare: { id: "intel-compare", label: "Compare", kind: "modal", execution: { kind: "intelligence", workflow: "compare" }, children: [
    { id: "intel-compare-analysis", label: "Analyze patterns / compare intelligence", kind: "outcome", execution: { kind: "outcome" } },
    referralBranch("intel-referral-trigger", "Referral Trigger (Cross-Lens)"),
  ] },
  track: { id: "intel-track", label: "Track", kind: "action", execution: { kind: "shared", workflow: "track" }, children: [{ id: "intel-track-outcome", label: "Follow changes / watch intelligence activity", kind: "outcome", execution: { kind: "outcome" } }] },
};

const intelligenceOther: ActionTree = {
  view: { id: "intel-view", label: "View Insight Detail", kind: "menu", execution: { kind: "detail" }, children: [
    { id: "intel-review-context", label: "Review intelligence context", kind: "outcome", execution: { kind: "outcome" } },
    referralBranch("intel-view-referral", "Referral Trigger (Cross-Lens)"),
  ] },
  "add-note": { id: "intel-note", label: "Add Note", kind: "modal", execution: { kind: "intelligence", workflow: "note" }, children: [{ id: "intel-note-outcome", label: "Contribute note or commentary", kind: "outcome", execution: { kind: "outcome" } }] },
  compare: { id: "intel-compare-other", label: "Compare", kind: "modal", execution: { kind: "intelligence", workflow: "compare" }, children: [
    { id: "intel-compare-external", label: "Compare external intelligence", kind: "outcome", execution: { kind: "outcome" } },
    referralBranch("intel-compare-referral", "Referral Trigger (Cross-Lens)"),
  ] },
  "follow-track": { id: "intel-follow", label: "Follow / Track", kind: "action", execution: { kind: "shared", workflow: "follow" }, children: [{ id: "intel-monitor", label: "Monitor updates and changes", kind: "outcome", execution: { kind: "outcome" } }] },
};

const capabilitiesOwn: ActionTree = {
  "manage-capabilities": { id: "cap-manage", label: "Manage Capabilities", kind: "menu", execution: { kind: "capability", workflow: "manage-capabilities" }, children: [
    { id: "cap-manage-amacs", label: "AI → AMACS Mapping", kind: "modal", execution: { kind: "capability", workflow: "ai-amacs" } },
    { id: "cap-manage-evidence", label: "Add / Edit Evidence", kind: "modal", execution: { kind: "capability", workflow: "capability-evidence" } },
    { id: "cap-manage-gaps", label: "Identify Capability Gaps", kind: "action", execution: { kind: "capability", workflow: "capability-gaps" } },
    { id: "cap-manage-publish", label: "Save / Publish updates", kind: "action", description: "The source requires publication after capability management; execution remains owned by the canonical capability service." },
  ] },
  "ai-amacs": { id: "cap-amacs", label: "AI → AMACS Mapping", kind: "modal", execution: { kind: "capability", workflow: "ai-amacs" } },
  "capability-evidence": { id: "cap-evidence", label: "Add / Edit Evidence", kind: "modal", execution: { kind: "capability", workflow: "capability-evidence" } },
  "capability-gaps": { id: "cap-gaps", label: "Capability Gaps", kind: "action", execution: { kind: "capability", workflow: "capability-gaps" } },
};

const capabilitiesOther: ActionTree = {
  view: { id: "cap-view", label: "View Capabilities", kind: "menu", execution: { kind: "detail" }, children: [
    { id: "cap-view-evidence", label: "Capability detail / supporting evidence", kind: "detail", execution: { kind: "detail" } },
  ] },
  "match-rfx": { id: "cap-match", label: "Match to RFx / requirement", kind: "modal", execution: { kind: "capability", workflow: "match-rfx" } },
  refer: { id: "cap-refer", label: "Refer", kind: "action", execution: { kind: "shared", workflow: "refer" }, children: [
    { id: "cap-refer-handoff", label: "Cross-lens referral workflow", kind: "handoff", execution: { kind: "shared", workflow: "refer" } },
  ] },
  follow: { id: "cap-follow", label: "Save / Follow", kind: "action", execution: { kind: "shared", workflow: "follow" }, children: [{ id: "cap-watchlist", label: "Watchlist / saved organizations", kind: "outcome", execution: { kind: "outcome" } }] },
};

const trees: Record<ExchangeLens, OwnershipTree> = {
  rfx: { own: rfxOwn, other: rfxOther },
  resources: { own: resourcesOwn, other: resourcesOther },
  intelligence: { own: intelligenceOwn, other: intelligenceOther },
  capabilities: { own: capabilitiesOwn, other: capabilitiesOther },
};

export function getDrawerWorkflowRoot(lens: ExchangeLens, ownership: LensActionOwnership, actionId: string) {
  const branch = trees[lens][ownership] ?? trees[lens].other;
  return branch?.[actionId];
}

export function drawerWorkflowPath(root: DrawerWorkflowNode, ids: string[]) {
  const path = [root];
  let current = root;
  for (const id of ids) {
    const child = current.children?.find((item) => item.id === id);
    if (!child) break;
    path.push(child);
    current = child;
  }
  return path;
}
