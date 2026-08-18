"use client";

import type { ExchangeRecord } from "@/lib/exchange/contracts";

function markerPosition(record: ExchangeRecord) {
  if (!record.location) return undefined;
  const x = 12 + ((record.location.lng + 76.8) / 0.65) * 76;
  const y = 18 + ((36.98 - record.location.lat) / 0.32) * 65;
  return { left: `${Math.max(7, Math.min(93, x))}%`, top: `${Math.max(14, Math.min(83, y))}%` };
}

export function MapCanvas({ records, selectedRecordId, onSelect, resetKey }: { records: ExchangeRecord[]; selectedRecordId?: string; onSelect: (id: string) => void; resetKey: number }) {
  const located = records.filter((record) => record.location);
  return (
    <div className="map-canvas" aria-label="Exchange map" data-reset-key={resetKey}>
      <div className="map-grid" />
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
      <div className="map-provider-note">Map provider adapter boundary · reference canvas</div>
    </div>
  );
}
