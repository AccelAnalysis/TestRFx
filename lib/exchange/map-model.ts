import type {
  Coordinates,
  ExchangeLens,
  ExchangeRecord,
  MapBounds,
  MapCamera,
  MapViewState,
} from "./contracts";

const REFERENCE_LONGITUDE_SPAN = 0.78;
const REFERENCE_LATITUDE_SPAN = 0.42;
const DEFAULT_ZOOM = 9.4;

export const MAP_ZOOM_LIMITS = { min: 7.5, max: 13.5 } as const;

export const DEFAULT_MAP_VIEW: MapViewState = {
  camera: {
    center: { lat: 36.84, lng: -76.47 },
    zoom: DEFAULT_ZOOM,
    bearing: 0,
    pitch: 0,
    mode: "2d",
  },
  geography: {
    id: "hampton-roads-reference",
    label: "Hampton Roads, VA",
    scope: "reference",
  },
  style: "standard",
  layers: { records: true, lensOverlay: true },
};

export type MapOverlayMode = "points" | "availability" | "heat" | "density";

export interface LensMapPresentation {
  label: string;
  shortLabel: string;
  overlay: MapOverlayMode;
}

export const lensMapPresentations: Record<ExchangeLens, LensMapPresentation> = {
  rfx: { label: "RFx opportunities", shortLabel: "RFx", overlay: "points" },
  resources: { label: "Resources", shortLabel: "Resources", overlay: "availability" },
  intelligence: { label: "Market intelligence", shortLabel: "Intelligence", overlay: "heat" },
  capabilities: { label: "Organization capabilities", shortLabel: "Capabilities", overlay: "density" },
};

export interface ProjectedPoint { left: number; top: number; visible: boolean; }
export interface MapMarkerGroup { id: string; records: ExchangeRecord[]; coordinate: Coordinates; projected: ProjectedPoint; cluster: boolean; }
export interface MapResultSummary { total: number; mapped: number; offMap: number; }

function clamp(value: number, min: number, max: number) { return Math.max(min, Math.min(max, value)); }
function scaleForZoom(zoom: number) { return Math.pow(2, (zoom - DEFAULT_ZOOM) / 2); }

export function createDefaultMapView(): MapViewState {
  return {
    camera: { ...DEFAULT_MAP_VIEW.camera, center: { ...DEFAULT_MAP_VIEW.camera.center } },
    geography: { ...DEFAULT_MAP_VIEW.geography },
    style: DEFAULT_MAP_VIEW.style,
    layers: { ...DEFAULT_MAP_VIEW.layers },
  };
}

export function summarizeMapRecords(records: ExchangeRecord[]): MapResultSummary {
  const mapped = records.filter((record) => record.location).length;
  return { total: records.length, mapped, offMap: records.length - mapped };
}

/** Compatibility projection helper retained for non-provider consumers. Live rendering is MapLibre-backed. */
export function projectCoordinate(coordinate: Coordinates, camera: MapCamera): ProjectedPoint {
  const scale = scaleForZoom(camera.zoom);
  const left = 50 + ((coordinate.lng - camera.center.lng) / REFERENCE_LONGITUDE_SPAN) * 100 * scale;
  const top = 50 + ((camera.center.lat - coordinate.lat) / REFERENCE_LATITUDE_SPAN) * 100 * scale;
  return { left, top, visible: left >= -8 && left <= 108 && top >= -8 && top <= 108 };
}

export function mapBoundsForCamera(camera: MapCamera): MapBounds {
  const scale = scaleForZoom(camera.zoom);
  const halfLng = REFERENCE_LONGITUDE_SPAN / (2 * scale);
  const halfLat = REFERENCE_LATITUDE_SPAN / (2 * scale);
  return { north: camera.center.lat + halfLat, south: camera.center.lat - halfLat, east: camera.center.lng + halfLng, west: camera.center.lng - halfLng };
}

export function zoomMapCamera(camera: MapCamera, delta: number): MapCamera {
  return { ...camera, zoom: clamp(camera.zoom + delta, MAP_ZOOM_LIMITS.min, MAP_ZOOM_LIMITS.max) };
}

export function panMapCamera(camera: MapCamera, deltaX: number, deltaY: number, width: number, height: number): MapCamera {
  const scale = scaleForZoom(camera.zoom);
  const lngPerPixel = REFERENCE_LONGITUDE_SPAN / (Math.max(width, 1) * scale);
  const latPerPixel = REFERENCE_LATITUDE_SPAN / (Math.max(height, 1) * scale);
  return { ...camera, center: { lat: clamp(camera.center.lat + deltaY * latPerPixel, 35.2, 38.4), lng: clamp(camera.center.lng - deltaX * lngPerPixel, -79.8, -74.2) } };
}

export function toggleMapDisplayMode(camera: MapCamera): MapCamera {
  const mode = camera.mode === "2d" ? "3d" : "2d";
  return { ...camera, mode, pitch: mode === "3d" ? 42 : 0 };
}

function averageCoordinate(records: ExchangeRecord[]): Coordinates {
  const located = records.flatMap((record) => (record.location ? [record.location] : []));
  const total = located.reduce((sum, coordinate) => ({ lat: sum.lat + coordinate.lat, lng: sum.lng + coordinate.lng }), { lat: 0, lng: 0 });
  return { lat: total.lat / located.length, lng: total.lng / located.length };
}

/** Compatibility grouping helper; production clustering is now delegated to the MapLibre GeoJSON source. */
export function buildMarkerGroups(records: ExchangeRecord[], camera: MapCamera, selectedRecordId?: string): MapMarkerGroup[] {
  const located = records.filter((record): record is ExchangeRecord & { location: Coordinates } => Boolean(record.location));
  const selected = located.filter((record) => record.id === selectedRecordId);
  const candidates = located.filter((record) => record.id !== selectedRecordId);
  const singleton = (record: ExchangeRecord & { location: Coordinates }): MapMarkerGroup => ({ id: record.id, records: [record], coordinate: record.location, projected: projectCoordinate(record.location, camera), cluster: false });
  if (camera.zoom >= 11.15) return [...selected.map(singleton), ...candidates.map(singleton)];
  const threshold = camera.zoom < 9 ? 9 : 6.5;
  const groups: Array<Array<ExchangeRecord & { location: Coordinates }>> = [];
  for (const record of candidates) {
    const point = projectCoordinate(record.location, camera);
    const match = groups.find((group) => Math.hypot(point.left - projectCoordinate(averageCoordinate(group), camera).left, point.top - projectCoordinate(averageCoordinate(group), camera).top) <= threshold);
    if (match) match.push(record); else groups.push([record]);
  }
  return [...selected.map(singleton), ...groups.map((group) => { const coordinate = averageCoordinate(group); return { id: group.length === 1 ? group[0].id : `cluster:${group.map((record) => record.id).sort().join(",")}`, records: group, coordinate, projected: projectCoordinate(coordinate, camera), cluster: group.length > 1 }; })];
}
