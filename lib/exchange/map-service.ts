import type {
  Coordinates,
  ExchangeLens,
  ExchangeRecord,
  MapBounds,
  MapGeographyOption,
  MapHighlight,
  MapViewState,
} from "./contracts";
import { MAP_ZOOM_LIMITS } from "./map-model";

export interface ExchangeMapFeature {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: {
    recordId: string;
    title: string;
    organization: string;
    lens: ExchangeLens;
    owned: boolean;
    sponsored: boolean;
    featured: boolean;
    color: string;
  };
}

export interface ExchangeMapFeatureCollection {
  type: "FeatureCollection";
  features: ExchangeMapFeature[];
}

export type ExchangeMapBeaconKind = "highlight" | "focus";
export interface ExchangeMapBeaconInput { record: ExchangeRecord; kind: ExchangeMapBeaconKind; height: number; }
export interface ExchangeMapBeaconFeature {
  type: "Feature";
  geometry: { type: "Polygon"; coordinates: [number, number][][] };
  properties: {
    recordId: string;
    part: "mast" | "crown";
    kind: ExchangeMapBeaconKind;
    height: number;
    base: number;
    color: string;
  };
}
export interface ExchangeMapBeaconFeatureCollection { type: "FeatureCollection"; features: ExchangeMapBeaconFeature[]; }

export const MAP_BEACON_HEIGHTS = { highlight: 360, focus: 900 } as const;
export const MAP_BEACON_MAX_HIGHLIGHTS = 8;

const lensColors: Record<ExchangeLens, string> = {
  rfx: "#2e5eaa",
  resources: "#3b7b57",
  intelligence: "#8a6418",
  capabilities: "#252932",
};

function finiteCoordinate(location?: Coordinates): location is Coordinates {
  return Boolean(location && Number.isFinite(location.lat) && Number.isFinite(location.lng));
}

function recordIsSponsored(record: ExchangeRecord) {
  return record.card?.placement === "sponsored" || Boolean(record.resource?.sponsored);
}

function recordColor(record: ExchangeRecord, lens: ExchangeLens) {
  if (record.ownedByViewer) return "#d6a23a";
  if (recordIsSponsored(record)) return "#b86b18";
  return lensColors[lens];
}

export function mapHighlightForRecord(record: ExchangeRecord): MapHighlight | undefined {
  if (record.mapHighlight?.active === false) return undefined;
  if (record.mapHighlight) return record.mapHighlight;
  if (recordIsSponsored(record)) return { reason: "sponsored", priority: 80 };
  if (record.featured) return { reason: "featured", priority: 60 };
  return undefined;
}

export function selectMapHighlightRecords(records: ExchangeRecord[], excludedRecordId?: string, limit = MAP_BEACON_MAX_HIGHLIGHTS) {
  return records
    .filter((record) => record.id !== excludedRecordId && finiteCoordinate(record.location) && Boolean(mapHighlightForRecord(record)))
    .sort((a, b) => {
      const priorityDelta = (mapHighlightForRecord(b)?.priority ?? 0) - (mapHighlightForRecord(a)?.priority ?? 0);
      return priorityDelta || a.id.localeCompare(b.id);
    })
    .slice(0, limit);
}

function circlePolygon(location: Coordinates, radiusMeters: number, segments = 14): [number, number][] {
  const latitudeRadians = location.lat * Math.PI / 180;
  const latitudeDegreesPerMeter = 1 / 111_320;
  const longitudeDegreesPerMeter = 1 / (111_320 * Math.max(0.2, Math.abs(Math.cos(latitudeRadians))));
  const ring: [number, number][] = [];
  for (let index = 0; index < segments; index += 1) {
    const angle = index / segments * Math.PI * 2;
    ring.push([
      location.lng + Math.cos(angle) * radiusMeters * longitudeDegreesPerMeter,
      location.lat + Math.sin(angle) * radiusMeters * latitudeDegreesPerMeter,
    ]);
  }
  ring.push(ring[0]);
  return ring;
}

function beaconColor(kind: ExchangeMapBeaconKind) {
  return kind === "focus" ? "#d6a23a" : "#8a6418";
}

export function toExchangeMapBeaconFeatureCollection(beacons: ExchangeMapBeaconInput[]): ExchangeMapBeaconFeatureCollection {
  return {
    type: "FeatureCollection",
    features: beacons.flatMap((beacon) => {
      const location = beacon.record.location;
      if (!finiteCoordinate(location) || beacon.height <= 0.5) return [];
      const focusProgress = Math.min(1, Math.max(0, beacon.height / MAP_BEACON_HEIGHTS.focus));
      const mastRadius = 5 + 4 * focusProgress;
      const crownRadius = 18 + 20 * focusProgress;
      const crownDepth = Math.min(110, Math.max(36, beacon.height * 0.12));
      const color = beaconColor(beacon.kind);
      return [
        {
          type: "Feature" as const,
          geometry: { type: "Polygon" as const, coordinates: [circlePolygon(location, mastRadius)] },
          properties: { recordId: beacon.record.id, part: "mast" as const, kind: beacon.kind, height: beacon.height, base: 0, color },
        },
        {
          type: "Feature" as const,
          geometry: { type: "Polygon" as const, coordinates: [circlePolygon(location, crownRadius)] },
          properties: { recordId: beacon.record.id, part: "crown" as const, kind: beacon.kind, height: beacon.height + 22, base: Math.max(0, beacon.height - crownDepth), color },
        },
      ];
    }),
  };
}

