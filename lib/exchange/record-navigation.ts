import type { ExchangeRecord, ExchangeRecordType } from "./contracts";

export type RecordNavigationKind = "workflow" | "decision" | "outcome" | "handoff";
export type RecordServiceId = "relationships" | "sharing" | "referrals" | "collaboration" | "rfx" | "resources" | "intelligence" | "capabilities" | "amacs" | "matching";

export interface RecordNavigationNode {
  id: string;
  label: string;
  kind: RecordNavigationKind;
  description?: string;
  actionId?: string;
  service?: RecordServiceId;
  command?: string;
  children?: RecordNavigationNode[];
}

export interface RecordNavigationTree {
  recordType: ExchangeRecordType;
  ownership: "own" | "other";
  children: RecordNavigationNode[];
}

const rfxOwn: RecordNavigationNode[] = [
  { id: "create-rfx", label: "Create RFx / Opportunity", kind: "workflow", service: "rfx", command: "create-rfx", children: [
    { id: "draft-save-publish", label: "Draft / Save / Publish", kind: "workflow", service: "rfx", command: "draft-save-publish" },
  ] },
  { id: "manage-rfx", label: "Manage RFx", kind: "workflow", actionId: "manage-rfx", service: "rfx", children: [
    { id: "invite-team", label: "Invite Team / Collaborators", kind: "workflow", actionId: "invite-team", service: "collaboration", command: "invite-team" },
    { id: "track-watch-status", label: "Track / Watch Status", kind: "workflow", actionId: "watch", service: "relationships", command: "watch" },
    { id: "view-responses-matches", label: "View Responses / Matches", kind: "workflow", service: "rfx", command: "view-responses-matches", children: [
      { id: "decision-next-step", label: "Decision / Next Step", kind: "decision", service: "rfx", children: [
        { id: "update", label: "Update", kind: "workflow", service: "rfx", command: "update-rfx" },
        { id: "close", label: "Close", kind: "workflow", service: "rfx", command: "close-rfx" },
        { id: "award-advance", label: "Award / Advance", kind: "workflow", service: "rfx", command: "award-advance" },
        { id: "refer-from-context", label: "Refer from context", kind: "handoff", actionId: "refer", service: "referrals", command: "refer" },
      ] },
    ] },
  ] },
];

const rfxOther: RecordNavigationNode[] = [
  { id: "view-rfx-detail", label: "View RFx Detail", kind: "workflow", actionId: "view", service: "rfx" },
  { id: "respond-submit", label: "Respond / Submit", kind: "workflow", actionId: "respond", service: "rfx", command: "respond" },
  { id: "team-join-collaborate", label: "Team / Join / Collaborate", kind: "workflow", actionId: "team", service: "collaboration", command: "team" },
  { id: "watch-follow", label: "Watch / Follow", kind: "workflow", actionId: "watch", service: "relationships", command: "watch" },
  { id: "refer-relevant-organization", label: "Refer Relevant Organization", kind: "handoff", actionId: "refer", service: "referrals", command: "refer" },
  { id: "outcomes", label: "Outcomes", kind: "outcome", children: [
    { id: "saved", label: "Saved", kind: "outcome" },
    { id: "submitted", label: "Submitted", kind: "outcome" },
    { id: "teamed", label: "Teamed", kind: "outcome" },
    { id: "referred", label: "Referred", kind: "outcome" },
  ] },
];

const resourcesOwn: RecordNavigationNode[] = [
  { id: "offer-resource", label: "Offer Resource", kind: "workflow", actionId: "offer-resource", service: "resources", command: "offer-resource", children: [
    { id: "offer-resource-modal", label: "Offer Resource modal", kind: "workflow", service: "resources", command: "offer-resource" },
  ] },
  { id: "edit-resource", label: "Edit Resource", kind: "workflow", actionId: "edit-resource", service: "resources", command: "edit-resource", children: [
    { id: "manage-edit-resource", label: "Manage / Edit Resource", kind: "workflow", service: "resources", command: "edit-resource" },
  ] },
  { id: "share-resource", label: "Share", kind: "workflow", actionId: "share", service: "sharing", command: "share", children: [
    { id: "share-send-resource", label: "Share / send resource", kind: "workflow", service: "sharing", command: "share" },
  ] },
  { id: "save-archive", label: "Save / Archive", kind: "workflow", service: "resources", children: [
    { id: "save-or-archive", label: "Save or Archive action", kind: "workflow", actionId: "archive-resource", service: "resources", command: "archive-resource" },
  ] },
];

