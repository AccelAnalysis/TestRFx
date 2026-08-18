"use client";

import { useMemo, useRef, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import type { Coordinates, DrawerState, ExchangeLens, ExchangeRecord, MapCamera, MapViewState } from "@/lib/exchange/contracts";
import {
  buildMarkerGroups,
  lensMapPresentations,
  panMapCamera,
  projectCoordinate,
  summarizeMapRecords,
  zoomMapCamera,
} from "@/lib/exchange/map-model";
import styles from "./persistent-map.module.css";

const referencePlaces = [
  { label: "Isle of Wight", location: { lat: 36.9, lng: -76.71 } },
  { label: "Suffolk", location: { lat: 36.73, lng: -76.58 } },
  { label: "Portsmouth", location: { lat: 36.84, lng: -76.34 } },
  { label: "Norfolk", location: { lat: 36.85, lng: -76.29 } },
];

function markerClass(lens: ExchangeLens) {
  if (lens === "rfx") return styles.markerRfx;
  if (lens === "resources") return styles.markerResource;
  if (lens === "intelligence") return styles.markerIntelligence;
  return styles.markerCapability;
}

function positionStyle(point: { left: number; top: number }) {
  return { left: `${point.left}%`, top: `${point.top}%` };
}

export function PersistentMap({
  lens,
  records,
  selectedRecordId,
  drawerState,
  view,
  viewerLocation,
  onViewChange,
  onSelect,
}: {
  lens: ExchangeLens;
  records: ExchangeRecord[];
  selectedRecordId?: string;
  drawerState: DrawerState;
  view: MapViewState;
  viewerLocation?: Coordinates;
  onViewChange: (view: MapViewState) => void;
  onSelect: (id: string) => void;
}) {
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ x: number; y: number; camera: MapCamera } | null>(null);
  const presentation = lensMapPresentations[lens];
  const summary = useMemo(() => summarizeMapRecords(records), [records]);
  const groups = useMemo(() => buildMarkerGroups(records, view.camera, selectedRecordId), [records, selectedRecordId, view.camera]);
  const densityRecords = presentation.overlay === "heat" || presentation.overlay === "density"
    ? records.filter((record): record is ExchangeRecord & { location: Coordinates } => Boolean(record.location))
    : [];
  const viewerPoint = viewerLocation ? projectCoordinate(viewerLocation, view.camera) : undefined;

  function updateCamera(camera: MapCamera) {
    onViewChange({ ...view, camera });
  }

  function startPan(event: ReactPointerEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("button")) return;
    dragRef.current = { x: event.clientX, y: event.clientY, camera: view.camera };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function movePan(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragRef.current || !surfaceRef.current) return;
    const rect = surfaceRef.current.getBoundingClientRect();
    updateCamera(panMapCamera(dragRef.current.camera, event.clientX - dragRef.current.x, event.clientY - dragRef.current.y, rect.width, rect.height));
  }

  function endPan() {
    dragRef.current = null;
  }

  function keyboardPan(event: KeyboardEvent<HTMLDivElement>) {
    if (!surfaceRef.current) return;
    const rect = surfaceRef.current.getBoundingClientRect();
    const step = 42;
    const deltas: Record<string, [number, number]> = {
      ArrowLeft: [step, 0],
      ArrowRight: [-step, 0],
      ArrowUp: [0, step],
      ArrowDown: [0, -step],
    };
    if (event.key in deltas) {
      event.preventDefault();
      const [x, y] = deltas[event.key];
      updateCamera(panMapCamera(view.camera, x, y, rect.width, rect.height));
      return;
    }
    if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      updateCamera(zoomMapCamera(view.camera, 0.75));
    }
    if (event.key === "-") {
      event.preventDefault();
      updateCamera(zoomMapCamera(view.camera, -0.75));
    }
  }

  return (
    <div
      ref={surfaceRef}
      className={styles.canvas}
      data-map-mode={view.camera.mode}
      data-drawer-state={drawerState}
      data-lens={lens}
      role="region"
      tabIndex={0}
      aria-label={`${presentation.label} map. ${summary.mapped} mapped and ${summary.offMap} off-map results.`}
      onPointerDown={startPan}
      onPointerMove={movePan}
      onPointerUp={endPan}
      onPointerCancel={endPan}
      onKeyDown={keyboardPan}
    >
      <div className={styles.world} aria-hidden>
        <div className={styles.grid} />
        <div className={`${styles.water} ${styles.waterOne}`} />
        <div className={`${styles.water} ${styles.waterTwo}`} />
        <div className={`${styles.road} ${styles.roadOne}`} />
        <div className={`${styles.road} ${styles.roadTwo}`} />
        <div className={`${styles.road} ${styles.roadThree}`} />
        <div className={styles.boundary} />
      </div>

      {referencePlaces.map((place) => {
        const point = projectCoordinate(place.location, view.camera);
        if (!point.visible) return null;
        return <span key={place.label} className={styles.placeLabel} style={positionStyle(point)}>{place.label}</span>;
      })}

      {densityRecords.map((record) => {
        const point = projectCoordinate(record.location, view.camera);
        if (!point.visible) return null;
        return <span key={`density:${record.id}`} className={`${styles.densityPoint} ${presentation.overlay === "heat" ? styles.heatPoint : styles.capabilityDensity}`} style={positionStyle(point)} aria-hidden />;
      })}

      {groups.map((group) => {
        if (!group.projected.visible) return null;
        if (group.cluster) {
          return (
            <button
              key={group.id}
              type="button"
              className={styles.cluster}
              style={positionStyle(group.projected)}
              onPointerDown={(event: ReactPointerEvent<HTMLButtonElement>) => event.stopPropagation()}
              onClick={() => updateCamera({ ...zoomMapCamera(view.camera, 1.4), center: group.coordinate })}
              aria-label={`Zoom to ${group.records.length} ${presentation.shortLabel} results`}
              title={`${group.records.length} results`}
            >{group.records.length}</button>
          );
        }
        const record = group.records[0];
        const selected = record.id === selectedRecordId;
        return (
          <button
            type="button"
            key={record.id}
            style={positionStyle(group.projected)}
            className={`${styles.marker} ${markerClass(lens)} ${selected ? styles.selected : ""}`}
            onPointerDown={(event: ReactPointerEvent<HTMLButtonElement>) => event.stopPropagation()}
            onClick={() => onSelect(record.id)}
            aria-pressed={selected}
            aria-label={`Select ${record.title}`}
            title={record.title}
          ><span>{record.ownedByViewer ? "◆" : "●"}</span></button>
        );
      })}

      {viewerPoint?.visible ? (
        <div className={`${styles.marker} ${styles.markerRfx}`} style={positionStyle(viewerPoint)} role="img" aria-label="Your current location" title="Your current location">
          <span>•</span>
        </div>
      ) : null}

      <div className={styles.status} aria-live="polite">
        <span className={`${styles.lensDot} ${markerClass(lens)}`} aria-hidden />
        <span><strong>{presentation.label}</strong><small>{summary.mapped} mapped · {summary.offMap} off-map</small></span>
      </div>

      <div className={styles.geographyChip}>
        <small>Exchange geography</small>
        <strong>{view.geography.label}</strong>
      </div>

      <div className={styles.tools} aria-label="Map zoom controls">
        <button type="button" onClick={() => updateCamera(zoomMapCamera(view.camera, 0.75))} aria-label="Zoom in">+</button>
        <button type="button" onClick={() => updateCamera(zoomMapCamera(view.camera, -0.75))} aria-label="Zoom out">−</button>
      </div>

      <div className={styles.legend} aria-hidden>
        <span><i className={styles.legendExternal}>●</i> Exchange record</span>
        <span><i className={styles.legendOwned}>◆</i> Your organization</span>
      </div>

      <div className={styles.providerNote}>Persistent map adapter boundary · reference spatial canvas</div>
    </div>
  );
}