export function toExchangeMapFeatureCollection(records: ExchangeRecord[], lens: ExchangeLens): ExchangeMapFeatureCollection {
  return {
    type: "FeatureCollection",
    features: records.flatMap((record) => {
      if (!finiteCoordinate(record.location)) return [];
      return [{
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [record.location.lng, record.location.lat] as [number, number] },
        properties: {
          recordId: record.id,
          title: record.title,
          organization: record.organization,
          lens,
          owned: Boolean(record.ownedByViewer),
          sponsored: recordIsSponsored(record),
          featured: Boolean(record.featured),
          color: recordColor(record, lens),
        },
      }];
    }),
  };
}

export function boundsContain(bounds: MapBounds, coordinate: Coordinates) {
  const longitudeInside = bounds.west <= bounds.east
    ? coordinate.lng >= bounds.west && coordinate.lng <= bounds.east
    : coordinate.lng >= bounds.west || coordinate.lng <= bounds.east;
  return coordinate.lat >= bounds.south && coordinate.lat <= bounds.north && longitudeInside;
}

/**
 * Viewport scope never discards off-map records. The source architecture makes
 * the drawer authoritative and the map a visualization of the located subset.
 */
export function scopeMapRecordsToBounds(records: ExchangeRecord[], bounds?: MapBounds) {
  if (!bounds) return records;
  return records.filter((record) => !finiteCoordinate(record.location) || boundsContain(bounds, record.location));
}

export function mapBoundsEqual(a?: MapBounds, b?: MapBounds, tolerance = 0.0005) {
  if (!a || !b) return a === b;
  return Math.abs(a.north - b.north) <= tolerance
    && Math.abs(a.south - b.south) <= tolerance
    && Math.abs(a.east - b.east) <= tolerance
    && Math.abs(a.west - b.west) <= tolerance;
}

function boundsFromCoordinates(coordinates: Coordinates[]): MapBounds | undefined {
  if (!coordinates.length) return undefined;
  return coordinates.reduce<MapBounds>((bounds, coordinate) => ({
    north: Math.max(bounds.north, coordinate.lat),
    south: Math.min(bounds.south, coordinate.lat),
    east: Math.max(bounds.east, coordinate.lng),
    west: Math.min(bounds.west, coordinate.lng),
  }), {
    north: coordinates[0].lat,
    south: coordinates[0].lat,
    east: coordinates[0].lng,
    west: coordinates[0].lng,
  });
}

function centerForBounds(bounds: MapBounds): Coordinates {
  return { lat: (bounds.north + bounds.south) / 2, lng: (bounds.east + bounds.west) / 2 };
}

function zoomForBounds(bounds: MapBounds) {
  const span = Math.max(Math.abs(bounds.north - bounds.south), Math.abs(bounds.east - bounds.west));
  if (span < 0.03) return 12.4;
  if (span < 0.08) return 11.5;
  if (span < 0.2) return 10.5;
  if (span < 0.5) return 9.6;
  return 8.7;
}

/** Derives geography choices only from the records actually available to the lens. */
export function deriveMapGeographies(records: ExchangeRecord[]): MapGeographyOption[] {
  const byLabel = new Map<string, ExchangeRecord[]>();
  for (const record of records) {
    const group = byLabel.get(record.geography) ?? [];
    group.push(record);
    byLabel.set(record.geography, group);
  }

  return [...byLabel.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, geographyRecords]) => {
      const coordinates = geographyRecords.flatMap((record) => finiteCoordinate(record.location) ? [record.location] : []);
      const bounds = boundsFromCoordinates(coordinates);
      return {
        id: label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
        label,
        center: bounds ? centerForBounds(bounds) : undefined,
        bounds,
        recordCount: geographyRecords.length,
      };
    });
}

export function viewForGeography(current: MapViewState, geography: MapGeographyOption): MapViewState {
  if (!geography.center) {
    return {
      ...current,
      geography: { id: geography.id, label: geography.label, scope: "selected" },
      queriedBounds: undefined,
    };
  }
  const zoom = geography.bounds ? zoomForBounds(geography.bounds) : current.camera.zoom;
  return {
    ...current,
    camera: {
      ...current.camera,
      center: geography.center,
      zoom: Math.min(MAP_ZOOM_LIMITS.max, Math.max(MAP_ZOOM_LIMITS.min, zoom)),
    },
    geography: { id: geography.id, label: geography.label, scope: "selected" },
    queriedBounds: undefined,
  };
}

export function viewForCurrentLocation(current: MapViewState, coordinate: Coordinates): MapViewState {
  return {
    ...current,
    camera: { ...current.camera, center: coordinate, zoom: Math.max(current.camera.zoom, 11.5) },
    geography: { id: "current-location", label: "Near my location", scope: "selected" },
    queriedBounds: undefined,
  };
}
