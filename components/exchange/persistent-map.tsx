"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import type { Coordinates, DrawerState, ExchangeLens, ExchangeRecord, MapBounds, MapViewState } from "@/lib/exchange/contracts";
import { summarizeMapRecords } from "@/lib/exchange/map-model";
import {
  MAP_PIN_ALTITUDES,
  MAP_PIN_SCALES,
  mapHighlightForRecord,
  selectMapHighlightRecords,
  toExchangeMapFeatureCollection,
} from "@/lib/exchange/map-service";
import {
  EXCHANGE_PIN_LAYER_ID,
  ExchangePinLayer,
  type ExchangeMapPinRenderState,
} from "@/lib/exchange/map-pin-layer";
import { mapStyleUrl } from "@/lib/exchange/map-styles";
import styles from "./persistent-map.module.css";

const RECORD_SOURCE = "exchange-records";
const SELECTED_SOURCE = "exchange-selected";
const OVERLAY_SOURCE = "exchange-overlay";
const LOCATION_SOURCE = "viewer-location";
const CLUSTER_LAYER = "exchange-clusters";
const CLUSTER_COUNT_LAYER = "exchange-cluster-count";
const RECORD_LAYER = "exchange-record-points";
const SELECTED_LAYER = "exchange-selected-point";
const OVERLAY_LAYER = "exchange-lens-overlay";
const LOCATION_LAYER = "viewer-location-point";

const EMPTY_GEOJSON = { type: "FeatureCollection" as const, features: [] };
const FOCUS_TRANSITION_MS = 420;
const HIGHLIGHT_OPACITY = 0.9;

type PinMotionState = { altitude: number; scale: number; opacity: number };
type TransientPin = { record: ExchangeRecord; state: PinMotionState };

function layerVisibility(visible: boolean) { return visible ? "visible" : "none"; }
function easeOutCubic(progress: number) { return 1 - Math.pow(1 - progress, 3); }
function interpolate(start: number, end: number, progress: number) { return start + (end - start) * progress; }
function reducedMotionRequested() { return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches; }

function currentBounds(map: MapLibreMap): MapBounds {
  const bounds = map.getBounds();
  return { north: bounds.getNorth(), south: bounds.getSouth(), east: bounds.getEast(), west: bounds.getWest() };
}

function overlayHeatColor(lens: ExchangeLens) {
  if (lens === "capabilities") {
    return ["interpolate", ["linear"], ["heatmap-density"], 0, "rgba(46,94,170,0)", 0.25, "rgba(46,94,170,.2)", 0.55, "rgba(46,94,170,.5)", 0.8, "rgba(37,41,50,.65)", 1, "rgba(11,11,13,.82)"];
  }
  return ["interpolate", ["linear"], ["heatmap-density"], 0, "rgba(214,162,58,0)", 0.25, "rgba(214,162,58,.22)", 0.55, "rgba(214,162,58,.5)", 0.8, "rgba(138,100,24,.7)", 1, "rgba(83,61,18,.86)"];
}

