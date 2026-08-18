import type { ExchangeLens, ExchangeLensDefinition, ExchangeRecord, LensAction } from "./contracts";

function action(position: 1 | 2 | 3 | 4, id: string, label: string, icon: string, operational = true, unavailableReason?: string): LensAction {
  return { id, position, label, icon, visible: true, applicable: true, authorized: true, operational, unavailableReason };
}

function ownershipAwareActions(lens: ExchangeLens, record?: ExchangeRecord): LensAction[] {
  const own = Boolean(record?.ownedByViewer);
  switch (lens) {
    case "rfx":
      return own
        ? [action(1, "manage", "Manage", "✎"), action(2, "responses", "Responses", "▤"), action(3, "watch", "Watch", "☆"), action(4, "share", "Share", "↗")]
        : [action(1, "respond", "Respond", "↵", false, "Response workflow plugs into this contract."), action(2, "team", "Team", "◎", false, "Teaming workflow plugs into this contract."), action(3, "watch", "Watch", "☆"), action(4, "share", "Share", "↗")];
    case "resources":
      return own
        ? [action(1, "manage", "Manage", "✎"), action(2, "availability", "Availability", "◷"), action(3, "save", "Save", "☆"), action(4, "share", "Share", "↗")]
        : [action(1, "request", "Request", "+", false, "Resource transaction workflow plugs into this contract."), action(2, "connect", "Connect", "◎", false, "Connection workflow plugs into this contract."), action(3, "save", "Save", "☆"), action(4, "share", "Share", "↗")];
    case "intelligence":
      return [action(1, "inspect", "Inspect", "◫"), action(2, "compare", "Compare", "⇄", false, "Comparative intelligence plugs into this contract."), action(3, "track", "Track", "☆"), action(4, "share", "Share", "↗")];
    case "capabilities":
      return own
        ? [action(1, "manage", "Manage", "✎"), action(2, "evidence", "Evidence", "✓", false, "AMACS evidence workflow plugs into this contract."), action(3, "publish", "Publish", "↑", false, "Publishing workflow plugs into this contract."), action(4, "share", "Share", "↗")]
        : [action(1, "match", "Match", "◇", false, "Matching workflow plugs into this contract."), action(2, "refer", "Refer", "↗", false, "Cross-lens referrals plug into this contract."), action(3, "follow", "Follow", "☆"), action(4, "share", "Share", "↗")];
  }
}

export const lensDefinitions: Record<ExchangeLens, ExchangeLensDefinition> = {
  rfx: { id: "rfx", label: "RFx", icon: "⌁", searchPlaceholder: "Search RFx, agencies, opportunities, requirements…", emptyMessage: "No RFx records match this view.", actions: (record) => ownershipAwareActions("rfx", record) },
  resources: { id: "resources", label: "Resources", icon: "◫", searchPlaceholder: "Search resources, suppliers, equipment, services…", emptyMessage: "No resources match this view.", actions: (record) => ownershipAwareActions("resources", record) },
  intelligence: { id: "intelligence", label: "Intelligence", icon: "◉", searchPlaceholder: "Search markets, industries, organizations, insights…", emptyMessage: "No intelligence records match this view.", actions: (record) => ownershipAwareActions("intelligence", record) },
  capabilities: { id: "capabilities", label: "Capabilities", icon: "◇", searchPlaceholder: "Search companies, capabilities, AMACS categories…", emptyMessage: "No capabilities match this view.", actions: (record) => ownershipAwareActions("capabilities", record) },
};

export const lensOrder: ExchangeLens[] = ["rfx", "resources", "intelligence", "capabilities"];

export function isExchangeLens(value: string): value is ExchangeLens {
  return value === "rfx" || value === "resources" || value === "intelligence" || value === "capabilities";
}
