export type ExchangeLens = "rfx" | "resources" | "intelligence" | "capabilities";
export type DrawerState = "peek" | "mid" | "expanded";
export type DrawerResultStatus = "ready" | "loading" | "refreshing" | "error" | "offline";
export type DrawerSort = "relevance" | "title" | "organization" | "geography";
export type DrawerLocationFilter = "all" | "mapped" | "off-map";
export type DrawerOwnershipFilter = "all" | "mine" | "others";
export type ExchangeRecordType = "rfx" | "resource" | "intelligence" | "capability";
export type SearchSort = "relevance" | "title" | "geography";
export type SearchLocationMode = "all" | "mapped" | "off-map";
export type SearchOwnership = "all" | "mine" | "others";
export type SearchSuggestionKind = "record" | "organization" | "geography" | "metadata";
export type MapDisplayMode = "2d" | "3d";
export type MapStyleId = "standard" | "bright" | "light" | "dark" | "muted";
export type MapControlRoute = "root" | "view" | "basemap" | "layers" | "geography";
export type GeolocationStatus = "idle" | "requesting" | "located" | "denied" | "unavailable";
export type RecordRelationshipFilter = "all" | "mine" | "others";
export type ExchangeCardPlacement = "organic" | "featured" | "sponsored";
export type ExchangeCardMediaKind = "category" | "logo" | "image" | "visualization";
export type ExchangeStatusTone = "neutral" | "info" | "success" | "warning" | "critical";
export type ExchangeRelationshipState = "saved" | "watched" | "following" | "referred" | "responded" | "teamed" | "requested" | "connected" | "owned";
export type LensActionTrigger = "detail" | "modal" | "menu" | "direct" | "workflow";
export type LensActionOwnership = "own" | "other" | "any";
export type LensActionToggle = "save" | "watch" | "track" | "follow";
export type ResourceAvailabilityState = "available" | "limited" | "scheduled";
export type ResourceVisibility = "public-location" | "service-area" | "off-map";
export type ResourceStatus = "active" | "archived";
export type MapHighlightReason = "featured" | "sponsored" | "verified" | "recommended" | "time-sensitive" | "program" | "custom";

export type Coordinates = { lat: number; lng: number };
export interface MapCamera { center: Coordinates; zoom: number; bearing: number; pitch: number; mode: MapDisplayMode; }
export interface MapBounds { north: number; south: number; east: number; west: number; }
export interface MapGeographyContext { id: string; label: string; scope: "authorized" | "selected" | "reference"; }
export interface MapLayerVisibility { records: boolean; lensOverlay: boolean; }
export interface MapGeographyOption { id: string; label: string; center?: Coordinates; bounds?: MapBounds; recordCount: number; }
export interface MapViewState { camera: MapCamera; geography: MapGeographyContext; style: MapStyleId; layers: MapLayerVisibility; currentBounds?: MapBounds; queriedBounds?: MapBounds; }
export interface DrawerQueryState { sort: DrawerSort; location: DrawerLocationFilter; ownership: DrawerOwnershipFilter; savedOnly: boolean; featuredOnly: boolean; }
export interface ExchangeCardMedia { kind: ExchangeCardMediaKind; label: string; src?: string; alt?: string; }
export interface ExchangeCardStatus { label: string; tone?: ExchangeStatusTone; }
export interface ExchangeCardProjection { eyebrow?: string; media?: ExchangeCardMedia; classifications?: string[]; status?: ExchangeCardStatus; relationships?: ExchangeRelationshipState[]; placement?: ExchangeCardPlacement; distance?: string; }
export interface ResourceProjection {
  category: string;
  availability: ResourceAvailabilityState;
  availabilityLabel: string;
  capacity?: string;
  serviceArea?: string;
  visibility: ResourceVisibility;
  terms?: string;
  status: ResourceStatus;
  sponsored?: boolean;
}
export interface MapHighlight { reason: MapHighlightReason; priority?: number; active?: boolean; }

export interface ExchangeRecord {
  id: string; type: ExchangeRecordType; title: string; organization: string; summary: string; geography: string; metadata: string[];
  location?: Coordinates; ownedByViewer?: boolean; featured?: boolean; saved?: boolean; card?: ExchangeCardProjection; resource?: ResourceProjection;
  mapHighlight?: MapHighlight;
}

export interface LensAction {
  id: string; position: 1 | 2 | 3 | 4; label: string; icon: string;
  trigger: LensActionTrigger; ownership: LensActionOwnership;
  visible: boolean; applicable: boolean; authorized: boolean; operational: boolean; prerequisitesSatisfied: boolean;
  requiresRecord?: boolean; toggle?: LensActionToggle; unavailableReason?: string;
}
export interface ExchangeLensDefinition { id: ExchangeLens; label: string; icon: string; searchPlaceholder: string; emptyMessage: string; actions: (record?: ExchangeRecord) => LensAction[]; }

export interface ExchangeSearchFilters { geography: string; location: SearchLocationMode; ownership: SearchOwnership; metadata: string[]; }
export interface ExchangeSearchState { query: string; filters: ExchangeSearchFilters; sort: SearchSort; }
export interface ExchangeSearchMatch { score: number; matchedFields: string[]; }
export interface ExchangeSearchResult { record: ExchangeRecord; match: ExchangeSearchMatch; }
export interface ExchangeSearchResponse { lens: ExchangeLens; state: ExchangeSearchState; results: ExchangeSearchResult[]; total: number; mapped: number; offMap: number; }
export interface SearchSuggestion { id: string; kind: SearchSuggestionKind; label: string; description: string; query: string; }
export interface SavedSearch { id: string; name: string; lens: ExchangeLens; state: ExchangeSearchState; createdAt: string; }
export interface RecentSearch { id: string; lens: ExchangeLens; state: ExchangeSearchState; createdAt: string; }
export interface ExchangeFilters { geography?: string; relationship: RecordRelationshipFilter; mappedOnly: boolean; featuredOnly: boolean; metadata: string[]; }
export interface ExchangeMapState { displayMode: MapDisplayMode; geolocationStatus: GeolocationStatus; viewerLocation?: Coordinates; viewportDirty: boolean; resetKey: number; }

export interface ExchangeViewState {
  lens: ExchangeLens; search: ExchangeSearchState; filtersByLens: Record<ExchangeLens, ExchangeFilters>;
  drawer: DrawerState; drawerQuery?: DrawerQueryState; map: MapViewState;
  selectedRecordId?: string; detailRecordId?: string; menuOpen: boolean;
}