function installExchangeLayers(map: MapLibreMap, pinLayer: ExchangePinLayer) {
  if (!map.getSource(OVERLAY_SOURCE)) map.addSource(OVERLAY_SOURCE, { type: "geojson", data: EMPTY_GEOJSON });
  if (!map.getLayer(OVERLAY_LAYER)) {
    map.addLayer({
      id: OVERLAY_LAYER,
      type: "heatmap",
      source: OVERLAY_SOURCE,
      maxzoom: 15,
      paint: {
        "heatmap-weight": 1,
        "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 7, 0.7, 13, 1.8],
        "heatmap-color": overlayHeatColor("intelligence") as never,
        "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 7, 18, 13, 44],
        "heatmap-opacity": 0.82,
      },
    });
  }

  if (!map.getSource(RECORD_SOURCE)) map.addSource(RECORD_SOURCE, { type: "geojson", data: EMPTY_GEOJSON, cluster: true, clusterMaxZoom: 12, clusterRadius: 46 });
  if (!map.getLayer(CLUSTER_LAYER)) map.addLayer({ id: CLUSTER_LAYER, type: "circle", source: RECORD_SOURCE, filter: ["has", "point_count"], paint: { "circle-color": "#252932", "circle-radius": ["step", ["get", "point_count"], 18, 10, 23, 30, 28], "circle-stroke-color": "#ffffff", "circle-stroke-width": 2.5, "circle-opacity": 0.94 } });
  if (!map.getLayer(CLUSTER_COUNT_LAYER)) map.addLayer({ id: CLUSTER_COUNT_LAYER, type: "symbol", source: RECORD_SOURCE, filter: ["has", "point_count"], layout: { "text-field": ["get", "point_count_abbreviated"], "text-size": 11 }, paint: { "text-color": "#ffffff" } });
  if (!map.getLayer(RECORD_LAYER)) map.addLayer({ id: RECORD_LAYER, type: "circle", source: RECORD_SOURCE, filter: ["!", ["has", "point_count"]], paint: { "circle-color": ["get", "color"], "circle-radius": ["case", ["==", ["get", "sponsored"], true], 9, 8], "circle-stroke-color": ["case", ["==", ["get", "sponsored"], true], "#b86b18", "#ffffff"], "circle-stroke-width": ["case", ["==", ["get", "sponsored"], true], 3.5, 2.5], "circle-opacity": 0.95 } });

  if (!map.getLayer(EXCHANGE_PIN_LAYER_ID)) map.addLayer(pinLayer);

  if (!map.getSource(SELECTED_SOURCE)) map.addSource(SELECTED_SOURCE, { type: "geojson", data: EMPTY_GEOJSON });
  if (!map.getLayer(SELECTED_LAYER)) map.addLayer({ id: SELECTED_LAYER, type: "circle", source: SELECTED_SOURCE, paint: { "circle-color": "#d6a23a", "circle-radius": 11, "circle-stroke-color": "#ffffff", "circle-stroke-width": 3.5, "circle-opacity": 1 } });

  if (!map.getSource(LOCATION_SOURCE)) map.addSource(LOCATION_SOURCE, { type: "geojson", data: EMPTY_GEOJSON });
  if (!map.getLayer(LOCATION_LAYER)) map.addLayer({ id: LOCATION_LAYER, type: "circle", source: LOCATION_SOURCE, paint: { "circle-color": "#2e5eaa", "circle-radius": 7, "circle-stroke-color": "#ffffff", "circle-stroke-width": 3 } });
}

function basePinState(record?: ExchangeRecord): PinMotionState {
  if (record?.location && mapHighlightForRecord(record)) {
    return { altitude: MAP_PIN_ALTITUDES.highlight, scale: MAP_PIN_SCALES.highlight, opacity: HIGHLIGHT_OPACITY };
  }
  return { altitude: 0, scale: MAP_PIN_SCALES.transition, opacity: 0 };
}

const focusPinState: PinMotionState = { altitude: MAP_PIN_ALTITUDES.focus, scale: MAP_PIN_SCALES.focus, opacity: 1 };

