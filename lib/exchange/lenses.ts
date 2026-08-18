import type { ExchangeLens, ExchangeLensDefinition } from "./contracts";
import { resolveLensActions } from "./action-registry";

export const lensDefinitions: Record<ExchangeLens, ExchangeLensDefinition> = {
  rfx: {
    id: "rfx",
    label: "RFx",
    icon: "⌁",
    searchPlaceholder: "Search RFx, agencies, opportunities, requirements…",
    emptyMessage: "No RFx records match this view.",
    actions: (record) => resolveLensActions("rfx", record),
  },
  resources: {
    id: "resources",
    label: "Resources",
    icon: "◫",
    searchPlaceholder: "Search resources, suppliers, equipment, services…",
    emptyMessage: "No resources match this view.",
    actions: (record) => resolveLensActions("resources", record),
  },
  intelligence: {
    id: "intelligence",
    label: "Intelligence",
    icon: "◉",
    searchPlaceholder: "Search markets, industries, organizations, insights…",
    emptyMessage: "No intelligence records match this view.",
    actions: (record) => resolveLensActions("intelligence", record),
  },
  capabilities: {
    id: "capabilities",
    label: "Capabilities",
    icon: "◇",
    searchPlaceholder: "Search companies, capabilities, AMACS categories…",
    emptyMessage: "No capabilities match this view.",
    actions: (record) => resolveLensActions("capabilities", record),
  },
};

export const lensOrder: ExchangeLens[] = ["rfx", "resources", "intelligence", "capabilities"];

export function isExchangeLens(value: string): value is ExchangeLens {
  return value === "rfx" || value === "resources" || value === "intelligence" || value === "capabilities";
}
