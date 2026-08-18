"use client";

import { useEffect, useState } from "react";
import type { IntelligenceDetail } from "@/lib/exchange/intelligence";
import { getIntelligenceRecord, IntelligenceServiceError } from "@/lib/exchange/intelligence-client";

function dateRange(detail: IntelligenceDetail) {
  const from = detail.observedFrom ? new Date(detail.observedFrom).toLocaleDateString() : undefined;
  const to = detail.observedTo ? new Date(detail.observedTo).toLocaleDateString() : undefined;
  if (from && to) return `${from} – ${to}`;
  return from ?? to ?? "Not supplied";
}

function provenanceEntries(detail: IntelligenceDetail) {
  return Object.entries(detail.provenance).filter(([, value]) => value !== undefined && value !== null && value !== "");
}

export function IntelligenceDetailContent({ recordId, refreshKey = 0 }: { recordId: string; refreshKey?: number }) {
  const [detail, setDetail] = useState<IntelligenceDetail>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(undefined);
    getIntelligenceRecord(recordId)
      .then((next) => { if (!cancelled) setDetail(next); })
      .catch((caught) => {
        if (cancelled) return;
        setDetail(undefined);
        setError(caught instanceof IntelligenceServiceError ? caught.message : "The Intelligence record could not be loaded.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [recordId, refreshKey]);

  if (loading) return <div className="intelligence-service-state" role="status"><strong>Loading intelligence context…</strong></div>;
  if (!detail) return <div className="intelligence-service-state intelligence-service-error" role="alert"><strong>Intelligence context unavailable</strong><p>{error}</p></div>;

  const provenance = provenanceEntries(detail);
  return <>
    <p>{detail.record.summary}</p>
    <h2>Intelligence context</h2>
    <dl className="intelligence-detail-grid">
      <div><dt>Signal</dt><dd>{detail.signalType}</dd></div>
      <div><dt>Observed period</dt><dd>{dateRange(detail)}</dd></div>
      <div><dt>Source class</dt><dd>{detail.sourceType?.replaceAll("-", " ") ?? "Not supplied"}</dd></div>
      <div><dt>Tracking</dt><dd>{detail.tracking.active ? `${detail.tracking.mode === "follow" ? "Following" : "Tracking"}` : "Not tracking"}</dd></div>
    </dl>

    <div className="provenance-panel">
      <strong>Sources & provenance</strong>
      {detail.sources.length ? <div className="intelligence-source-list">{detail.sources.map((source) => <article key={source.id}>
        <strong>{source.label}</strong>
        <span>{source.type.replaceAll("-", " ")}</span>
        {source.publisher ? <span>{source.publisher}</span> : null}
        {source.retrievedAt ? <small>Retrieved {new Date(source.retrievedAt).toLocaleString()}</small> : null}
        {source.uri ? <a href={source.uri} target="_blank" rel="noreferrer">Open source ↗</a> : null}
      </article>)}</div> : <p>No source records are attached.</p>}
      {provenance.length ? <dl className="intelligence-provenance-list">{provenance.map(([key, value]) => <div key={key}><dt>{key.replaceAll(/([A-Z])/g, " $1")}</dt><dd>{typeof value === "object" ? JSON.stringify(value) : String(value)}</dd></div>)}</dl> : null}
    </div>

    {detail.relatedCapabilities.length ? <div className="intelligence-related"><strong>Related capabilities</strong><div className="detail-tags">{detail.relatedCapabilities.map((item) => <span key={item.id}>{item.title}</span>)}</div></div> : null}
    {detail.relatedOrganizations.length ? <div className="intelligence-related"><strong>Related organizations</strong><div className="detail-tags">{detail.relatedOrganizations.map((item) => <span key={item.id}>{item.name}</span>)}</div></div> : null}

    <h2>Notes</h2>
    {detail.notes.length ? <div className="intelligence-notes">{detail.notes.map((note) => <article key={note.id}><p>{note.body}</p><small>{note.visibility} · {new Date(note.createdAt).toLocaleString()}</small></article>)}</div> : <p className="muted">No notes are visible to your current organization context.</p>}
  </>;
}