export function PersistentMap({ lens, records, selectedRecordId, drawerState, view, viewerLocation, onViewChange, onSelect, onViewportInteraction }: {
  lens: ExchangeLens;
  records: ExchangeRecord[];
  selectedRecordId?: string;
  drawerState: DrawerState;
  view: MapViewState;
  viewerLocation?: Coordinates;
  onViewChange: (view: MapViewState) => void;
  onSelect: (id: string) => void;
  onViewportInteraction?: () => void;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const pinLayerRef = useRef<ExchangePinLayer | null>(null);
  const activeStyleUrlRef = useRef<string | undefined>(undefined);
  const viewRef = useRef(view);
  const selectRef = useRef(onSelect);
  const viewChangeRef = useRef(onViewChange);
  const viewportInteractionRef = useRef(onViewportInteraction);
  const focusedRecordRef = useRef<ExchangeRecord | undefined>(undefined);
  const pinMotionRef = useRef<Map<string, PinMotionState>>(new Map());
  const pinAnimationFrameRef = useRef<number | undefined>(undefined);
  const [styleReady, setStyleReady] = useState(false);
  const [loadError, setLoadError] = useState<string>();
  const summary = useMemo(() => summarizeMapRecords(records), [records]);

  useEffect(() => { viewRef.current = view; }, [view]);
  useEffect(() => { selectRef.current = onSelect; }, [onSelect]);
  useEffect(() => { viewChangeRef.current = onViewChange; }, [onViewChange]);
  useEffect(() => { viewportInteractionRef.current = onViewportInteraction; }, [onViewportInteraction]);

  useEffect(() => {
    let cancelled = false;
    let map: MapLibreMap | undefined;

    async function start() {
      const maplibregl = await import("maplibre-gl");
      if (cancelled || !hostRef.current) return;
      const initial = viewRef.current;
      const initialStyleUrl = mapStyleUrl(initial.style);
      activeStyleUrlRef.current = initialStyleUrl;
      const pinLayer = new ExchangePinLayer(maplibregl.MercatorCoordinate);
      pinLayerRef.current = pinLayer;
      map = new maplibregl.Map({
        container: hostRef.current,
        style: initialStyleUrl,
        center: [initial.camera.center.lng, initial.camera.center.lat],
        zoom: initial.camera.zoom,
        bearing: initial.camera.bearing,
        pitch: initial.camera.pitch,
        maxPitch: 60,
        canvasContextAttributes: { antialias: true },
        attributionControl: { compact: true },
      });
      mapRef.current = map;
      map.dragRotate.disable();
      map.touchZoomRotate.disableRotation();

      map.on("error", (event) => {
        if (event.error && !map?.isStyleLoaded()) setLoadError("The live map provider could not load its style or tiles. Exchange results remain available in the drawer.");
      });

      const markStyleReady = () => {
        if (!map || !pinLayerRef.current) return;
        installExchangeLayers(map, pinLayerRef.current);
        setLoadError(undefined);
        setStyleReady(true);
        const current = viewRef.current;
        viewChangeRef.current({ ...current, currentBounds: currentBounds(map) });
      };

      map.on("style.load", markStyleReady);
      map.on("load", () => {
        if (!map || !pinLayerRef.current) return;
        installExchangeLayers(map, pinLayerRef.current);

        map.on("click", async (event) => {
          if (!map) return;
          const pinRecordId = pinLayerRef.current?.hitTest(event.point.x, event.point.y);
          if (pinRecordId) {
            selectRef.current(pinRecordId);
            return;
          }

          const firstFeature = (layer: string) => map?.getLayer(layer)
            ? map.queryRenderedFeatures(event.point, { layers: [layer] })[0]
            : undefined;
          const selectedFeature = firstFeature(SELECTED_LAYER);
          const recordFeature = firstFeature(RECORD_LAYER);
          const clusterFeature = firstFeature(CLUSTER_LAYER);
          const recordId = selectedFeature?.properties?.recordId ?? recordFeature?.properties?.recordId;
          if (typeof recordId === "string") {
            selectRef.current(recordId);
            return;
          }

          const clusterId = Number(clusterFeature?.properties?.cluster_id);
          if (!clusterFeature || !Number.isFinite(clusterId)) return;
          viewportInteractionRef.current?.();
          const source = map.getSource(RECORD_SOURCE) as GeoJSONSource | undefined;
          const zoom = source ? await source.getClusterExpansionZoom(clusterId) : undefined;
          const coordinates = clusterFeature.geometry.type === "Point" ? clusterFeature.geometry.coordinates : undefined;
          if (zoom !== undefined && coordinates) map.easeTo({ center: coordinates as [number, number], zoom });
        });

        map.on("mousemove", (event) => {
          if (!map) return;
          const pinHit = Boolean(pinLayerRef.current?.hitTest(event.point.x, event.point.y));
          const interactiveLayers = [SELECTED_LAYER, RECORD_LAYER, CLUSTER_LAYER].filter((layer) => Boolean(map?.getLayer(layer)));
          const mapHit = interactiveLayers.length > 0 && map.queryRenderedFeatures(event.point, { layers: interactiveLayers }).length > 0;
          map.getCanvas().style.cursor = pinHit || mapHit ? "pointer" : "";
        });

        map.on("dragstart", (event) => { if (event.originalEvent) viewportInteractionRef.current?.(); });
        map.on("zoomstart", (event) => { if (event.originalEvent) viewportInteractionRef.current?.(); });
        map.on("moveend", () => {
          if (!map) return;
          const center = map.getCenter();
          const current = viewRef.current;
          viewChangeRef.current({
            ...current,
            camera: { ...current.camera, center: { lat: center.lat, lng: center.lng }, zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch(), mode: map.getPitch() > 1 ? "3d" : "2d" },
            currentBounds: currentBounds(map),
          });
        });

        markStyleReady();
      });
    }

    start().catch(() => setLoadError("The live map service could not initialize. Exchange results remain available in the drawer."));
    return () => {
      cancelled = true;
      if (pinAnimationFrameRef.current !== undefined) cancelAnimationFrame(pinAnimationFrameRef.current);
      setStyleReady(false);
      mapRef.current?.remove();
      mapRef.current = null;
      pinLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const nextStyleUrl = mapStyleUrl(view.style);
    if (activeStyleUrlRef.current === nextStyleUrl) return;
    activeStyleUrlRef.current = nextStyleUrl;
    setLoadError(undefined);
    setStyleReady(false);
    map.setStyle(nextStyleUrl);
  }, [view.style]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady) return;
    const center = map.getCenter();
    const camera = view.camera;
    const changed = Math.abs(center.lat - camera.center.lat) > 0.00001
      || Math.abs(center.lng - camera.center.lng) > 0.00001
      || Math.abs(map.getZoom() - camera.zoom) > 0.01
      || Math.abs(map.getBearing() - camera.bearing) > 0.1
      || Math.abs(map.getPitch() - camera.pitch) > 0.1;
    if (changed) map.easeTo({ center: [camera.center.lng, camera.center.lat], zoom: camera.zoom, bearing: camera.bearing, pitch: camera.pitch, duration: 260 });
  }, [styleReady, view.camera.bearing, view.camera.center.lat, view.camera.center.lng, view.camera.pitch, view.camera.zoom]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady) return;
    const selected = records.find((record) => record.id === selectedRecordId);
    const ordinary = selectedRecordId ? records.filter((record) => record.id !== selectedRecordId) : records;
    const recordSource = map.getSource(RECORD_SOURCE) as GeoJSONSource;
    const selectedSource = map.getSource(SELECTED_SOURCE) as GeoJSONSource;
    const overlaySource = map.getSource(OVERLAY_SOURCE) as GeoJSONSource;
    void recordSource.setData(toExchangeMapFeatureCollection(ordinary, lens) as unknown as Parameters<GeoJSONSource["setData"]>[0]);
    void selectedSource.setData(toExchangeMapFeatureCollection(selected ? [selected] : [], lens) as unknown as Parameters<GeoJSONSource["setData"]>[0]);
    void overlaySource.setData(toExchangeMapFeatureCollection(records, lens) as unknown as Parameters<GeoJSONSource["setData"]>[0]);
    map.setLayoutProperty(CLUSTER_LAYER, "visibility", layerVisibility(view.layers.records));
    map.setLayoutProperty(CLUSTER_COUNT_LAYER, "visibility", layerVisibility(view.layers.records));
    map.setLayoutProperty(RECORD_LAYER, "visibility", layerVisibility(view.layers.records));
    map.setLayoutProperty(SELECTED_LAYER, "visibility", layerVisibility(view.layers.records));
    pinLayerRef.current?.setVisible(view.layers.records);
    const supportsOverlay = lens === "intelligence" || lens === "capabilities";
    map.setLayoutProperty(OVERLAY_LAYER, "visibility", layerVisibility(supportsOverlay && view.layers.lensOverlay));
    if (supportsOverlay) map.setPaintProperty(OVERLAY_LAYER, "heatmap-color", overlayHeatColor(lens) as never);
  }, [lens, records, selectedRecordId, styleReady, view.layers.lensOverlay, view.layers.records]);

  useEffect(() => {
    const pinLayer = pinLayerRef.current;
    if (!pinLayer || !styleReady) return;
    const selected = records.find((record) => record.id === selectedRecordId);
    const next = selected?.location ? selected : undefined;
    const previous = focusedRecordRef.current;
    const previousStillVisible = previous ? records.find((record) => record.id === previous.id) : undefined;
    const nextBase = basePinState(next);
    const previousBase = basePinState(previousStillVisible);

    const publish = (transient: TransientPin[]) => {
      const transientIds = new Set(transient.map((entry) => entry.record.id));
      const highlightPins: ExchangeMapPinRenderState[] = selectMapHighlightRecords(records.filter((record) => !transientIds.has(record.id)))
        .flatMap((record) => record.location ? [{
          recordId: record.id,
          location: record.location,
          kind: "highlight" as const,
          altitude: MAP_PIN_ALTITUDES.highlight,
          scale: MAP_PIN_SCALES.highlight,
          opacity: HIGHLIGHT_OPACITY,
        }] : []);
      const transientPins: ExchangeMapPinRenderState[] = transient.flatMap(({ record, state }) => record.location ? [{
        recordId: record.id,
        location: record.location,
        kind: "focus" as const,
        altitude: state.altitude,
        scale: state.scale,
        opacity: state.opacity,
      }] : []);
      pinLayer.setPins([...highlightPins, ...transientPins]);
    };

    if (pinAnimationFrameRef.current !== undefined) {
      cancelAnimationFrame(pinAnimationFrameRef.current);
      pinAnimationFrameRef.current = undefined;
    }

    if (previous?.id === next?.id) {
      focusedRecordRef.current = next;
      if (next) pinMotionRef.current.set(next.id, focusPinState);
      publish(next ? [{ record: next, state: focusPinState }] : []);
      return;
    }

    const previousStart = previous ? (pinMotionRef.current.get(previous.id) ?? focusPinState) : basePinState(undefined);
    const nextStart = next ? (pinMotionRef.current.get(next.id) ?? nextBase) : basePinState(undefined);
    focusedRecordRef.current = next;

    if (reducedMotionRequested()) {
      pinMotionRef.current.clear();
      if (next) pinMotionRef.current.set(next.id, focusPinState);
      publish(next ? [{ record: next, state: focusPinState }] : []);
      return;
    }

    const startedAt = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / FOCUS_TRANSITION_MS);
      const eased = easeOutCubic(progress);
      const transient: TransientPin[] = [];

      if (previous && previous.id !== next?.id) {
        const state = {
          altitude: interpolate(previousStart.altitude, previousBase.altitude, eased),
          scale: interpolate(previousStart.scale, previousBase.scale, eased),
          opacity: interpolate(previousStart.opacity, previousBase.opacity, eased),
        };
        pinMotionRef.current.set(previous.id, state);
        if (state.opacity > 0.01) transient.push({ record: previousStillVisible ?? previous, state });
      }
      if (next) {
        const state = {
          altitude: interpolate(nextStart.altitude, focusPinState.altitude, eased),
          scale: interpolate(nextStart.scale, focusPinState.scale, eased),
          opacity: interpolate(nextStart.opacity, focusPinState.opacity, eased),
        };
        pinMotionRef.current.set(next.id, state);
        transient.push({ record: next, state });
      }

      publish(transient);

      if (progress < 1) {
        pinAnimationFrameRef.current = requestAnimationFrame(tick);
        return;
      }

      if (previous) pinMotionRef.current.delete(previous.id);
      if (next) pinMotionRef.current.set(next.id, focusPinState);
      publish(next ? [{ record: next, state: focusPinState }] : []);
      pinAnimationFrameRef.current = undefined;
    };

    pinAnimationFrameRef.current = requestAnimationFrame(tick);
    return () => {
      if (pinAnimationFrameRef.current !== undefined) {
        cancelAnimationFrame(pinAnimationFrameRef.current);
        pinAnimationFrameRef.current = undefined;
      }
    };
  }, [records, selectedRecordId, styleReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady) return;
    const source = map.getSource(LOCATION_SOURCE) as GeoJSONSource;
    const data = viewerLocation ? { type: "FeatureCollection" as const, features: [{ type: "Feature" as const, geometry: { type: "Point" as const, coordinates: [viewerLocation.lng, viewerLocation.lat] as [number, number] }, properties: {} }] } : EMPTY_GEOJSON;
    void source.setData(data as unknown as Parameters<GeoJSONSource["setData"]>[0]);
  }, [styleReady, viewerLocation]);

  return (
    <div className={styles.canvas} data-drawer-state={drawerState} data-lens={lens} role="region" aria-label={`${lens} map. ${summary.mapped} mapped and ${summary.offMap} off-map results.`}>
      <div ref={hostRef} className={styles.mapHost} />
      {!styleReady && !loadError ? <div className={styles.loading} role="status">Loading live Exchange map…</div> : null}
      {loadError ? <div className={styles.error} role="status"><div><strong>Map temporarily unavailable</strong><p>{loadError}</p></div></div> : null}
    </div>
  );
}
