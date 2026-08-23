import type {
  ExchangeRecord,
  ResourceAvailabilityState,
  ResourceProjection,
  ResourceVisibility,
} from "./contracts";
import type { GeographicScope, GeographyProfile } from "@/lib/geography/contracts";

export type ResourceSort = "relevance" | "availability" | "organization";
export type ResourceOwnership = "all" | "mine";
export type ResourceMapScope = "all" | "mapped" | "off-map";

export interface ResourceFilters {
  category: string;
  availability: "all" | ResourceAvailabilityState;
  ownership: ResourceOwnership;
  mapScope: ResourceMapScope;
}

export interface ResourceDraft {
  title: string;
  category: string;
  summary: string;
  geography: string;
  geographyProfile?: GeographyProfile;
  availability: ResourceAvailabilityState;
  availabilityLabel: string;
  capacity: string;
  serviceArea: string;
  serviceScope?: GeographicScope;
  visibility: ResourceVisibility;
  terms: string;
}

export interface ResourceRequestDraft {
  scope: string;
  neededBy: string;
  message: string;
}

export const defaultResourceFilters: ResourceFilters = {
  category: "all",
  availability: "all",
  ownership: "all",
  mapScope: "all",
};

export function isResourceRecord(record: ExchangeRecord): record is ExchangeRecord & { resource: ResourceProjection } {
  return record.type === "resource" && Boolean(record.resource);
}

export function resourceCategories(records: ExchangeRecord[]) {
  return Array.from(new Set(records.filter(isResourceRecord).map((record) => record.resource.category))).sort();
}

const availabilityRank: Record<ResourceAvailabilityState, number> = {
  available: 0,
  limited: 1,
  scheduled: 2,
  unknown: 3,
};

export function filterResourceRecords(records: ExchangeRecord[], filters: ResourceFilters, sort: ResourceSort) {
  const filtered = records.filter((record) => {
    if (!isResourceRecord(record) || record.resource.status !== "active") return false;
    if (filters.category !== "all" && record.resource.category !== filters.category) return false;
    if (filters.availability !== "all" && record.resource.availability !== filters.availability) return false;
    if (filters.ownership === "mine" && !record.ownedByViewer) return false;
    if (filters.mapScope === "mapped" && !record.location) return false;
    if (filters.mapScope === "off-map" && record.location) return false;
    return true;
  });

  if (sort === "relevance") return filtered;
  return [...filtered].sort((a, b) => {
    if (!isResourceRecord(a) || !isResourceRecord(b)) return 0;
    if (sort === "availability") return availabilityRank[a.resource.availability] - availabilityRank[b.resource.availability];
    return a.organization.localeCompare(b.organization);
  });
}

export function resourceMetadata(resource: ResourceProjection) {
  return [resource.category, resource.availabilityLabel, resource.capacity, resource.visibility === "off-map" ? "Off-map" : undefined]
    .filter((item): item is string => Boolean(item));
}
