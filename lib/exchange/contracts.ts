export type ExchangeLens = "rfx" | "resources" | "intelligence" | "capabilities";
export type DrawerState = "peek" | "mid" | "expanded";
export type ExchangeRecordType = "rfx" | "resource" | "intelligence" | "capability";
export type ExchangeCardPlacement = "organic" | "featured" | "sponsored";
export type ExchangeCardMediaKind = "category" | "logo" | "image" | "visualization";
export type ExchangeStatusTone = "neutral" | "info" | "success" | "warning" | "critical";
export type ExchangeRelationshipState =
  | "saved"
  | "watched"
  | "following"
  | "referred"
  | "responded"
  | "teamed"
  | "requested"
  | "connected"
  | "owned";

export type Coordinates = { lat: number; lng: number };

export interface ExchangeCardMedia {
  kind: ExchangeCardMediaKind;
  label: string;
  src?: string;
  alt?: string;
}

export interface ExchangeCardStatus {
  label: string;
  tone?: ExchangeStatusTone;
}

export interface ExchangeCardProjection {
  eyebrow?: string;
  media?: ExchangeCardMedia;
  classifications?: string[];
  status?: ExchangeCardStatus;
  relationships?: ExchangeRelationshipState[];
  placement?: ExchangeCardPlacement;
  distance?: string;
}

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
  card?: ExchangeCardProjection;
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