const resourcesOther: RecordNavigationNode[] = [
  { id: "request-resource", label: "Request Resource", kind: "workflow", actionId: "request-resource", service: "resources", command: "request-resource", children: [
    { id: "request-resource-modal", label: "Request Resource modal", kind: "workflow", service: "resources", command: "request-resource" },
  ] },
  { id: "view-resource-detail", label: "View Resource Detail", kind: "workflow", actionId: "view", service: "resources" },
  { id: "share-resource", label: "Share", kind: "workflow", actionId: "share", service: "sharing", command: "share", children: [
    { id: "share-send-another-org", label: "Share / send to another organization", kind: "workflow", service: "sharing", command: "share" },
  ] },
  { id: "save-resource", label: "Save", kind: "workflow", actionId: "save", service: "relationships", command: "save", children: [
    { id: "save-follow", label: "Save / follow", kind: "workflow", service: "relationships", command: "save" },
  ] },
  { id: "refer-resource", label: "Refer from resource result or detail", kind: "handoff", service: "referrals", command: "refer", children: [
    { id: "referral-modal", label: "Referral modal", kind: "workflow", service: "referrals", command: "refer", children: [
      { id: "recipient-policy-fee", label: "Recipient referral policy / fee", kind: "workflow", service: "referrals", command: "referral-policy", children: [
        { id: "track-referral", label: "Track in Menu > Referrals Management", kind: "handoff", service: "referrals", command: "track-referral" },
      ] },
    ] },
  ] },
  { id: "resource-lifecycle", label: "Lifecycle", kind: "outcome", children: [
    { id: "created-offered", label: "Create / Offer", kind: "outcome" },
    { id: "visible-list-map", label: "Visible in list / map", kind: "outcome" },
    { id: "viewed-saved-shared", label: "Viewed / saved / shared", kind: "outcome" },
    { id: "requested-connected", label: "Requested / connected", kind: "outcome" },
    { id: "archived-retained", label: "Archived / retained", kind: "outcome" },
  ] },
];

const intelligenceOwn: RecordNavigationNode[] = [
  { id: "add-insight", label: "Add Insight", kind: "workflow", actionId: "add-insight", service: "intelligence", command: "add-insight", children: [
    { id: "insight-record-updated-add", label: "Insight record updated", kind: "outcome" },
  ] },
  { id: "edit-insight", label: "Edit Insight", kind: "workflow", actionId: "edit-insight", service: "intelligence", command: "edit-insight", children: [
    { id: "insight-record-updated-edit", label: "Insight record updated", kind: "outcome" },
  ] },
  { id: "compare", label: "Compare", kind: "workflow", actionId: "compare", service: "intelligence", command: "compare", children: [
    { id: "analyze-patterns-compare", label: "Analyze patterns / compare intelligence", kind: "workflow", service: "intelligence", command: "compare" },
  ] },
  { id: "track", label: "Track", kind: "workflow", actionId: "track", service: "relationships", command: "track", children: [
    { id: "follow-changes", label: "Follow changes / watch intelligence activity", kind: "workflow", service: "relationships", command: "track" },
  ] },
];

const intelligenceOther: RecordNavigationNode[] = [
  { id: "view-insight-detail", label: "View Insight Detail", kind: "workflow", actionId: "view", service: "intelligence", children: [
    { id: "review-intelligence-context", label: "Review intelligence context", kind: "workflow", service: "intelligence" },
  ] },
  { id: "add-note", label: "Add Note", kind: "workflow", actionId: "add-note", service: "intelligence", command: "add-note", children: [
    { id: "contribute-note", label: "Contribute note / commentary", kind: "workflow", service: "intelligence", command: "add-note" },
  ] },
  { id: "compare", label: "Compare", kind: "workflow", actionId: "compare", service: "intelligence", command: "compare", children: [
    { id: "compare-external-intelligence", label: "Compare external intelligence", kind: "workflow", service: "intelligence", command: "compare" },
  ] },
  { id: "follow-track", label: "Follow / Track", kind: "workflow", actionId: "follow-track", service: "relationships", command: "follow", children: [
    { id: "monitor-updates", label: "Monitor updates / changes", kind: "workflow", service: "relationships", command: "follow" },
  ] },
  { id: "intelligence-outcomes", label: "Outcomes", kind: "outcome", children: [
    { id: "decision-support", label: "Decision Support", kind: "outcome" },
    { id: "opportunity-capability-matching", label: "Opportunity / Capability Matching", kind: "handoff", service: "matching", command: "match" },
    { id: "referral-trigger", label: "Referral Trigger (Cross-Lens)", kind: "handoff", service: "referrals", command: "refer", children: [
      { id: "create-referral", label: "Create Referral", kind: "workflow", service: "referrals", command: "refer" },
    ] },
    { id: "save-watch-return", label: "Save / Watch / Return to Exchange", kind: "outcome" },
  ] },
];

