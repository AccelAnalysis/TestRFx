import type { ExchangeFilters, ExchangeLens, ExchangeRecord } from "./contracts";

export const typeByLens: Record<ExchangeLens, ExchangeRecord["type"]> = {
  rfx: "rfx",
  resources: "resource",
  intelligence: "intelligence",
  capabilities: "capability",
};

export function createExchangeFilters(): ExchangeFilters {
  return {
    relationship: "all",
    mappedOnly: false,
    featuredOnly: false,
    metadata: [],
  };
}

export function countActiveFilters(filters: ExchangeFilters) {
  return [
    Boolean(filters.geography),
    filters.relationship !== "all",
    filters.mappedOnly,
    filters.featuredOnly,
    filters.metadata.length > 0,
  ].filter(Boolean).length;
}

export function getLensFilterOptions(records: ExchangeRecord[], lens: ExchangeLens) {
  const lensRecords = records.filter((record) => record.type === typeByLens[lens]);
  return {
    geographies: [...new Set(lensRecords.map((record) => record.geography))].sort(),
    metadata: [...new Set(lensRecords.flatMap((record) => record.metadata))].sort(),
    supportsFeatured: lensRecords.some((record) => record.featured),
  };
}

export function filterExchangeRecords(records: ExchangeRecord[], lens: ExchangeLens, search: string, filters: ExchangeFilters = createExchangeFilters()) {
  const query = search.trim().toLowerCase();
  return records.filter((record) => {
    if (record.type !== typeByLens[lens]) return false;
    if (query && ![record.title, record.organization, record.summary, record.geography, ...record.metadata]
      .join(" ")
      .toLowerCase()
      .includes(query)) return false;
    if (filters.geography && record.geography !== filters.geography) return false;
    if (filters.relationship === "mine" && !record.ownedByViewer) return false;
    if (filters.relationship === "others" && record.ownedByViewer) return false;
    if (filters.mappedOnly && !record.location) return false;
    if (filters.featuredOnly && !record.featured) return false;
    if (filters.metadata.length && !filters.metadata.some((value) => record.metadata.includes(value))) return false;
    return true;
  });
}
