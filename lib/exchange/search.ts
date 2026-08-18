import type {
  Coordinates,
  ExchangeLens,
  ExchangeRecord,
  ExchangeSearchFilters,
  ExchangeSearchResponse,
  ExchangeSearchState,
  MapBounds,
  SearchGeographyMode,
  SearchSuggestion,
} from "./contracts";

export const typeByLens: Record<ExchangeLens, ExchangeRecord["type"]> = {
  rfx: "rfx",
  resources: "resource",
  intelligence: "intelligence",
  capabilities: "capability",
};

export function createDefaultSearchFilters(): ExchangeSearchFilters {
  return {
    geography: "",
    geographyMode: "exchange",
    location: "all",
    ownership: "all",
    metadata: [],
    facets: {},
  };
}

export const defaultSearchFilters: ExchangeSearchFilters = createDefaultSearchFilters();

export function defaultSearchState(query = ""): ExchangeSearchState {
  return { query, filters: createDefaultSearchFilters(), sort: "relevance" };
}

function normalized(value: string) {
  return value.trim().toLowerCase();
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asCoordinates(value: unknown): Coordinates | undefined {
  if (!value || typeof value !== "object") return undefined;
  const lat = asNumber((value as { lat?: unknown }).lat);
  const lng = asNumber((value as { lng?: unknown }).lng);
  return lat === undefined || lng === undefined ? undefined : { lat, lng };
}

function asBounds(value: unknown): MapBounds | undefined {
  if (!value || typeof value !== "object") return undefined;
  const input = value as Partial<Record<keyof MapBounds, unknown>>;
  const north = asNumber(input.north); const south = asNumber(input.south); const east = asNumber(input.east); const west = asNumber(input.west);
  return north === undefined || south === undefined || east === undefined || west === undefined ? undefined : { north, south, east, west };
}

function asGeographyMode(value: unknown): SearchGeographyMode {
  return value === "place" || value === "radius" || value === "viewport" || value === "service-area" || value === "performance-area" ? value : "exchange";
}

export function normalizeSearchState(value: unknown): ExchangeSearchState {
  if (!value || typeof value !== "object") return defaultSearchState();
  const source = value as { query?: unknown; sort?: unknown; filters?: unknown };
  const filters = source.filters && typeof source.filters === "object" ? source.filters as Record<string, unknown> : {};
  const location = filters.location;
  const ownership = filters.ownership;
  const metadata = Array.isArray(filters.metadata) ? filters.metadata.filter((item): item is string => typeof item === "string" && Boolean(item.trim())) : [];
  const rawFacets = filters.facets && typeof filters.facets === "object" && !Array.isArray(filters.facets) ? filters.facets as Record<string, unknown> : {};
  const facets = Object.fromEntries(Object.entries(rawFacets).flatMap(([key, item]) => {
    if (!Array.isArray(item)) return [];
    const values = item.filter((entry): entry is string => typeof entry === "string" && Boolean(entry.trim()));
    return values.length ? [[key, values]] : [];
  }));
  const sort = source.sort;
  return {
    query: typeof source.query === "string" ? source.query : "",
    filters: {
      geography: typeof filters.geography === "string" ? filters.geography : "",
      geographyMode: asGeographyMode(filters.geographyMode),
      radiusMiles: asNumber(filters.radiusMiles),
      center: asCoordinates(filters.center),
      bounds: asBounds(filters.bounds),
      location: location === "mapped" || location === "off-map" ? location : "all",
      ownership: ownership === "mine" || ownership === "others" ? ownership : "all",
      metadata,
      facets,
    },
    sort: sort === "title" || sort === "geography" || sort === "recent" ? sort : "relevance",
  };
}

function searchableFields(record: ExchangeRecord) {
  const cardTerms = [record.card?.eyebrow, record.card?.status?.label, ...(record.card?.classifications ?? []), ...(record.card?.relationships ?? [])].filter((value): value is string => Boolean(value));
  return [
    { name: "title", value: record.title, weight: 5 },
    { name: "organization", value: record.organization, weight: 4 },
    { name: "summary", value: record.summary, weight: 3 },
    { name: "geography", value: record.geography, weight: 2 },
    ...record.metadata.map((value) => ({ name: "metadata", value, weight: 2 })),
    ...cardTerms.map((value) => ({ name: "card", value, weight: 2 })),
  ];
}

function matchRecord(record: ExchangeRecord, query: string) {
  const terms = normalized(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return { matches: true, score: 0, matchedFields: [] as string[] };
  const fields = searchableFields(record);
  const matchedFields = new Set<string>();
  let score = 0;
  for (const term of terms) {
    let termMatched = false;
    for (const field of fields) {
      const value = normalized(field.value);
      if (!value.includes(term)) continue;
      termMatched = true;
      matchedFields.add(field.name);
      score += field.weight + (value === term ? 3 : value.startsWith(term) ? 1 : 0);
    }
    if (!termMatched) return { matches: false, score: 0, matchedFields: [] as string[] };
  }
  return { matches: true, score, matchedFields: [...matchedFields] };
}

function withinBounds(location: Coordinates, bounds: MapBounds) {
  return location.lat <= bounds.north && location.lat >= bounds.south && location.lng <= bounds.east && location.lng >= bounds.west;
}

function distanceMiles(left: Coordinates, right: Coordinates) {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const earthMiles = 3958.8;
  const dLat = radians(right.lat - left.lat); const dLng = radians(right.lng - left.lng);
  const lat1 = radians(left.lat); const lat2 = radians(right.lat);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return earthMiles * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function facetValues(record: ExchangeRecord, key: string) {
  if (key === "issuer" || key === "provider" || key === "organization") return [record.organization];
  if (key === "availability") return [record.resource?.availabilityLabel, record.resource?.availability].filter((value): value is string => Boolean(value));
  if (key === "category") return [record.resource?.category, ...(record.card?.classifications ?? [])].filter((value): value is string => Boolean(value));
  if (key === "status") return [record.card?.status?.label, ...(record.metadata ?? [])].filter((value): value is string => Boolean(value));
  return [...record.metadata, ...(record.card?.classifications ?? []), ...(record.card?.relationships ?? [])];
}

function passesFilters(record: ExchangeRecord, filters: ExchangeSearchFilters) {
  const geography = normalized(filters.geography);
  if (geography && (filters.geographyMode === "place" || filters.geographyMode === "exchange") && !normalized(record.geography).includes(geography)) return false;
  if (filters.geographyMode === "viewport" && filters.bounds && (!record.location || !withinBounds(record.location, filters.bounds))) return false;
  if (filters.geographyMode === "radius" && filters.center && filters.radiusMiles && (!record.location || distanceMiles(record.location, filters.center) > filters.radiusMiles)) return false;
  if (filters.location === "mapped" && !record.location) return false;
  if (filters.location === "off-map" && record.location) return false;
  if (filters.ownership === "mine" && !record.ownedByViewer) return false;
  if (filters.ownership === "others" && record.ownedByViewer) return false;
  if (filters.metadata.length) {
    const metadata = [...record.metadata, ...(record.card?.classifications ?? []), ...(record.card?.relationships ?? [])].map(normalized);
    if (!filters.metadata.every((tag) => metadata.some((value) => value.includes(normalized(tag))))) return false;
  }
  for (const [key, selected] of Object.entries(filters.facets)) {
    if (!selected.length) continue;
    const values = facetValues(record, key).map(normalized);
    if (!selected.some((choice) => values.some((value) => value.includes(normalized(choice))))) return false;
  }
  return true;
}

export function searchExchangeRecords(records: ExchangeRecord[], lens: ExchangeLens, state: ExchangeSearchState): ExchangeSearchResponse {
  const results = records
    .filter((record) => record.type === typeByLens[lens])
    .filter((record) => passesFilters(record, state.filters))
    .map((record) => ({ record, match: matchRecord(record, state.query) }))
    .filter((result) => result.match.matches)
    .map(({ record, match }) => ({
      record,
      match: {
        score: match.score,
        matchedFields: match.matchedFields,
        explanation: match.matchedFields.length ? `Matched ${match.matchedFields.join(", ")}` : undefined,
      },
    }));
  results.sort((left, right) => {
    if (state.sort === "title") return left.record.title.localeCompare(right.record.title);
    if (state.sort === "geography") return left.record.geography.localeCompare(right.record.geography) || left.record.title.localeCompare(right.record.title);
    if (state.sort === "recent") return left.record.title.localeCompare(right.record.title);
    return right.match.score - left.match.score || Number(Boolean(right.record.featured)) - Number(Boolean(left.record.featured)) || left.record.title.localeCompare(right.record.title);
  });
  return {
    lens,
    state,
    results,
    suggestions: getSearchSuggestions(records, lens, state.query),
    total: results.length,
    mapped: results.filter((result) => Boolean(result.record.location)).length,
    offMap: results.filter((result) => !result.record.location).length,
    hasMore: false,
  };
}

export function emptySearchResponse(lens: ExchangeLens, state: ExchangeSearchState): ExchangeSearchResponse {
  return { lens, state, results: [], suggestions: [], total: 0, mapped: 0, offMap: 0, hasMore: false };
}

export function getSearchSuggestions(records: ExchangeRecord[], lens: ExchangeLens, query: string, limit = 8): SearchSuggestion[] {
  const typed = normalized(query);
  const lensRecords = records.filter((record) => record.type === typeByLens[lens]);
  const suggestions = new Map<string, SearchSuggestion>();
  function add(kind: SearchSuggestion["kind"], label: string, description: string) {
    const key = `${kind}:${normalized(label)}`;
    if (suggestions.has(key)) return;
    if (typed && !normalized(`${label} ${description}`).includes(typed)) return;
    suggestions.set(key, { id: key, kind, label, description, query: label });
  }
  for (const record of lensRecords) {
    add("record", record.title, `${record.organization} · ${record.geography}`);
    add("organization", record.organization, `Organization · ${record.geography}`);
    add("geography", record.geography, "Geography");
    for (const metadata of [...record.metadata, ...(record.card?.classifications ?? [])]) {
      add(lens === "capabilities" ? "capability" : "metadata", metadata, `${record.organization} · ${record.type}`);
    }
  }
  return [...suggestions.values()].slice(0, limit);
}

function parseFacet(value: string) {
  const index = value.indexOf(":");
  if (index <= 0) return undefined;
  return { key: value.slice(0, index), value: value.slice(index + 1) };
}

export function searchStateFromParams(params: URLSearchParams): ExchangeSearchState {
  const location = params.get("location"); const ownership = params.get("ownership"); const sort = params.get("sort");
  const facetPairs = params.getAll("facet").flatMap((value) => { const parsed = parseFacet(value); return parsed ? [parsed] : []; });
  const facets: Record<string, string[]> = {};
  for (const pair of facetPairs) facets[pair.key] = [...(facets[pair.key] ?? []), pair.value];
  const lat = Number(params.get("lat")); const lng = Number(params.get("lng"));
  const north = Number(params.get("north")); const south = Number(params.get("south")); const east = Number(params.get("east")); const west = Number(params.get("west"));
  const radius = Number(params.get("radius"));
  return {
    query: params.get("q") ?? "",
    filters: {
      geography: params.get("geo") ?? "",
      geographyMode: asGeographyMode(params.get("geoMode")),
      radiusMiles: Number.isFinite(radius) && radius > 0 ? radius : undefined,
      center: Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : undefined,
      bounds: [north, south, east, west].every(Number.isFinite) ? { north, south, east, west } : undefined,
      location: location === "mapped" || location === "off-map" ? location : "all",
      ownership: ownership === "mine" || ownership === "others" ? ownership : "all",
      metadata: params.getAll("tag").filter(Boolean),
      facets,
    },
    sort: sort === "title" || sort === "geography" || sort === "recent" ? sort : "relevance",
  };
}

export function searchStateToParams(state: ExchangeSearchState) {
  const params = new URLSearchParams(); const { filters } = state;
  if (state.query.trim()) params.set("q", state.query.trim());
  if (filters.geography.trim()) params.set("geo", filters.geography.trim());
  if (filters.geographyMode !== "exchange") params.set("geoMode", filters.geographyMode);
  if (filters.radiusMiles) params.set("radius", String(filters.radiusMiles));
  if (filters.center) { params.set("lat", String(filters.center.lat)); params.set("lng", String(filters.center.lng)); }
  if (filters.bounds) { params.set("north", String(filters.bounds.north)); params.set("south", String(filters.bounds.south)); params.set("east", String(filters.bounds.east)); params.set("west", String(filters.bounds.west)); }
  if (filters.location !== "all") params.set("location", filters.location);
  if (filters.ownership !== "all") params.set("ownership", filters.ownership);
  for (const tag of filters.metadata) if (tag.trim()) params.append("tag", tag.trim());
  for (const [key, values] of Object.entries(filters.facets)) for (const value of values) if (value.trim()) params.append("facet", `${key}:${value.trim()}`);
  if (state.sort !== "relevance") params.set("sort", state.sort);
  return params;
}

export function activeFilterCount(state: ExchangeSearchState) {
  return Number(Boolean(state.filters.geography.trim()))
    + Number(state.filters.geographyMode !== "exchange")
    + Number(state.filters.location !== "all")
    + Number(state.filters.ownership !== "all")
    + state.filters.metadata.length
    + Object.values(state.filters.facets).filter((values) => values.length > 0).length
    + Number(state.sort !== "relevance");
}