const capabilitiesOwn: RecordNavigationNode[] = [
  { id: "view-current-capability-profile", label: "View current capability profile", kind: "workflow", service: "capabilities", children: [
    { id: "manage-capabilities", label: "Manage Capabilities", kind: "workflow", actionId: "manage-capabilities", service: "capabilities", command: "manage-capabilities", children: [
      { id: "ai-amacs", label: "AI → AMACS Mapping", kind: "workflow", actionId: "ai-amacs", service: "amacs", command: "ai-amacs" },
      { id: "add-edit-evidence", label: "Add / Edit Evidence", kind: "workflow", actionId: "capability-evidence", service: "capabilities", command: "capability-evidence" },
      { id: "identify-capability-gaps", label: "Identify Capability Gaps", kind: "workflow", actionId: "capability-gaps", service: "matching", command: "capability-gaps" },
      { id: "save-publish-updates", label: "Save / Publish updates", kind: "workflow", service: "capabilities", command: "publish-capabilities", children: [
        { id: "capability-profile-available", label: "Capability profile available in Exchange", kind: "outcome" },
      ] },
    ] },
  ] },
];

const capabilitiesOther: RecordNavigationNode[] = [
  { id: "browse-search-organizations", label: "Browse / search organizations", kind: "workflow", service: "capabilities", children: [
    { id: "view-capabilities", label: "View Capabilities", kind: "workflow", actionId: "view", service: "capabilities", children: [
      { id: "match-to-rfx", label: "Match to RFx / requirement", kind: "workflow", actionId: "match-rfx", service: "matching", command: "match-rfx", children: [
        { id: "decide-next-action", label: "Decide next action", kind: "decision", children: [
          { id: "refer", label: "Refer", kind: "handoff", actionId: "refer", service: "referrals", command: "refer" },
          { id: "save-follow", label: "Save / Follow", kind: "workflow", actionId: "follow", service: "relationships", command: "follow" },
          { id: "open-detail", label: "Open detail", kind: "workflow", service: "capabilities", children: [
            { id: "supporting-evidence", label: "Capability detail / supporting evidence", kind: "workflow", service: "capabilities" },
          ] },
        ] },
      ] },
    ] },
  ] },
];

const trees: Record<ExchangeRecordType, { own: RecordNavigationNode[]; other: RecordNavigationNode[] }> = {
  rfx: { own: rfxOwn, other: rfxOther },
  resource: { own: resourcesOwn, other: resourcesOther },
  intelligence: { own: intelligenceOwn, other: intelligenceOther },
  capability: { own: capabilitiesOwn, other: capabilitiesOther },
};

export function getRecordNavigationTree(record: ExchangeRecord): RecordNavigationTree {
  const ownership = record.ownedByViewer ? "own" : "other";
  return { recordType: record.type, ownership, children: trees[record.type][ownership] };
}

export function getNodeAtPath(tree: RecordNavigationTree, path: string[]) {
  let nodes = tree.children;
  let current: RecordNavigationNode | undefined;
  for (const id of path) {
    current = nodes.find((node) => node.id === id);
    if (!current) return undefined;
    nodes = current.children ?? [];
  }
  return current;
}

export function getChildrenAtPath(tree: RecordNavigationTree, path: string[]) {
  return path.length ? getNodeAtPath(tree, path)?.children ?? [] : tree.children;
}

export function isValidRecordNavigationPath(record: ExchangeRecord, path: string[]) {
  const tree = getRecordNavigationTree(record);
  if (!path.length) return true;
  return Boolean(getNodeAtPath(tree, path));
}
