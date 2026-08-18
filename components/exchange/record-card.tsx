"use client";

import type { ExchangeRecord } from "@/lib/exchange/contracts";

const mediaLabels: Record<ExchangeRecord["type"], string> = { rfx: "RFx", resource: "Resource", intelligence: "Signal", capability: "Capability" };

export function RecordCard({ record, selected, onSelect, onOpen }: { record: ExchangeRecord; selected: boolean; onSelect: () => void; onOpen: () => void }) {
  return (
    <article className={`record-card ${selected ? "selected" : ""}`} data-record-id={record.id}>
      <button className="record-card-main" type="button" onClick={onOpen} onFocus={onSelect}>
        <div className={`record-media record-media-${record.type}`}>
          <span>{mediaLabels[record.type]}</span>
          {record.featured ? <em>Featured</em> : null}
        </div>
        <div className="record-content">
          <div className="record-heading"><div><p className="record-org">{record.organization}</p><h3>{record.title}</h3></div><span aria-hidden>›</span></div>
          <p className="record-summary">{record.summary}</p>
          <div className="record-meta"><span>{record.geography}</span>{record.metadata.map((item) => <span key={item}>{item}</span>)}</div>
        </div>
      </button>
      <button type="button" className="favorite-button" aria-label={record.saved ? "Saved" : "Save record"}>{record.saved ? "★" : "☆"}</button>
    </article>
  );
}
