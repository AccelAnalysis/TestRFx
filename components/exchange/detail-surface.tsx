"use client";

import type { ExchangeRecord, LensAction } from "@/lib/exchange/contracts";
import { RfxDetailContent } from "@/components/rfx/rfx-detail-content";
import { CapabilityDetailBody } from "@/components/capabilities/capability-detail-body";
import { getCapabilityProfileByExchangeRecordId } from "@/lib/capabilities/reference";
import { RecordActionRow } from "./record-actions";
import { ResourceDetail } from "./resource-detail";
import { IntelligenceDetailContent } from "./intelligence-detail-content";

export function DetailSurface({ record, actions, notes = [], onAction, onClose }: { record: ExchangeRecord; actions: LensAction[]; notes?: string[]; onAction: (action: LensAction) => void; onClose: () => void; }) {
  const rawCapabilityProfile = record.type === "capability" ? getCapabilityProfileByExchangeRecordId(record.id) : undefined;
  const capabilityProfile = rawCapabilityProfile?.ownedByViewer ? { ...rawCapabilityProfile, organizationName: record.organization } : rawCapabilityProfile;
  return <section className="detail-surface" role="dialog" aria-modal="true" aria-label={`${record.title} details`}>
    <header><button type="button" onClick={onClose}>← Back</button><span>{record.type.toUpperCase()}</span></header>
    <div className={`detail-hero record-media-${record.type}`}><p>{record.organization}</p><h1>{record.type === "capability" ? record.organization : record.title}</h1><span>{record.geography}</span></div>
    <div className="detail-body"><RecordActionRow actions={actions} maxVisible={4} onAction={onAction} label={`Actions for ${record.title}`} />
      {record.type === "rfx" ? <RfxDetailContent recordId={record.id} /> : record.type === "resource" ? <ResourceDetail record={record} /> : record.type === "intelligence" ? <IntelligenceDetailContent recordId={record.id} /> : capabilityProfile ? <CapabilityDetailBody profile={capabilityProfile} /> : <><p>{record.summary}</p><h2>Record context</h2><div className="detail-tags">{record.metadata.map((item) => <span key={item}>{item}</span>)}</div></>}
      {record.type !== "intelligence" ? <><h2>Shell contract</h2><p>This shared detail controller preserves the Exchange lens, query, selection, map context, drawer state, and list position when you return. Record-specific actions remain attached to this record, while the persistent four-slot rail stays reserved for lens-level controls.</p></> : null}
    </div>
  </section>;
}
