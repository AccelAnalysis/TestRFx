"use client";

import type { ExchangeRecord, LensAction } from "@/lib/exchange/contracts";
import { RfxDetailContent } from "@/components/rfx/rfx-detail-content";
import { CapabilityDetailBody } from "@/components/capabilities/capability-detail-body";
import { getCapabilityProfileByExchangeRecordId } from "@/lib/capabilities/reference";
import { getIntelligenceDetail } from "@/lib/exchange/intelligence";
import { RecordActionRow } from "./record-actions";
import { ResourceDetail } from "./resource-detail";

function IntelligenceDetail({ record, notes }: { record: ExchangeRecord; notes: string[] }) {
  const intelligence = getIntelligenceDetail(record); if (!intelligence) return null;
  return <><p>{record.summary}</p><h2>Intelligence context</h2><dl className="intelligence-detail-grid">
    <div><dt>Signal</dt><dd>{intelligence.signalType}</dd></div><div><dt>Observed period</dt><dd>{intelligence.observedPeriod}</dd></div><div><dt>Source</dt><dd>{intelligence.sourceLabel}</dd></div><div><dt>Source class</dt><dd>{intelligence.sourceType.replaceAll("-", " ")}</dd></div>
  </dl><div className="provenance-panel"><strong>Source & provenance</strong><p>{intelligence.provenance}</p></div>
  {intelligence.relatedCapabilities.length ? <div className="intelligence-related"><strong>Related capabilities</strong><div className="detail-tags">{intelligence.relatedCapabilities.map((item) => <span key={item}>{item}</span>)}</div></div> : null}
  {intelligence.relatedOrganizations.length ? <div className="intelligence-related"><strong>Related organizations</strong><div className="detail-tags">{intelligence.relatedOrganizations.map((item) => <span key={item}>{item}</span>)}</div></div> : null}
  <h2>Notes</h2>{notes.length ? <div className="intelligence-notes">{notes.map((note, index) => <p key={`${record.id}-note-${index}`}>{note}</p>)}</div> : <p className="muted">No notes have been added in this reference session.</p>}
  <h2>Decision pathways</h2><div className="intelligence-outcomes"><span>Decision support</span><span>Opportunity / capability matching</span><span>Referral trigger · shared workflow</span><span>Track / follow / return</span></div></>;
}

export function DetailSurface({ record, actions, notes = [], onAction, onClose }: { record: ExchangeRecord; actions: LensAction[]; notes?: string[]; onAction: (action: LensAction) => void; onClose: () => void; }) {
  const rawCapabilityProfile = record.type === "capability" ? getCapabilityProfileByExchangeRecordId(record.id) : undefined;
  const capabilityProfile = rawCapabilityProfile?.ownedByViewer ? { ...rawCapabilityProfile, organizationName: record.organization } : rawCapabilityProfile;
  return <section className="detail-surface" role="dialog" aria-modal="true" aria-label={`${record.title} details`}>
    <header><button type="button" onClick={onClose}>← Back</button><span>{record.type.toUpperCase()}</span></header>
    <div className={`detail-hero record-media-${record.type}`}><p>{record.organization}</p><h1>{record.type === "capability" ? record.organization : record.title}</h1><span>{record.geography}</span></div>
    <div className="detail-body"><RecordActionRow actions={actions} maxVisible={4} onAction={onAction} label={`Actions for ${record.title}`} />
      {record.type === "rfx" ? <RfxDetailContent recordId={record.id} /> : record.type === "resource" ? <ResourceDetail record={record} /> : record.type === "intelligence" ? <IntelligenceDetail record={record} notes={notes} /> : capabilityProfile ? <CapabilityDetailBody profile={capabilityProfile} /> : <><p>{record.summary}</p><h2>Record context</h2><div className="detail-tags">{record.metadata.map((item) => <span key={item}>{item}</span>)}</div></>}
      <h2>Shell contract</h2><p>This shared detail controller preserves the Exchange lens, query, selection, map context, drawer state, and list position when you return. Record-specific actions remain attached to this record, while the persistent four-slot rail stays reserved for lens-level controls.</p>
    </div>
  </section>;
}
