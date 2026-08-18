import type {
  ExchangeLens,
  ExchangeRecord,
  ExchangeSearchFilters,
  ExchangeSearchResponse,
  ExchangeSearchState,
  SearchSuggestion,
} from "./contracts";

export const typeByLens: Record<ExchangeLens, ExchangeRecord["type"]> = {
  rfx: "rfx",
  resources: "resource",
  intelligence: "intelligence",
  capabilities: "capability",
};

export const defaultSearchFilters: ExchangeSearchFilters = {
  geography: "",
  location: "all",
  ownership: "all",
  metadata: [],
};

export function defaultSearchState(query = ""): ExchangeSearchState {
  return { query, filters: { ...defaultSearchFilters }, sort: "relevance" };
}

function normalized(value: string) {
  return value.trim().toLowerCase();
}

function searchableFields(record: ExchangeRecord) {
  const cardTerms = [
    record.card?.eyebrow,
    record.card?.status?.label,
    ...(record.card?.classifications ?? []),
    ...(record.card?.relationships ?? []),
  ].filter((value): value is string => Boolean(value));
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

function passesFilters(record: ExchangeRecord, filters: ExchangeSearchFilters) {
  const geography = normalized(filters.geography);
  if (geography && !normalized(record.geography).includes(geography)) return false;
  if (filters.location === "mapped" && !record.location) return false;
  if (filters.location === "off-map" && record.location) return false;
  if (filters.ownership === "mine" && !record.ownedByViewer) return false;
  if (filters.ownership === "others" && record.ownedByViewer) return false;
  if (filters.metadata.length) {
    const metadata = [...record.metadata, ...(record.card?.classifications ?? []), ...(record.card?.relationships ?? [])].map(normalized);
    if (!filters.metadata.every((tag) => metadata.some((value) => value.includes(normalized(tag))))) return false;
  }
  return true;
}

export function searchExchangeRecords(records: ExchangeRecord[], lens: ExchangeLens, state: ExchangeSearchState): ExchangeSearchResponse {
  const results = records
    .filter((record) => record.type === typeByLens[lens])
    .filter((record) => passesFilters(record, state.filters))
    .map((record) => ({ record, match: matchRecord(record, state.query) }))
    .filter((result) => result.match.matches)
    .map(({ record, match }) => ({ record, match: { score: match.score, matchedFields: match.matchedFields } }));
  results.sort((left, right) => {
    if (state.sort === "title") return left.record.title.localeCompare(right.record.title);
    if (state.sort === "geography") return left.record.geography.localeCompare(right.record.geography) || left.record.title.localeCompare(right.record.title);
    return right.match.score - left.match.score || Number(Boolean(right.record.featured)) - Number(Boolean(left.record.featured)) || left.record.title.localeCompare(right.record.title);
  });
  return {
    lens,
    state,
    results,
    total: results.length,
    mapped: results.filter((result) => Boolean(result.record.location)).length,
    offMap: results.filter((result) => !result.record.location).length,
  };
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
    for (const metadata of [...record.metadata, ...(record.card?.classifications ?? [])]) add("metadata", metadata, `${record.organization} · ${record.type}`);
  }
  return [...suggestions.values()].slice(0, limit);
}

export function searchStateFromParams(params: URLSearchParams): ExchangeSearchState {
  const location = params.get("location");
  const ownership = params.get("ownership");
  const sort = params.get("sort");
  return {
    query: params.get("q") ?? "",
    filters: {
      geography: params.get("geo") ?? "",
      location: location === "mapped" || location === "off-map" ? location : "all",
      ownership: ownership === "mine" || ownership === "others" ? ownership : "all",
      metadata: params.getAll("tag").filter(Boolean),
    },
    sort: sort === "title" || sort === "geography" ? sort : "relevance",
  };
}

export function searchStateToParams(state: ExchangeSearchState) {
  const params = new URLSearchParams();
  if (state.query.trim()) params.set("q", state.query.trim());
  if (state.filters.geography.trim()) params.set("geo", state.filters.geography.trim());
  if (state.filters.location !== "all") params.set("location", state.filters.location);
  if (state.filters.ownership !== "all") params.set("ownership", state.filters.ownership);
  for (const tag of state.filters.metadata) if (tag.trim()) params.append("tag", tag.trim());
  if (state.sort !== "relevance") params.set("sort", state.sort);
  return params;
}

export function activeFilterCount(state: ExchangeSearchState) {
  return Number(Boolean(state.filters.geography.trim()))
    + Number(state.filters.location !== "all")
    + Number(state.filters.ownership !== "all")
    + state.filters.metadata.length
    + Number(state.sort !== "relevance");
}
