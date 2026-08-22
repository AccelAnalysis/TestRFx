"use client";

import { useCallback, useEffect, useState } from "react";
import type { IntelligenceActivityItem, IntelligenceDetail } from "@/lib/exchange/intelligence-runtime";
import { getIntelligenceActivity, getIntelligenceFromService } from "@/lib/exchange/intelligence-client";

function formatEvent(name: string) { return name.replace(/([a-z])([A-Z])/g, "$1 $2"); }

export function IntelligenceDetailContent({ recordId, refreshKey = 0 }: { recordId: string; refreshKey?: number }) {
  const [detail, setDetail] = useState<IntelligenceDetail>();
  const [activity, setActivity] = useState<IntelligenceActivityItem[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [detailResult, activityResult] = await Promise.all([getIntelligenceFromService(recordId), getIntelligenceActivity(recordId)]);
      setDetail(detailResult.detail); setActivity(activityResult.activity);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Intelligence detail could not be loaded."); }
    finally { setLoading(false); }
  }, [recordId]);

  useEffect(() => { void load(); }, [load, refreshKey]);
  if (loading && !detail) return <p className="muted">Loading Intelligence context…</p>;
  if (error && !detail) return <div className="intelligence-service-state intelligence-service-error" role="alert"><strong>Intelligence unavailable</strong><p>{error}</p><button type="button" onClick={() => void load()}>Retry</button></div>;
  if (!detail) return null;

  return <>
    <p>{detail.record.summary}</p>
    <h2>Intelligence context</h2>
    <dl className="intelligence-detail-grid">
      <div><dt>Signal</dt><dd>{detail.signalType}</dd></div>
      <div><dt>Observed from</dt><dd>{detail.observedFrom ? new Date(detail.observedFrom).toLocaleDateString() : "Not supplied"}</dd></div>
      <div><dt>Observed to</dt><dd>{detail.observedTo ? new Date(detail.observedTo).toLocaleDateString() : "Not supplied"}</dd></div>
      <div><dt>Tracking</dt><dd>{detail.tracking.active ? detail.tracking.mode : "Not tracking"}</dd></div>
    </dl>
    <div className="provenance-panel"><strong>Source & provenance</strong>{detail.sources.length ? detail.sources.map((source) => <p key={source.id}>{source.label} · {source.type}{source.publisher ? ` · ${source.publisher}` : ""}</p>) : <p>No source metadata has been published.</p>}</div>
    {detail.relatedOrganizations.length ? <div className="intelligence-related"><strong>Related organizations</strong><div className="detail-tags">{detail.relatedOrganizations.map((item) => <span key={item.id}>{item.name}</span>)}</div></div> : null}
    <h2>Notes</h2>{detail.notes.length ? <div className="intelligence-notes">{detail.notes.map((note) => <p key={note.id}>{note.body}</p>)}</div> : <p className="muted">No visible notes.</p>}
    <h2>Activity</h2>{activity.length ? <div className="intelligence-notes">{activity.map((item) => <p key={item.id}><strong>{formatEvent(item.eventName)}</strong> · {new Date(item.occurredAt).toLocaleString()}</p>)}</div> : <p className="muted">No activity has been recorded for this insight.</p>}
    <h2>Decision pathways</h2><div className="intelligence-outcomes"><span>Decision support</span><span>Opportunity / capability matching</span><span>Referral trigger · shared workflow</span><span>Track / follow / return</span></div>
    {error ? <p className="muted" role="status">{error}</p> : null}
  </>;
}
