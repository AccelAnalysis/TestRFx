"use client";

import { useEffect, useState } from "react";
import { getIntelligenceActivity, IntelligenceServiceError, type IntelligenceActivityEvent } from "@/lib/exchange/intelligence-client";

function eventLabel(name: string) {
  if (name === "IntelligenceCreated") return "Insight created";
  if (name === "IntelligenceUpdated") return "Insight updated";
  if (name === "IntelligenceTrackingEnabled") return "Tracking / follow enabled";
  if (name === "IntelligenceTrackingDisabled") return "Tracking / follow disabled";
  if (name === "IntelligenceCompared") return "Comparison run";
  if (name === "ReferralCreated") return "Referral created";
  return name.replaceAll(/([a-z])([A-Z])/g, "$1 $2");
}

export function IntelligenceActivityPanel({ recordId, refreshKey = 0 }: { recordId: string; refreshKey?: number }) {
  const [events, setEvents] = useState<IntelligenceActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(undefined);
    getIntelligenceActivity(recordId)
      .then((next) => { if (!cancelled) setEvents(next); })
      .catch((caught) => { if (!cancelled) setError(caught instanceof IntelligenceServiceError ? caught.message : "Intelligence activity could not be loaded."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [recordId, refreshKey]);

  if (loading) return <div className="intelligence-service-state" role="status">Loading Intelligence activity…</div>;
  if (error) return <div className="intelligence-service-state intelligence-service-error" role="alert"><strong>Activity unavailable</strong><p>{error}</p></div>;
  if (!events.length) return <div className="intelligence-service-state"><strong>No visible activity yet.</strong><p>Tracking remains active; new canonical changes will appear here when activity events are recorded.</p></div>;

  return <div className="intelligence-activity-list" aria-label="Intelligence activity timeline">{events.map((event) => <article key={event.id}><span aria-hidden /><div><strong>{eventLabel(event.eventName)}</strong><small>{new Date(event.occurredAt).toLocaleString()}</small></div></article>)}</div>;
}
