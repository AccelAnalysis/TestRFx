import type { ExchangeLens, ExchangeRecord, LensAction, LensActionOwnership, LensActionToggle, LensActionTrigger } from "./contracts";
type ActionSpec = { id: string; label: string; icon: string; trigger: LensActionTrigger; operational?: boolean; unavailableReason?: string; requiresRecord?: boolean; toggle?: LensActionToggle; };
const registry: Record<ExchangeLens, { own: ActionSpec[]; other: ActionSpec[] }> = {
  rfx: { own: [
    { id: "create-rfx", label: "Create RFx", icon: "+", trigger: "workflow" },
    { id: "manage-rfx", label: "Manage RFx", icon: "✎", trigger: "workflow", requiresRecord: true },
    { id: "invite-team", label: "Invite Team", icon: "◎", trigger: "workflow", requiresRecord: true },
    { id: "watch", label: "Track", icon: "☆", trigger: "direct", requiresRecord: true, toggle: "watch" },
  ], other: [
    { id: "view", label: "View Detail", icon: "◉", trigger: "detail", requiresRecord: true },
    { id: "respond", label: "Respond", icon: "↵", trigger: "workflow", requiresRecord: true },
    { id: "team", label: "Team", icon: "◎", trigger: "workflow", requiresRecord: true },
    { id: "watch", label: "Watch", icon: "☆", trigger: "direct", requiresRecord: true, toggle: "watch" },
  ]},
  resources: { own: [
    { id: "offer-resource", label: "Offer", icon: "+", trigger: "modal" }, { id: "edit-resource", label: "Edit", icon: "✎", trigger: "modal", requiresRecord: true }, { id: "share", label: "Share", icon: "↗", trigger: "direct", requiresRecord: true }, { id: "archive-resource", label: "Archive", icon: "▣", trigger: "workflow", requiresRecord: true },
  ], other: [
    { id: "request-resource", label: "Request", icon: "+", trigger: "modal", requiresRecord: true }, { id: "view", label: "View Detail", icon: "◉", trigger: "detail", requiresRecord: true }, { id: "share", label: "Share", icon: "↗", trigger: "direct", requiresRecord: true }, { id: "save", label: "Save", icon: "☆", trigger: "direct", requiresRecord: true, toggle: "save" },
  ]},
  intelligence: { own: [
    { id: "add-insight", label: "Add Insight", icon: "+", trigger: "modal" }, { id: "edit-insight", label: "Edit Insight", icon: "✎", trigger: "modal", requiresRecord: true }, { id: "compare", label: "Compare", icon: "⇄", trigger: "workflow", requiresRecord: true }, { id: "track", label: "Track", icon: "☆", trigger: "direct", requiresRecord: true, toggle: "track" },
  ], other: [
    { id: "view", label: "View Detail", icon: "◉", trigger: "detail", requiresRecord: true }, { id: "add-note", label: "Add Note", icon: "◌", trigger: "modal", requiresRecord: true }, { id: "compare", label: "Compare", icon: "⇄", trigger: "workflow", requiresRecord: true }, { id: "follow-track", label: "Follow / Track", icon: "☆", trigger: "direct", requiresRecord: true, toggle: "follow" },
  ]},
  capabilities: { own: [
    { id: "manage-capabilities", label: "Manage Capabilities", icon: "✎", trigger: "workflow", requiresRecord: true },
    { id: "ai-amacs", label: "AI → AMACS", icon: "✦", trigger: "workflow", requiresRecord: true },
    { id: "capability-evidence", label: "Add / Edit Evidence", icon: "✓", trigger: "workflow", requiresRecord: true },
    { id: "capability-gaps", label: "Capability Gaps", icon: "▥", trigger: "workflow", requiresRecord: true },
  ], other: [
    { id: "view", label: "View Capabilities", icon: "◉", trigger: "detail", requiresRecord: true },
    { id: "match-rfx", label: "Match to RFx", icon: "◇", trigger: "workflow", requiresRecord: true },
    { id: "refer", label: "Refer", icon: "↗", trigger: "workflow", requiresRecord: true },
    { id: "follow", label: "Save / Follow", icon: "☆", trigger: "direct", requiresRecord: true, toggle: "follow" },
  ]},
};
function toAction(spec: ActionSpec, position: 1 | 2 | 3 | 4, ownership: LensActionOwnership, record?: ExchangeRecord): LensAction { const applicable = spec.requiresRecord ? Boolean(record) : true; return { id: spec.id, position, label: spec.label, icon: spec.icon, trigger: spec.trigger, ownership, visible: true, applicable, authorized: true, operational: spec.operational ?? true, prerequisitesSatisfied: true, requiresRecord: spec.requiresRecord, toggle: spec.toggle, unavailableReason: !applicable ? "Select a record to use this action." : spec.unavailableReason }; }
export function resolveLensActions(lens: ExchangeLens, record?: ExchangeRecord): LensAction[] { const ownership: LensActionOwnership = record?.ownedByViewer ? "own" : "other"; const specs = registry[lens][ownership === "own" ? "own" : "other"]; const actions = specs.map((spec, index) => toAction(spec, (index + 1) as 1 | 2 | 3 | 4, ownership, record)); if (actions.length !== 4 || new Set(actions.map((item) => item.position)).size !== 4) throw new Error(`Lens ${lens} must resolve exactly four governed action positions.`); return actions; }
export function isLensActionEnabled(action: LensAction) { return action.visible && action.operational && action.applicable && action.authorized && action.prerequisitesSatisfied; }
export function getLensActionUnavailableReason(action: LensAction) { if (!action.visible) return "This action is hidden in the current context."; if (!action.operational) return action.unavailableReason ?? "This workflow is not operational yet."; if (!action.applicable) return action.unavailableReason ?? "This action does not apply to the current selection."; if (!action.authorized) return action.unavailableReason ?? "Your current organization role is not authorized for this action."; if (!action.prerequisitesSatisfied) return action.unavailableReason ?? "Complete the required prerequisite before using this action."; return undefined; }
