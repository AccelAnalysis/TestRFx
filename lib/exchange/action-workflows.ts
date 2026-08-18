import type { ExchangeLens, LensActionOwnership } from "./contracts";
import type { SharedWorkflowId } from "./shared-workflows";

export type LensWorkflowTarget =
  | { type: "detail" }
  | { type: "domain"; domain: ExchangeLens; action: string }
  | { type: "shared"; workflow: SharedWorkflowId }
  | { type: "menu"; section: "referrals" | "saved" }
  | { type: "return" }
  | { type: "outcome" };

export interface LensWorkflowNode {
  id: string;
  label: string;
  description?: string;
  kind?: "step" | "decision" | "outcome" | "handoff";
  target?: LensWorkflowTarget;
  children?: LensWorkflowNode[];
}

export interface LensActionWorkflow {
  lens: ExchangeLens;
  ownership: LensActionOwnership;
  actionId: string;
  title: string;
  root: LensWorkflowNode;
}

const outcome = (id: string, label: string, description?: string): LensWorkflowNode => ({ id, label, description, kind: "outcome", target: { type: "outcome" } });
const shared = (id: string, label: string, workflow: SharedWorkflowId, description?: string): LensWorkflowNode => ({ id, label, description, kind: "handoff", target: { type: "shared", workflow } });
const domain = (id: string, label: string, lens: ExchangeLens, action: string, description?: string): LensWorkflowNode => ({ id, label, description, target: { type: "domain", domain: lens, action } });
const detail = (id: string, label: string): LensWorkflowNode => ({ id, label, target: { type: "detail" } });

const rfxStickyActions: LensWorkflowNode = {
  id: "rfx-sticky-actions",
  label: "Sticky RFx Actions",
  description: "The source keeps these actions available from RFx context.",
  children: [
    detail("sticky-view", "View"),
    shared("sticky-match", "Match", "match"),
    shared("sticky-refer", "Refer", "refer"),
    shared("sticky-save", "Save", "save"),
  ],
};

const rfxDecision: LensWorkflowNode = {
  id: "rfx-decision-next-step",
  label: "Decision / Next Step",
  kind: "decision",
  children: [
    domain("rfx-update", "Update", "rfx", "update"),
    domain("rfx-close", "Close", "rfx", "close"),
    domain("rfx-award", "Award / Advance", "rfx", "award-advance"),
    shared("rfx-refer-context", "Refer from context", "refer"),
  ],
};

const resourceReferral: LensWorkflowNode = {
  id: "resource-referral",
  label: "Cross-lens Referral Workflow",
  kind: "handoff",
  children: [{
    id: "resource-useful-to-other",
    label: "See a resource useful to another organization?",
    children: [{
      id: "resource-refer-from-context",
      label: "Refer from resource result or detail",
      children: [{
        id: "resource-referral-modal",
        label: "Referral modal",
        target: { type: "shared", workflow: "refer" },
        children: [{
          id: "resource-referral-policy",
          label: "Recipient referral policy / fee",
          kind: "step",
          children: [{ id: "resource-referral-track", label: "Track in Menu > Referrals Management", kind: "handoff", target: { type: "menu", section: "referrals" } }],
        }],
      }],
    }],
  }],
};

const intelligenceOutcomes: LensWorkflowNode = {
  id: "intelligence-outcomes",
  label: "Outcomes / Value",
  children: [
    outcome("intelligence-decision-support", "Decision Support", "Inform decisions with curated and comparative intelligence."),
    shared("intelligence-opportunity-capability-match", "Opportunity / Capability Matching", "match", "Discover relevant opportunities and capabilities."),
    {
      id: "intelligence-referral-trigger",
      label: "Referral Trigger (Cross-Lens)",
      kind: "handoff",
      children: [{
        id: "intelligence-create-referral",
        label: "Create Referral",
        children: [outcome("intelligence-referral-cancel", "Cancel"), shared("intelligence-referral-create", "Create Referral", "refer")],
      }],
    },
    {
      id: "intelligence-save-watch-return",
      label: "Save / Watch / Return to Exchange",
      children: [shared("intelligence-save", "Save", "save"), shared("intelligence-watch", "Watch", "track"), { id: "intelligence-return", label: "Return to Exchange", target: { type: "return" } }],
    },
  ],
};

