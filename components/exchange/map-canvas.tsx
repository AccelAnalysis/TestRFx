"use client";

import type { Coordinates, ExchangeRecord, MapDisplayMode } from "@/lib/exchange/contracts";

const referenceBounds = { west: -76.8, east: -76.15, south: 36.66, north: 36.98 };

function coordinatePosition(coordinates: Coordinates, clamp = true) {
  if (!clamp && (coordinates.lng < referenceBounds.west || coordinates.lng > referenceBounds.east || coordinates.lat < referenceBounds.south || coordinates.lat > referenceBounds.north)) return undefined;
  const x = 12 + ((coordinates.lng + 76.8) / 0.65) * 76;
  const y = 18 + ((36.98 - coordinates.lat) / 0.32) * 65;
  return { left: `${Math.max(7, Math.min(93, x))}%`, top: `${Math.max(14, Math.min(83, y))}%` };
}

function markerPosition(record: ExchangeRecord) {
  return record.location ? coordinatePosition(record.location) : undefined;
}

export function MapCanvas({
  records,
  selectedRecordId,
  onSelect,
  resetKey,
  displayMode = "2d",
  viewerLocation,
}: {
  records: ExchangeRecord[];
  selectedRecordId?: string;
  onSelect: (id: string) => void;
  resetKey: number;
  displayMode?: MapDisplayMode;
  viewerLocation?: Coordinates;
}) {
  const located = records.filter((record) => record.location);
  const viewerPosition = viewerLocation ? coordinatePosition(viewerLocation, false) : undefined;

  return (
    <div className="map-canvas" aria-label="Exchange map" data-reset-key={resetKey} data-map-mode={displayMode}>
      <div
        className="map-grid"
        style={displayMode === "3d" ? { transform: "perspective(900px) rotateX(22deg) rotateZ(-7deg) scale(1.24)", transformOrigin: "center 68%" } : undefined}
      />
      <div className="water water-one" /><div className="water water-two" />
      <div className="road road-one" /><div className="road road-two" /><div className="road road-three" />
      <span className="place-label label-one">Hampton Roads</span>
      <span className="place-label label-two">Isle of Wight</span>
      <span className="place-label label-three">Norfolk</span>
      {located.map((record) => (
        <button
          type="button"
          key={record.id}
          style={markerPosition(record)}
          className={`map-marker ${selectedRecordId === record.id ? "selected" : ""}`}
          onClick={() => onSelect(record.id)}
          aria-label={`Select ${record.title}`}
          title={record.title}
        >
          <span>{record.ownedByViewer ? "◆" : "●"}</span>
        </button>
      ))}
      {viewerPosition ? (
        <div
          className="map-marker"
          style={{ ...viewerPosition, width: 30, height: 30, background: "var(--signal-blue)", pointerEvents: "none" }}
          role="img"
          aria-label="Your current location"
          title="Your current location"
        ><span>•</span></div>
      ) : null}
      <div className="map-provider-note">Map provider adapter boundary · {displayMode.toUpperCase()} reference canvas</div>
    </div>
  );
}
