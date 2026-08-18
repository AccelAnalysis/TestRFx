export type ExchangeLens = "rfx" | "resources" | "intelligence" | "capabilities";
export type DrawerState = "peek" | "mid" | "expanded";
export type ExchangeRecordType = "rfx" | "resource" | "intelligence" | "capability";
export type MapDisplayMode = "2d" | "3d";
export type GeolocationStatus = "idle" | "requesting" | "located" | "denied" | "unavailable";
export type RecordRelationshipFilter = "all" | "mine" | "others";

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

export interface ExchangeFilters {
  geography?: string;
  relationship: RecordRelationshipFilter;
  mappedOnly: boolean;
  featuredOnly: boolean;
  metadata: string[];
}

export interface ExchangeMapState {
  displayMode: MapDisplayMode;
  geolocationStatus: GeolocationStatus;
  viewerLocation?: Coordinates;
  viewportDirty: boolean;
  resetKey: number;
}

export interface ExchangeViewState {
  lens: ExchangeLens;
  search: string;
  filtersByLens: Record<ExchangeLens, ExchangeFilters>;
  drawer: DrawerState;
  selectedRecordId?: string;
  detailRecordId?: string;
  menuOpen: boolean;
  map: ExchangeMapState;
}
