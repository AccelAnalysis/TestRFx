import type { ExchangeFilters, ExchangeLens, ExchangeRecord } from "./contracts";
import { defaultSearchState, recordGeographies, searchExchangeRecords, typeByLens } from "./search";
import { geographyTypeLabels } from "@/lib/geography/contracts";

export { typeByLens };

export function createExchangeFilters(): ExchangeFilters {
  return {
    geographyIds: [],
    geographyTypes: [],
    relationship: "all",
    mappedOnly: false,
    featuredOnly: false,
    metadata: [],
  };
}

export function countActiveFilters(filters: ExchangeFilters) {
  return [
    Boolean(filters.geography),
    filters.geographyIds.length > 0,
    filters.geographyTypes.length > 0,
    filters.relationship !== "all",
    filters.mappedOnly,
    filters.featuredOnly,
    filters.metadata.length > 0,
  ].filter(Boolean).length;
}

export function getLensFilterOptions(records: ExchangeRecord[], lens: ExchangeLens) {
  const lensRecords = records.filter((record) => record.type === typeByLens[lens]);
  const structured = new Map<string, { id: string; type: ReturnType<typeof recordGeographies>[number]["type"]; label: string; detail: string }>();
  for (const record of lensRecords) {
    for (const geography of recordGeographies(record)) {
      if (!structured.has(geography.key)) {
        structured.set(geography.key, {
          id: geography.key,
          type: geography.type,
          label: geography.name,
          detail: geography.geoid ?? geography.externalId ?? geographyTypeLabels[geography.type],
        });
      }
    }
  }
  return {
    geographies: [...new Set(lensRecords.map((record) => record.geography))].sort(),
    geographyFacets: [...structured.values()].sort((a, b) => geographyTypeLabels[a.type].localeCompare(geographyTypeLabels[b.type]) || a.label.localeCompare(b.label)),
    metadata: [...new Set(lensRecords.flatMap((record) => record.metadata))].sort(),
    supportsFeatured: lensRecords.some((record) => record.featured),
  };
}

export function applyExchangeFilters(records: ExchangeRecord[], filters: ExchangeFilters) {
  return records.filter((record) => {
    if (filters.geography && record.geography !== filters.geography && !recordGeographies(record).some((ref) => ref.name === filters.geography)) return false;
    if (filters.geographyIds.length && !filters.geographyIds.every((id) => recordGeographies(record).some((ref) => ref.key === id || ref.geoid === id || ref.externalId === id))) return false;
    if (filters.geographyTypes.length && !filters.geographyTypes.every((type) => recordGeographies(record).some((ref) => ref.type === type))) return false;
    if (filters.relationship === "mine" && !record.ownedByViewer) return false;
    if (filters.relationship === "others" && record.ownedByViewer) return false;
    if (filters.mappedOnly && !record.location) return false;
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
