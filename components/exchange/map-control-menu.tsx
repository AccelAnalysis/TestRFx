"use client";

import { useEffect, useState } from "react";
import type {
  ExchangeLens,
  GeolocationStatus,
  MapControlRoute,
  MapGeographyOption,
  MapViewState,
} from "@/lib/exchange/contracts";
import { zoomMapCamera } from "@/lib/exchange/map-model";
import { mapStyleDefinitions, mapStyleOrder } from "@/lib/exchange/map-styles";
import styles from "./map-control-menu.module.css";

const routeTitle: Record<MapControlRoute, string> = {
  root: "Map",
  view: "View",
  basemap: "Map type",
  layers: "Layers",
  geography: "Geography",
};

export function MapControlMenu({
  open,
  lens,
  view,
  geographies,
  geolocationStatus,
  searchAreaAvailable,
  onClose,
  onViewChange,
  onResetView,
  onSelectGeography,
  onLocate,
  onSearchArea,
}: {
  open: boolean;
  lens: ExchangeLens;
  view: MapViewState;
  geographies: MapGeographyOption[];
  geolocationStatus: GeolocationStatus;
  searchAreaAvailable: boolean;
  onClose: () => void;
  onViewChange: (view: MapViewState) => void;
  onResetView: () => void;
  onSelectGeography: (geography?: MapGeographyOption) => void;
  onLocate: () => void;
  onSearchArea: () => void;
}) {
  const [route, setRoute] = useState<MapControlRoute>("root");

  useEffect(() => {
    if (!open) setRoute("root");
  }, [open]);

  if (!open) return null;

  const overlayLabel = lens === "intelligence" ? "Heat / concentration overlay" : lens === "capabilities" ? "Capability density overlay" : undefined;
  const mapStyle = mapStyleDefinitions[view.style];
  const parentRoute: MapControlRoute = route === "basemap" ? "view" : "root";
  const breadcrumb = route === "root" ? "Map" : route === "basemap" ? "Map › View › Map type" : `Map › ${routeTitle[route]}`;

  function setMode(mode: "2d" | "3d") {
    onViewChange({ ...view, camera: { ...view.camera, mode, pitch: mode === "3d" ? 42 : 0 } });
  }

  return (
    <section className={styles.menu} role="dialog" aria-label="Map controls">
      <header className={styles.header}>
        <div>
          <p className={styles.breadcrumb}>{breadcrumb}</p>
          <h2>{routeTitle[route]}</h2>
        </div>
        <button type="button" onClick={onClose} aria-label="Close map controls">×</button>
      </header>

      {route !== "root" ? <button className={styles.back} type="button" onClick={() => setRoute(parentRoute)}>← Back to {route === "basemap" ? "View" : "Map"}</button> : null}

      {route === "root" ? (
        <nav className={styles.tree} aria-label="Map control sections">
          <button type="button" onClick={() => setRoute("view")}><span><strong>View</strong><small>{mapStyle.label} · 2D / 3D, zoom, reset</small></span><b>›</b></button>
          <button type="button" onClick={() => setRoute("layers")}><span><strong>Layers</strong><small>Records{overlayLabel ? " and lens overlay" : " and clusters"}</small></span><b>›</b></button>
          <button type="button" onClick={() => setRoute("geography")}><span><strong>Geography</strong><small>{view.geography.label}</small></span><b>›</b></button>
        </nav>
      ) : null}

      {route === "view" ? (
        <div className={styles.list}>
          <button type="button" onClick={() => setRoute("basemap")}><span><strong>Map type</strong><small>{mapStyle.label} · {mapStyle.provider}</small></span><b>›</b></button>
          <button type="button" className={view.camera.mode === "2d" ? styles.active : ""} onClick={() => setMode("2d")}><span>2D map</span><b>{view.camera.mode === "2d" ? "✓" : ""}</b></button>
          <button type="button" className={view.camera.mode === "3d" ? styles.active : ""} onClick={() => setMode("3d")}><span>3D map</span><b>{view.camera.mode === "3d" ? "✓" : ""}</b></button>
          <button type="button" onClick={() => onViewChange({ ...view, camera: zoomMapCamera(view.camera, 0.75) })}><span>Zoom in</span><b>+</b></button>
          <button type="button" onClick={() => onViewChange({ ...view, camera: zoomMapCamera(view.camera, -0.75) })}><span>Zoom out</span><b>−</b></button>
          <button type="button" onClick={onResetView}><span>Reset Exchange view</span><b>↥</b></button>
        </div>
      ) : null}

      {route === "basemap" ? (
        <div className={styles.list}>
          {mapStyleOrder.map((styleId) => {
            const option = mapStyleDefinitions[styleId];
            return (
              <button key={styleId} type="button" className={view.style === styleId ? styles.active : ""} onClick={() => onViewChange({ ...view, style: styleId })}>
                <span><strong>{option.label}</strong><small>{option.description}<br />{option.provider}</small></span><b>{view.style === styleId ? "✓" : ""}</b>
              </button>
            );
          })}
        </div>
      ) : null}

      {route === "layers" ? (
        <div className={styles.list}>
          <button type="button" className={view.layers.records ? styles.active : ""} onClick={() => onViewChange({ ...view, layers: { ...view.layers, records: !view.layers.records } })}>
            <span><strong>Record markers & clusters</strong><small>Located records in the current lens</small></span><b>{view.layers.records ? "✓" : ""}</b>
          </button>
          {overlayLabel ? (
            <button type="button" className={view.layers.lensOverlay ? styles.active : ""} onClick={() => onViewChange({ ...view, layers: { ...view.layers, lensOverlay: !view.layers.lensOverlay } })}>
              <span><strong>{overlayLabel}</strong><small>{lens === "intelligence" ? "Located intelligence signals" : "Located capability concentration"}</small></span><b>{view.layers.lensOverlay ? "✓" : ""}</b>
            </button>
          ) : null}
        </div>
      ) : null}

      {route === "geography" ? (
        <div className={styles.geography}>
          <button type="button" className={view.geography.scope === "reference" ? styles.active : ""} onClick={() => onSelectGeography(undefined)}>
            <span><strong>Exchange geography</strong><small>Clear the selected geography</small></span><b>{view.geography.scope === "reference" ? "✓" : ""}</b>
          </button>
          {geographies.map((geography) => (
            <button key={geography.id} type="button" className={view.geography.id === geography.id ? styles.active : ""} onClick={() => onSelectGeography(geography)}>
              <span><strong>{geography.label}</strong><small>{geography.recordCount} result{geography.recordCount === 1 ? "" : "s"}{geography.center ? " · mapped" : " · off-map only"}</small></span><b>{view.geography.id === geography.id ? "✓" : ""}</b>
            </button>
          ))}
          <div className={styles.divider} />
          <button type="button" onClick={onLocate} disabled={geolocationStatus === "requesting"}>
            <span><strong>{geolocationStatus === "requesting" ? "Finding my location…" : "Use my location"}</strong><small>Browser location service</small></span><b>◎</b>
          </button>
          <button type="button" onClick={onSearchArea} disabled={!searchAreaAvailable || !view.currentBounds}>
            <span><strong>Search this area</strong><small>{view.queriedBounds ? "Replace the current map-area scope" : "Apply the visible map as a result scope"}</small></span><b>⌖</b>
          </button>
        </div>
      ) : null}

      <footer className={styles.footer}>Current map: {view.geography.label} · {mapStyle.label} · {view.camera.mode.toUpperCase()} · zoom {view.camera.zoom.toFixed(1)}</footer>
    </section>
  );
}
