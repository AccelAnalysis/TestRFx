import type { ExchangeLens, ExchangeLensDefinition } from "./contracts";
import { resolveLensActions, resolveRecordActions } from "./action-registry";

export const lensDefinitions: Record<ExchangeLens, ExchangeLensDefinition> = {
  rfx: {
    id: "rfx",
    label: "RFx",
    icon: "opportunity-document",
    searchPlaceholder: "Search RFx, agencies, opportunities, requirements…",
    emptyMessage: "No RFx records match this view.",
    actions: (viewer) => resolveLensActions("rfx", viewer),
    recordActions: (record, viewer) => resolveRecordActions("rfx", record, viewer),
  },
  resources: {
    id: "resources",
    label: "Resources",
    icon: "resource-ecosystem",
    searchPlaceholder: "Search resources, suppliers, equipment, services…",
    emptyMessage: "No resources match this view.",
    actions: (viewer) => resolveLensActions("resources", viewer),
    recordActions: (record, viewer) => resolveRecordActions("resources", record, viewer),
  },
  intelligence: {
    id: "intelligence",
    label: "Intelligence",
    icon: "intelligence-signal",
    searchPlaceholder: "Search markets, industries, organizations, insights…",
    emptyMessage: "No intelligence records match this view.",
    actions: (viewer) => resolveLensActions("intelligence", viewer),
    recordActions: (record, viewer) => resolveRecordActions("intelligence", record, viewer),
  },
  capabilities: {
    id: "capabilities",
    label: "Capabilities",
    icon: "capability-stack",
    searchPlaceholder: "Search companies, capabilities, AMACS categories…",
    emptyMessage: "No capabilities match this view.",
    actions: (viewer) => resolveLensActions("capabilities", viewer),
    recordActions: (record, viewer) => resolveRecordActions("capabilities", record, viewer),
  },
};

export const lensOrder: ExchangeLens[] = ["rfx", "resources", "intelligence", "capabilities"];

export function isExchangeLens(value: string): value is ExchangeLens {
  return value === "rfx" || value === "resources" || value === "intelligence" || value === "capabilities";
}
