import type {
  ExchangeLens,
  ExchangeRecord,
  ExchangeViewerContext,
  LensAction,
  LensActionOwnership,
  LensActionScope,
  LensActionToggle,
  LensActionTrigger,
} from "./contracts";

type ActionSpec = {
  id: string;
  label: string;
  icon: string;
  trigger: LensActionTrigger;
  scope: LensActionScope;
  operational?: boolean;
  unavailableReason?: string;
  requiresRecord?: boolean;
  toggle?: LensActionToggle;
};

const lens = (id: string, label: string, icon: string, trigger: LensActionTrigger = "direct"): ActionSpec => ({
  id,
  label,
  icon,
  trigger,
  scope: "lens",
});

const record = (id: string, label: string, icon: string, trigger: LensActionTrigger): ActionSpec => ({
  id,
  label,
  icon,
  trigger,
  scope: "record",
  requiresRecord: true,
});

const discoveryFallback = (savedLabel: string): ActionSpec[] => [
  lens("show-saved", savedLabel, "☆"),
  lens("show-mapped", "Mapped", "⌖"),
  lens("show-off-map", "Off-map", "◌"),
  lens("show-all", "All", "≡"),
];

function lensSpecs(activeLens: ExchangeLens, viewer: ExchangeViewerContext): ActionSpec[] {
  if (activeLens === "rfx") {
    return viewer.canIssueRfx
      ? [
          lens("create-rfx", "Create RFx", "+", "workflow"),
          lens("show-mine", "My RFx", "◉"),
          lens("show-saved", "Watched", "☆"),
          lens("show-all", "All", "≡"),
        ]
      : discoveryFallback("Watched");
  }

  if (activeLens === "resources") {
    return viewer.canOfferResources
      ? [
          lens("offer-resource", "Offer", "+", "modal"),
          lens("show-mine", "My Listings", "◉"),
          lens("show-saved", "Saved", "☆"),
          lens("show-all", "All", "≡"),
        ]
      : discoveryFallback("Saved");
  }

  if (activeLens === "intelligence") {
    return viewer.canContributeIntelligence
      ? [
          lens("add-insight", "Add Insight", "+", "modal"),
          lens("show-saved", "Tracked", "☆"),
          lens("show-mapped", "Mapped", "⌖"),
          lens("show-all", "All", "≡"),
        ]
      : discoveryFallback("Tracked");
  }

  return viewer.canManageCapabilities
    ? [
        lens("show-mine", "My Capabilities", "◉"),
        lens("manage-capability-profile", "Manage", "✎", "workflow"),
        lens("show-saved", "Following", "☆"),
        lens("show-all", "All", "≡"),
      ]
    : discoveryFallback("Following");
}

function recordSpecs(activeLens: ExchangeLens, item: ExchangeRecord, viewer: ExchangeViewerContext): ActionSpec[] {
  const own = Boolean(item.ownedByViewer);

  if (activeLens === "rfx") {
    if (own) {
      return [
        record("manage-rfx", "Manage", "✎", "workflow"),
        record("invite-team", "Invite Team", "◎", "workflow"),
        record("share", "Share", "↗", "direct"),
      ];
    }
    return [
      ...(viewer.canRespondRfx ? [record("respond", "Respond", "↵", "workflow")] : []),
      record("team", "Team", "◎", "workflow"),
      record("share", "Share", "↗", "direct"),
    ];
  }

  if (activeLens === "resources") {
    if (own) {
      return [
        record("edit-resource", "Edit", "✎", "modal"),
        record("archive-resource", "Archive", "▣", "workflow"),
        record("share", "Share", "↗", "direct"),
      ];
    }
    return [
      ...(viewer.canRequestResources ? [record("request-resource", "Request", "+", "modal")] : []),
      record("share", "Share", "↗", "direct"),
    ];
  }

  if (activeLens === "intelligence") {
    if (own && viewer.canContributeIntelligence) {
      return [
        record("edit-insight", "Edit", "✎", "modal"),
        record("compare", "Compare", "⇄", "workflow"),
        record("share", "Share", "↗", "direct"),
      ];
    }
    return [
      record("add-note", "Add Note", "◌", "modal"),
      record("compare", "Compare", "⇄", "workflow"),
      record("share", "Share", "↗", "direct"),
    ];
  }

  if (own && viewer.canManageCapabilities) {
    return [
      record("manage-capabilities", "Manage", "✎", "workflow"),
      record("ai-amacs", "AI → AMACS", "✦", "workflow"),
      record("capability-evidence", "Evidence", "✓", "workflow"),
      record("capability-gaps", "Gaps", "▥", "workflow"),
    ];
  }

  return [
    record("match-rfx", "Match RFx", "◇", "workflow"),
    record("refer", "Refer", "↗", "workflow"),
    record("share", "Share", "⇧", "direct"),
  ];
}

