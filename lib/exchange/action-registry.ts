import type { ExchangeLens, ExchangeRecord, LensAction, LensActionOwnership, LensActionToggle, LensActionTrigger } from "./contracts";

type ActionSpec = { id: string; label: string; icon: string; trigger: LensActionTrigger; operational?: boolean; unavailableReason?: string; requiresRecord?: boolean; toggle?: LensActionToggle; };
function spec(id: string, label: string, icon: string, trigger: LensActionTrigger, options: Omit<ActionSpec, "id" | "label" | "icon" | "trigger"> = {}): ActionSpec { return { id, label, icon, trigger, ...options }; }

const registry: Record<ExchangeLens, { own: ActionSpec[]; other: ActionSpec[] }> = {
  rfx: {
    own: [
      spec("create-rfx", "Create RFx", "+", "modal"),
      spec("manage-rfx", "Manage", "✎", "menu", { requiresRecord: true }),
      spec("invite-team", "Invite Team", "◎", "modal", { requiresRecord: true }),
      spec("watch", "Watch", "☆", "direct", { requiresRecord: true, toggle: "watch" }),
    ],
    other: [
      spec("view", "View Detail", "◉", "menu", { requiresRecord: true }),
      spec("respond", "Respond", "↵", "modal", { requiresRecord: true }),
      spec("team", "Team", "◎", "menu", { requiresRecord: true }),
      spec("watch", "Watch", "☆", "direct", { requiresRecord: true, toggle: "watch" }),
    ],
  },
  resources: {
    own: [
      spec("offer-resource", "Offer", "+", "modal"),
      spec("edit-resource", "Edit", "✎", "menu", { requiresRecord: true }),
      spec("share", "Share", "↗", "direct", { requiresRecord: true }),
      spec("archive-resource", "Save / Archive", "▣", "direct", { requiresRecord: true }),
    ],
    other: [
      spec("request-resource", "Request", "+", "modal", { requiresRecord: true }),
      spec("view", "View Detail", "◉", "menu", { requiresRecord: true }),
      spec("share", "Share", "↗", "direct", { requiresRecord: true }),
      spec("save", "Save", "☆", "direct", { requiresRecord: true, toggle: "save" }),
    ],
  },
  intelligence: {
    own: [
      spec("add-insight", "Add Insight", "+", "modal"),
      spec("edit-insight", "Edit Insight", "✎", "menu", { requiresRecord: true }),
      spec("compare", "Compare", "⇄", "modal", { requiresRecord: true }),
      spec("track", "Track", "☆", "direct", { requiresRecord: true, toggle: "track" }),
    ],
    other: [
      spec("view", "View Detail", "◉", "menu", { requiresRecord: true }),
      spec("add-note", "Add Note", "◌", "modal", { requiresRecord: true }),
      spec("compare", "Compare", "⇄", "modal", { requiresRecord: true }),
      spec("follow-track", "Follow / Track", "☆", "direct", { requiresRecord: true, toggle: "follow" }),
    ],
  },
  capabilities: {
    own: [
      spec("manage-capabilities", "Manage Capabilities", "✎", "menu", { requiresRecord: true }),
      spec("ai-amacs", "AI → AMACS", "✦", "modal", { requiresRecord: true }),
      spec("capability-evidence", "Add / Edit Evidence", "✓", "modal", { requiresRecord: true }),
      spec("capability-gaps", "Capability Gaps", "▥", "direct", { requiresRecord: true }),
    ],
    other: [
      spec("view", "View Capabilities", "◉", "menu", { requiresRecord: true }),
      spec("match-rfx", "Match to RFx", "◇", "modal", { requiresRecord: true }),
      spec("refer", "Refer", "↗", "direct", { requiresRecord: true }),
      spec("follow", "Save / Follow", "☆", "direct", { requiresRecord: true, toggle: "follow" }),
    ],
  },
};

function toAction(specification: ActionSpec, position: 1 | 2 | 3 | 4, ownership: LensActionOwnership, record?: ExchangeRecord): LensAction {
  const applicable = specification.requiresRecord ? Boolean(record) : true;
  return {
    id: specification.id,
    position,
    label: specification.label,
    icon: specification.icon,
    trigger: specification.trigger,
    ownership,
    visible: true,
    applicable,
    authorized: true,
    operational: specification.operational ?? true,
    prerequisitesSatisfied: true,
    requiresRecord: specification.requiresRecord,
    toggle: specification.toggle,
    unavailableReason: !applicable ? "Select a record to use this action." : specification.unavailableReason,
  };
}

export function resolveLensActions(lens: ExchangeLens, record?: ExchangeRecord): LensAction[] {
  const ownership: LensActionOwnership = record?.ownedByViewer ? "own" : "other";
  const specifications = registry[lens][ownership === "own" ? "own" : "other"];
  const actions = specifications.map((item, index) => toAction(item, (index + 1) as 1 | 2 | 3 | 4, ownership, record));
  if (actions.length !== 4 || new Set(actions.map((item) => item.position)).size !== 4) throw new Error(`Lens ${lens} must resolve exactly four governed action positions.`);
  return actions;
}

export function isLensActionEnabled(action: LensAction) {
  return action.visible && action.operational && action.applicable && action.authorized && action.prerequisitesSatisfied;
}

export function getLensActionUnavailableReason(action: LensAction) {
  if (!action.visible) return "This action is hidden in the current context.";
  if (!action.operational) return action.unavailableReason ?? "This workflow is not operational yet.";
  if (!action.applicable) return action.unavailableReason ?? "This action does not apply to the current selection.";
  if (!action.authorized) return action.unavailableReason ?? "Your current organization role is not authorized for this action.";
  if (!action.prerequisitesSatisfied) return action.unavailableReason ?? "Complete the required prerequisite before using this action.";
  return undefined;
}
