import type { ExchangeFilters, ExchangeLens, ExchangeRecord } from "./contracts";
import { defaultSearchState, searchExchangeRecords, typeByLens } from "./search";

export { typeByLens };

export function createExchangeFilters(): ExchangeFilters {
  return {
    relationship: "all",
    location: "all",
    featuredOnly: false,
    metadata: [],
  };
}

export function normalizeExchangeFilters(value: unknown): ExchangeFilters {
  const fallback = createExchangeFilters();
  if (!value || typeof value !== "object") return fallback;
  const candidate = value as Partial<ExchangeFilters> & { mappedOnly?: boolean };
  const relationship = candidate.relationship === "mine" || candidate.relationship === "others" ? candidate.relationship : "all";
  const location = candidate.location === "mapped" || candidate.location === "off-map"
    ? candidate.location
    : candidate.mappedOnly
      ? "mapped"
      : "all";
  return {
    geography: typeof candidate.geography === "string" && candidate.geography.trim() ? candidate.geography : undefined,
    relationship,
    location,
    featuredOnly: Boolean(candidate.featuredOnly),
    metadata: Array.isArray(candidate.metadata) ? candidate.metadata.filter((item): item is string => typeof item === "string") : [],
  };
}

export function countActiveFilters(filters: ExchangeFilters) {
  return [
    Boolean(filters.geography),
    filters.relationship !== "all",
    filters.location !== "all",
    filters.featuredOnly,
    filters.metadata.length > 0,
  ].filter(Boolean).length;
}

export function getLensFilterOptions(records: ExchangeRecord[], lens: ExchangeLens) {
  const lensRecords = records.filter((record) => record.type === typeByLens[lens]);
  return {
    geographies: [...new Set(lensRecords.map((record) => record.geography).filter(Boolean))].sort(),
    metadata: [...new Set(lensRecords.flatMap((record) => record.metadata))].sort(),
    supportsFeatured: lensRecords.some((record) => record.featured),
    hasMapped: lensRecords.some((record) => Boolean(record.location)),
    hasOffMap: lensRecords.some((record) => !record.location),
  };
}

export function applyExchangeFilters(records: ExchangeRecord[], filters: ExchangeFilters) {
  return records.filter((record) => {
    if (filters.geography && record.geography !== filters.geography) return false;
    if (filters.relationship === "mine" && !record.ownedByViewer) return false;
    if (filters.relationship === "others" && record.ownedByViewer) return false;
    if (filters.location === "mapped" && !record.location) return false;
    if (filters.location === "off-map" && record.location) return false;
    if (filters.featuredOnly && !record.featured) return false;
    if (filters.metadata.length && !filters.metadata.some((value) => record.metadata.includes(value))) return false;
    return true;
  });
}

/**
 * Compatibility adapter for chassis callers that still provide a query string.
 * Universal Search owns query/ranking; optional Floating Controls filters are
 * applied after the normalized search result set.
 */
export function filterExchangeRecords(records: ExchangeRecord[], lens: ExchangeLens, search: string, filters?: ExchangeFilters) {
  const found = searchExchangeRecords(records, lens, defaultSearchState(search)).results.map((result) => result.record);
  return filters ? applyExchangeFilters(found, filters) : found;
}
