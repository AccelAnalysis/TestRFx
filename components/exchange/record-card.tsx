"use client";

import type { ExchangeRecord, ExchangeRelationshipState, ExchangeStatusTone } from "@/lib/exchange/contracts";
import styles from "./record-card.module.css";

const mediaLabels: Record<ExchangeRecord["type"], string> = { rfx: "RFx", resource: "Resource", intelligence: "Signal", capability: "Capability" };
const relationshipLabels: Record<ExchangeRelationshipState, string> = { saved: "Saved", watched: "Watching", following: "Following", referred: "Referred", responded: "Responded", teamed: "Teamed", requested: "Requested", connected: "Connected", owned: "Owned by you" };
const statusClass: Record<ExchangeStatusTone, string> = { neutral: styles.statusNeutral, info: styles.statusInfo, success: styles.statusSuccess, warning: styles.statusWarning, critical: styles.statusCritical };
const mediaClass: Record<ExchangeRecord["type"], string> = { rfx: styles.rfx, resource: styles.resource, intelligence: styles.intelligence, capability: styles.capability };

export function RecordCard({ record, selected, onSelect, onOpen, onToggleSave }: {
  record: ExchangeRecord;
  selected: boolean;
  onSelect: () => void;
  onOpen: () => void;
  onToggleSave: () => void;
}) {
  const placement = record.card?.placement ?? (record.featured ? "featured" : "organic");
  const status = record.card?.status;
  const relationships = new Set<ExchangeRelationshipState>(record.card?.relationships ?? []);
  if (record.saved) relationships.add("saved");
  if (record.ownedByViewer) relationships.add("owned");
  const media = record.card?.media;
  const compact = record.card?.density === "compact";
  const unavailable = record.card?.availability === "unavailable" || record.access?.canOpenDetail === false;
  const restricted = record.card?.availability === "restricted";
  const reason = record.card?.unavailableReason ?? (record.access?.canOpenDetail === false ? "Your current role cannot open this record." : undefined);
  const reasonId = `record-card-${record.id}-availability`;
  const canSave = !unavailable && record.access?.canSave !== false;

  return (
    <article
      className={`${styles.card} ${selected ? styles.selected : ""} ${placement === "sponsored" ? styles.sponsored : ""}`}
      data-record-id={record.id}
      data-record-type={record.type}
      data-selected={selected ? "true" : "false"}
      data-card-context={record.card?.context ?? "default"}
      data-card-density={record.card?.density ?? "standard"}
    >
      <button
        className={styles.main}
        style={compact ? { gridTemplateColumns: "72px minmax(0, 1fr)" } : undefined}
        type="button"
        onClick={() => { onSelect(); onOpen(); }}
        onFocus={onSelect}
        aria-label={`Open ${record.type} record: ${record.title}`}
        disabled={unavailable}
        aria-describedby={reason ? reasonId : undefined}
      >
        <div className={`${styles.media} ${mediaClass[record.type]}`} style={{ position: "relative", overflow: "hidden", minHeight: compact ? 108 : undefined, padding: compact ? "10px 8px" : undefined }}>
          {media?.src ? <img src={media.src} alt={media.alt ?? ""} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} onError={(event) => { event.currentTarget.hidden = true; }} /> : null}
          <span className={styles.mediaLabel} style={{ position: "relative", zIndex: 1 }}>{media?.label ?? mediaLabels[record.type]}</span>
          {placement !== "organic" ? <span className={styles.placement} style={{ position: "relative", zIndex: 1 }}>{placement === "sponsored" ? "Sponsored" : "Featured"}</span> : null}
        </div>
        <div className={styles.content} style={compact ? { paddingTop: 9, paddingBottom: 9 } : undefined}>
          <div className={styles.topline}>
            <span className={styles.eyebrow}>{record.card?.eyebrow ?? mediaLabels[record.type]}</span>
            {status ? <span className={`${styles.status} ${statusClass[status.tone ?? "neutral"]}`}>{status.label}</span> : null}
          </div>
          {record.card?.contextLabel ? <div className={styles.relationships}><span>{record.card.contextLabel}</span></div> : null}
          <p className={styles.organization}>{record.organization}</p>
          <div className={styles.heading}><h3>{record.title}</h3><span aria-hidden>›</span></div>
          {!compact ? <p className={styles.summary}>{record.summary}</p> : null}
          <div className={styles.spatial}><span>{record.geography}</span>{record.card?.distance ? <span>{record.card.distance}</span> : null}<span>{record.location ? "Mapped" : "Off map"}</span></div>
          {record.card?.classifications?.length ? <div className={styles.classifications} aria-label="Classifications">{record.card.classifications.slice(0, compact ? 2 : 3).map((item) => <span key={item}>{item}</span>)}</div> : null}
          {!compact && record.metadata.length ? <div className={styles.metadata} aria-label="Record metadata">{record.metadata.slice(0, 4).map((item) => <span key={item}>{item}</span>)}</div> : null}
          {relationships.size ? <div className={styles.relationships} aria-label="Relationship state">{[...relationships].slice(0, compact ? 2 : relationships.size).map((relationship) => <span key={relationship}>{relationshipLabels[relationship]}</span>)}</div> : null}
          {restricted ? <div className={styles.relationships}><span>Restricted detail</span></div> : null}
          {reason ? <p id={reasonId} className={styles.summary}>{reason}</p> : null}
        </div>
      </button>
      <button type="button" className={styles.favorite} aria-label={record.saved ? `Remove ${record.title} from saved records` : `Save ${record.title}`} aria-pressed={Boolean(record.saved)} disabled={!canSave} onClick={(event) => { event.stopPropagation(); onToggleSave(); }}><span aria-hidden>{record.saved ? "★" : "☆"}</span></button>
    </article>
  );
}
