export type ExchangeLens = "rfx" | "resources" | "intelligence" | "capabilities";
export type DrawerState = "peek" | "mid" | "expanded";
export type ExchangeRecordType = "rfx" | "resource" | "intelligence" | "capability";
export type SearchSort = "relevance" | "title" | "geography";
export type SearchLocationMode = "all" | "mapped" | "off-map";
export type SearchOwnership = "all" | "mine" | "others";
export type SearchSuggestionKind = "record" | "organization" | "geography" | "metadata";

export type Coordinates = { lat: number; lng: number };

export interface ExchangeRecord {
  id: string;
  type: ExchangeRecordType;
  title: string;
  organization: string;
  summary: string;
  geography: string;
  metadata: string[];
  location?: Coordinates;
  ownedByViewer?: boolean;
  featured?: boolean;
  saved?: boolean;
}

export interface LensAction {
  id: string;
  position: 1 | 2 | 3 | 4;
  label: string;
  icon: string;
  visible: boolean;
  applicable: boolean;
  authorized: boolean;
  operational: boolean;
  unavailableReason?: string;
}

export interface ExchangeLensDefinition {
  id: ExchangeLens;
  label: string;
  icon: string;
  searchPlaceholder: string;
  emptyMessage: string;
  actions: (record?: ExchangeRecord) => LensAction[];
}

export interface ExchangeSearchFilters {
  geography: string;
  location: SearchLocationMode;
  ownership: SearchOwnership;
  metadata: string[];
}

export interface ExchangeSearchState {
  query: string;
  filters: ExchangeSearchFilters;
  sort: SearchSort;
}

export interface ExchangeSearchMatch {
  score: number;
  matchedFields: string[];
}

export interface ExchangeSearchResult {
  record: ExchangeRecord;
  match: ExchangeSearchMatch;
}

export interface ExchangeSearchResponse {
  lens: ExchangeLens;
  state: ExchangeSearchState;
  results: ExchangeSearchResult[];
  total: number;
  mapped: number;
  offMap: number;
}

export interface SearchSuggestion {
  id: string;
  kind: SearchSuggestionKind;
  label: string;
  description: string;
  query: string;
}

export interface SavedSearch {
  id: string;
  name: string;
  lens: ExchangeLens;
  state: ExchangeSearchState;
  createdAt: string;
}

export interface RecentSearch {
  id: string;
  lens: ExchangeLens;
  state: ExchangeSearchState;
  createdAt: string;
}

export interface ExchangeViewState {
  lens: ExchangeLens;
  search: ExchangeSearchState;
  drawer: DrawerState;
  selectedRecordId?: string;
  detailRecordId?: string;
  menuOpen: boolean;
}