function toAction(
  spec: ActionSpec,
  position: 1 | 2 | 3 | 4,
  ownership: LensActionOwnership,
  item?: ExchangeRecord,
): LensAction {
  const applicable = spec.requiresRecord ? Boolean(item) : true;
  return {
    id: spec.id,
    position,
    label: spec.label,
    icon: spec.icon,
    trigger: spec.trigger,
    scope: spec.scope,
    ownership,
    visible: true,
    applicable,
    authorized: true,
    operational: spec.operational ?? true,
    prerequisitesSatisfied: true,
    requiresRecord: spec.requiresRecord,
    toggle: spec.toggle,
    unavailableReason: !applicable ? "Select a record to use this action." : spec.unavailableReason,
  };
}

export function deriveReferenceViewerContext(records: ExchangeRecord[]): ExchangeViewerContext {
  return {
    canIssueRfx: records.some((item) => item.type === "rfx" && item.ownedByViewer),
    canRespondRfx: true,
    canOfferResources: records.some((item) => item.type === "resource" && item.ownedByViewer),
    canRequestResources: true,
    canContributeIntelligence: records.some((item) => item.type === "intelligence" && item.ownedByViewer),
    canManageCapabilities: records.some((item) => item.type === "capability" && item.ownedByViewer),
  };
}

export function resolveLensActions(activeLens: ExchangeLens, viewer: ExchangeViewerContext): LensAction[] {
  const specs = lensSpecs(activeLens, viewer);
  const actions = specs.map((spec, index) => toAction(spec, (index + 1) as 1 | 2 | 3 | 4, "any"));
  if (actions.length !== 4 || new Set(actions.map((item) => item.position)).size !== 4) {
    throw new Error(`Lens ${activeLens} must resolve exactly four governed lens controls.`);
  }
  return actions;
}

export function resolveRecordActions(activeLens: ExchangeLens, item: ExchangeRecord, viewer: ExchangeViewerContext): LensAction[] {
  const ownership: LensActionOwnership = item.ownedByViewer ? "own" : "other";
  return recordSpecs(activeLens, item, viewer)
    .slice(0, 4)
    .map((spec, index) => toAction(spec, (index + 1) as 1 | 2 | 3 | 4, ownership, item));
}

export function isLensActionEnabled(action: LensAction) {
  return action.visible && action.operational && action.applicable && action.authorized && action.prerequisitesSatisfied;
}

export function getLensActionUnavailableReason(action: LensAction) {
  if (!action.visible) return "This action is hidden in the current context.";
  if (!action.operational) return action.unavailableReason ?? "This workflow is not operational yet.";
  if (!action.applicable) return action.unavailableReason ?? "This action does not apply to the current context.";
  if (!action.authorized) return action.unavailableReason ?? "Your current organization role is not authorized for this action.";
  if (!action.prerequisitesSatisfied) return action.unavailableReason ?? "Complete the required prerequisite before using this action.";
  return undefined;
}
