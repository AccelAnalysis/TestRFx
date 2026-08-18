export type ExchangeLens = "rfx" | "resources" | "intelligence" | "capabilities";
export type DrawerState = "peek" | "mid" | "expanded";
export type ExchangeRecordType = "rfx" | "resource" | "intelligence" | "capability";

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

export interface ExchangeViewState {
  lens: ExchangeLens;
  search: string;
  drawer: DrawerState;
  selectedRecordId?: string;
  detailRecordId?: string;
  menuOpen: boolean;
}
