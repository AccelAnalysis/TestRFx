"use client";

import { useState } from "react";
import type { ExchangeRecord, ExchangeRelationshipState, ExchangeStatusTone } from "@/lib/exchange/contracts";
import { withBasePath } from "@/lib/exchange/base-path";
import styles from "./record-card.module.css";

const mediaLabels: Record<ExchangeRecord["type"], string> = { rfx: "RFx", resource: "Resource", intelligence: "Signal", capability: "Capability" };
const relationshipLabels: Record<ExchangeRelationshipState, string> = { saved: "Saved", watched: "Watching", following: "Following", referred: "Referred", responded: "Responded", teamed: "Teamed", requested: "Requested", connected: "Connected", owned: "Owned by you" };
const statusClass: Record<ExchangeStatusTone, string> = { neutral: styles.statusNeutral, info: styles.statusInfo, success: styles.statusSuccess, warning: styles.statusWarning, critical: styles.statusCritical };
const mediaClass: Record<ExchangeRecord["type"], string> = { rfx: styles.rfx, resource: styles.resource, intelligence: styles.intelligence, capability: styles.capability };

export function RecordCard({ record, selected, onSelect, onOpen, onToggleSave }: { record: ExchangeRecord; selected: boolean; onSelect: () => void; onOpen: () => void; onToggleSave: () => void }) {
  const [relationshipPending, setRelationshipPending] = useState(false);
  const placement = record.card?.placement ?? (record.featured ? "featured" : "organic"); const status = record.card?.status; const relationships = new Set<ExchangeRelationshipState>(record.card?.relationships ?? []); if (record.saved) relationships.add("saved"); if (record.ownedByViewer) relationships.add("owned");
  const showFavorite = !(record.type === "capability" && record.ownedByViewer);

  async function toggleFavorite() {
    if (record.type !== "capability") { onToggleSave(); return; }
    setRelationshipPending(true);
    try {
      const response = await fetch(withBasePath("/api/exchange/workflows"), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ actionId: "follow", lens: "capabilities", recordId: record.id, source: "detail" }) });
      const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error ?? "Capability relationship service rejected the update");
      if (Boolean(data.relationshipActive) !== Boolean(record.saved)) onToggleSave();
    } catch (error) { console.error(error); }
    finally { setRelationshipPending(false); }
  }

  return <article className={`${styles.card} ${selected ? styles.selected : ""} ${placement === "sponsored" ? styles.sponsored : ""}`} data-record-id={record.id} data-record-type={record.type} data-selected={selected ? "true" : "false"}>
    <button className={styles.main} type="button" onClick={() => { onSelect(); onOpen(); }} onFocus={onSelect} aria-label={`Open ${record.type} record: ${record.title}`}>
      <div className={`${styles.media} ${mediaClass[record.type]}`}><span className={styles.mediaLabel}>{record.card?.media?.label ?? mediaLabels[record.type]}</span>{placement !== "organic" ? <span className={styles.placement}>{placement === "sponsored" ? "Sponsored" : "Featured"}</span> : null}</div>
      <div className={styles.content}>
        <div className={styles.topline}><span className={styles.eyebrow}>{record.card?.eyebrow ?? mediaLabels[record.type]}</span>{status ? <span className={`${styles.status} ${statusClass[status.tone ?? "neutral"]}`}>{status.label}</span> : null}</div>
        <p className={styles.organization}>{record.organization}</p><div className={styles.heading}><h3>{record.title}</h3><span aria-hidden>›</span></div><p className={styles.summary}>{record.summary}</p>
        <div className={styles.spatial}><span>{record.geography}</span>{record.card?.distance ? <span>{record.card.distance}</span> : null}<span>{record.location ? "Mapped" : "Off map"}</span></div>
        {record.card?.classifications?.length ? <div className={styles.classifications} aria-label="Classifications">{record.card.classifications.slice(0, 3).map((item) => <span key={item}>{item}</span>)}</div> : null}
        <div className={styles.metadata} aria-label="Record metadata">{record.metadata.slice(0, 3).map((item) => <span key={item}>{item}</span>)}</div>
        {relationships.size ? <div className={styles.relationships} aria-label="Relationship state">{[...relationships].map((relationship) => <span key={relationship}>{relationshipLabels[relationship]}</span>)}</div> : null}
      </div>
    </button>
    {showFavorite ? <button type="button" className={styles.favorite} aria-label={record.saved ? `Remove ${record.title} from saved records` : `Save ${record.title}`} aria-pressed={Boolean(record.saved)} aria-busy={relationshipPending} disabled={relationshipPending} onClick={() => void toggleFavorite()}><span aria-hidden>{record.saved ? "★" : "☆"}</span></button> : null}
  </article>;
}