const capabilityOwnSequence: LensWorkflowNode = {
  id: "capability-own-sequence",
  label: "Current capability profile workflow",
  children: [
    detail("capability-view-current", "View current capability profile"),
    domain("capability-manage", "Manage Capabilities", "capabilities", "manage-capabilities"),
    domain("capability-amacs", "AI → AMACS Mapping", "capabilities", "ai-amacs"),
    domain("capability-evidence", "Add / Edit Evidence", "capabilities", "capability-evidence"),
    domain("capability-gaps", "Identify Capability Gaps", "capabilities", "capability-gaps"),
    domain("capability-publish", "Save / Publish updates", "capabilities", "publish-updates"),
    outcome("capability-available", "Capability profile available in Exchange"),
  ],
};

const capabilityOtherDecision: LensWorkflowNode = {
  id: "capability-decide-next",
  label: "Decide next action",
  kind: "decision",
  children: [
    shared("capability-refer", "Refer", "refer", "Cross-lens referral workflow"),
    shared("capability-save-follow", "Save / Follow", "follow", "Watchlist / saved organizations"),
    detail("capability-open-detail", "Open detail"),
  ],
};

const workflows: LensActionWorkflow[] = [
  {
    lens: "rfx", ownership: "own", actionId: "create-rfx", title: "Create RFx / Opportunity",
    root: { id: "rfx-create-root", label: "Create RFx / Opportunity", children: [{ id: "rfx-draft-save-publish", label: "Draft / Save / Publish", children: [domain("rfx-draft", "Draft", "rfx", "draft"), domain("rfx-save", "Save", "rfx", "save"), domain("rfx-publish", "Publish", "rfx", "publish")] }] },
  },
  {
    lens: "rfx", ownership: "own", actionId: "manage-rfx", title: "Manage RFx",
    root: { id: "rfx-manage-root", label: "Manage RFx", children: [shared("rfx-invite-collaborators", "Invite Team / Collaborators", "team"), shared("rfx-track-watch", "Track / Watch Status", "watch"), domain("rfx-responses-matches", "View Responses / Matches", "rfx", "responses-matches"), rfxDecision, rfxStickyActions] },
  },
  { lens: "rfx", ownership: "own", actionId: "invite-team", title: "Invite Team / Collaborators", root: { id: "rfx-invite-root", label: "Invite Team / Collaborators", children: [shared("rfx-invite-team", "Invite Team / Collaborators", "team")] } },
  { lens: "rfx", ownership: "own", actionId: "watch", title: "Track / Watch Status", root: { id: "rfx-own-watch-root", label: "Track / Watch Status", children: [shared("rfx-own-watch", "Track / Watch Status", "watch")] } },
  {
    lens: "rfx", ownership: "other", actionId: "view", title: "RFx opportunity workflow",
    root: { id: "rfx-other-root", label: "RFx / Opportunity", children: [detail("rfx-view-detail", "View RFx Detail"), domain("rfx-respond-submit", "Respond / Submit", "rfx", "respond-submit"), shared("rfx-team-collaborate", "Team / Join / Collaborate", "team"), shared("rfx-watch-follow", "Watch / Follow", "watch"), shared("rfx-refer-relevant", "Refer Relevant Organization", "refer"), { id: "rfx-outcome", label: "Outcome", children: [outcome("rfx-saved", "Saved"), outcome("rfx-submitted", "Submitted"), outcome("rfx-teamed", "Teamed"), outcome("rfx-referred", "Referred")] }, rfxStickyActions] },
  },
  { lens: "rfx", ownership: "other", actionId: "respond", title: "Respond / Submit", root: { id: "rfx-respond-root", label: "Respond / Submit", children: [domain("rfx-respond", "Respond / Submit", "rfx", "respond-submit")] } },
  { lens: "rfx", ownership: "other", actionId: "team", title: "Team / Join / Collaborate", root: { id: "rfx-team-root", label: "Team / Join / Collaborate", children: [shared("rfx-team", "Team / Join / Collaborate", "team")] } },
  { lens: "rfx", ownership: "other", actionId: "watch", title: "Watch / Follow", root: { id: "rfx-watch-root", label: "Watch / Follow", children: [shared("rfx-watch", "Watch / Follow", "watch"), shared("rfx-watch-refer", "Refer Relevant Organization", "refer")] } },

  { lens: "resources", ownership: "own", actionId: "offer-resource", title: "Offer Resource", root: { id: "resource-offer-root", label: "Offer Resource", children: [domain("resource-offer-modal", "Offer Resource modal", "resources", "offer"), { id: "resource-offer-visible", label: "Offered resources appear in", children: [outcome("resource-map-marker", "Map marker (if mappable)"), outcome("resource-list", "Infinite results list"), outcome("resource-detail", "Resource detail view")] }] } },
  { lens: "resources", ownership: "own", actionId: "edit-resource", title: "Edit Resource", root: { id: "resource-edit-root", label: "Edit Resource", children: [domain("resource-manage-edit", "Manage / Edit Resource", "resources", "edit")] } },
  { lens: "resources", ownership: "own", actionId: "share", title: "Share", root: { id: "resource-own-share-root", label: "Share", children: [shared("resource-share-send", "Share menu / send resource", "share")] } },
  { lens: "resources", ownership: "own", actionId: "save-archive-resource", title: "Save / Archive", root: { id: "resource-save-archive-root", label: "Save / Archive", children: [shared("resource-own-save", "Save", "save"), domain("resource-archive", "Archive", "resources", "archive")] } },
  { lens: "resources", ownership: "other", actionId: "request-resource", title: "Request Resource", root: { id: "resource-request-root", label: "Request Resource", children: [domain("resource-request-modal", "Request Resource modal", "resources", "request")] } },
  { lens: "resources", ownership: "other", actionId: "view", title: "View Resource Detail", root: { id: "resource-view-root", label: "View Resource Detail", children: [detail("resource-detail-view", "Resource detail view"), resourceReferral] } },
  { lens: "resources", ownership: "other", actionId: "share", title: "Share", root: { id: "resource-other-share-root", label: "Share", children: [shared("resource-share-other", "Share menu / send to another organization", "share")] } },
  { lens: "resources", ownership: "other", actionId: "save", title: "Save", root: { id: "resource-save-root", label: "Save", children: [shared("resource-save-follow", "Save / follow action", "save"), resourceReferral] } },

  { lens: "intelligence", ownership: "own", actionId: "add-insight", title: "Add Insight", root: { id: "intel-add-root", label: "Add Insight", children: [domain("intel-add", "Add Insight", "intelligence", "add"), outcome("intel-updated-add", "Insight record updated"), intelligenceOutcomes] } },
  { lens: "intelligence", ownership: "own", actionId: "edit-insight", title: "Edit Insight", root: { id: "intel-edit-root", label: "Edit Insight", children: [domain("intel-edit", "Edit Insight", "intelligence", "edit"), outcome("intel-updated-edit", "Insight record updated"), intelligenceOutcomes] } },
  { lens: "intelligence", ownership: "own", actionId: "compare", title: "Compare", root: { id: "intel-own-compare-root", label: "Compare", children: [domain("intel-own-compare", "Analyze patterns / compare intelligence", "intelligence", "compare"), intelligenceOutcomes] } },
  { lens: "intelligence", ownership: "own", actionId: "track", title: "Track", root: { id: "intel-track-root", label: "Track", children: [shared("intel-track", "Follow changes / watch intelligence activity", "track"), intelligenceOutcomes] } },
  { lens: "intelligence", ownership: "other", actionId: "view", title: "View Insight Detail", root: { id: "intel-view-root", label: "View Insight Detail", children: [detail("intel-review-context", "Review intelligence context"), intelligenceOutcomes] } },
  { lens: "intelligence", ownership: "other", actionId: "add-note", title: "Add Note", root: { id: "intel-note-root", label: "Add Note", children: [domain("intel-contribute-note", "Contribute note or commentary", "intelligence", "note"), intelligenceOutcomes] } },
  { lens: "intelligence", ownership: "other", actionId: "compare", title: "Compare", root: { id: "intel-other-compare-root", label: "Compare", children: [domain("intel-compare-external", "Compare external intelligence", "intelligence", "compare"), intelligenceOutcomes] } },
  { lens: "intelligence", ownership: "other", actionId: "follow-track", title: "Follow / Track", root: { id: "intel-follow-root", label: "Follow / Track", children: [shared("intel-monitor", "Monitor updates and changes", "follow"), intelligenceOutcomes] } },

  { lens: "capabilities", ownership: "own", actionId: "manage-capabilities", title: "Manage Capabilities", root: capabilityOwnSequence },
  { lens: "capabilities", ownership: "own", actionId: "ai-amacs", title: "AI → AMACS Mapping", root: { id: "cap-amacs-root", label: "AI → AMACS Mapping", children: [domain("cap-amacs-review", "AI → AMACS Mapping", "capabilities", "ai-amacs"), domain("cap-save-publish-amacs", "Save / Publish updates", "capabilities", "publish-updates"), outcome("cap-amacs-available", "Capability profile available in Exchange")] } },
  { lens: "capabilities", ownership: "own", actionId: "capability-evidence", title: "Add / Edit Evidence", root: { id: "cap-evidence-root", label: "Add / Edit Evidence", children: [domain("cap-evidence-edit", "Add / Edit Evidence", "capabilities", "capability-evidence"), domain("cap-save-publish-evidence", "Save / Publish updates", "capabilities", "publish-updates"), outcome("cap-evidence-available", "Capability profile available in Exchange")] } },
  { lens: "capabilities", ownership: "own", actionId: "capability-gaps", title: "Identify Capability Gaps", root: { id: "cap-gaps-root", label: "Identify Capability Gaps", children: [domain("cap-gap-view", "Identify Capability Gaps", "capabilities", "capability-gaps"), domain("cap-save-publish-gaps", "Save / Publish updates", "capabilities", "publish-updates"), outcome("cap-gaps-available", "Capability profile available in Exchange")] } },
  { lens: "capabilities", ownership: "other", actionId: "view", title: "View Capabilities", root: { id: "cap-other-view-root", label: "Other Organization View", children: [detail("cap-view", "View Capabilities"), domain("cap-match", "Match to RFx / requirement", "capabilities", "match-rfx"), capabilityOtherDecision] } },
  { lens: "capabilities", ownership: "other", actionId: "match-rfx", title: "Match to RFx / requirement", root: { id: "cap-match-root", label: "Match to RFx / requirement", children: [domain("cap-match-rfx", "Match to RFx / requirement", "capabilities", "match-rfx"), capabilityOtherDecision] } },
  { lens: "capabilities", ownership: "other", actionId: "refer", title: "Refer", root: { id: "cap-refer-root", label: "Refer", children: [shared("cap-refer-shared", "Cross-lens referral workflow", "refer")] } },
  { lens: "capabilities", ownership: "other", actionId: "follow", title: "Save / Follow", root: { id: "cap-follow-root", label: "Save / Follow", children: [shared("cap-watchlist", "Watchlist / saved organizations", "follow"), capabilityOtherDecision] } },
];

const workflowKey = (lens: ExchangeLens, ownership: LensActionOwnership, actionId: string) => `${lens}:${ownership}:${actionId}`;
const workflowByKey = new Map(workflows.map((workflow) => [workflowKey(workflow.lens, workflow.ownership, workflow.actionId), workflow]));

export function getLensActionWorkflow(lens: ExchangeLens, ownership: LensActionOwnership, actionId: string) {
  return workflowByKey.get(workflowKey(lens, ownership, actionId));
}

export function findWorkflowNode(root: LensWorkflowNode, path: string[]) {
  let current = root;
  for (const id of path) {
    const next = current.children?.find((child) => child.id === id);
    if (!next) return undefined;
    current = next;
  }
  return current;
}

export function workflowBreadcrumbs(root: LensWorkflowNode, path: string[]) {
  const nodes = [root];
  let current = root;
  for (const id of path) {
    const next = current.children?.find((child) => child.id === id);
    if (!next) break;
    nodes.push(next);
    current = next;
  }
  return nodes;
}
