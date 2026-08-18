"use client";

import type { ExchangeRecord, LensAction } from "@/lib/exchange/contracts";
import { ActionRail } from "./action-rail";

export function DetailSurface({ record, actions, activeActionIds, onAction, onClose }: {
  record: ExchangeRecord;
  actions: LensAction[];
  activeActionIds?: string[];
  onAction: (action: LensAction) => void;
  onClose: () => void;
}) {
  return (
    <section className="detail-surface" role="dialog" aria-modal="true" aria-label={`${record.title} details`}>
      <header><button type="button" onClick={onClose}>← Back</button><span>{record.type.toUpperCase()}</span></header>
      <div className={`detail-hero record-media-${record.type}`}><p>{record.organization}</p><h1>{record.title}</h1><span>{record.geography}</span></div>
      <div className="detail-body">
        <ActionRail actions={actions} activeActionIds={activeActionIds} onAction={onAction} />
        <p>{record.summary}</p>
        <h2>Record context</h2>
        <div className="detail-tags">{record.metadata.map((item) => <span key={item}>{item}</span>)}</div>
        <h2>Shell contract</h2>
        <p>This shared detail controller preserves the Exchange lens, query, selection, map context, drawer state, and list position when you return. The same four governed actions remain bound to the selected record.</p>
      </div>
    </section>
  );
}
