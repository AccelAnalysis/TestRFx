"use client";

import type { ExchangeRecord, ExchangeRelationshipState, ExchangeStatusTone, LensAction } from "@/lib/exchange/contracts";
import { getResourceProviderListing } from "@/lib/resources/provider-listing";
import { resourceProviderClaimHref } from "@/lib/resources/claim-handoff";
import { RecordActionRow } from "./record-actions";
import styles from "./record-card.module.css";
import providerStyles from "./resource-provider-listing.module.css";

const mediaLabels: Record<ExchangeRecord["type"], string> = {
  rfx: "RFx",
  resource: "Resource",
  intelligence: "Signal",
  capability: "Capability",
};

const relationshipLabels: Partial<Record<ExchangeRelationshipState, string>> = {
  saved: "Saved",
  watched: "Watching",
  following: "Following",
  referred: "Referred",
  responded: "Responded",
  teamed: "Teamed",
  requested: "Requested",
  connected: "Connected",
};

const statusClass: Record<ExchangeStatusTone, string> = {
  neutral: styles.statusNeutral,
  info: styles.statusInfo,
  success: styles.statusSuccess,
  warning: styles.statusWarning,
  critical: styles.statusCritical,
};

const mediaClass: Record<ExchangeRecord["type"], string> = {
  rfx: styles.rfx,
  resource: styles.resource,
  intelligence: styles.intelligence,
  capability: styles.capability,
};

function normalized(value?: string) { return value?.trim().toLowerCase() ?? ""; }

export function RecordCard({
  record,
  selected,
  actions,
  onSelect,
  onOpen,
  onToggleSave,
  onAction,
}: {
  record: ExchangeRecord;
  selected: boolean;
  actions: LensAction[];
  onSelect: () => void;
  onOpen: () => void;
  onToggleSave: () => void;
  onAction: (action: LensAction) => void;
}) {
  const placement = record.card?.placement ?? (record.featured ? "featured" : "organic");
  const status = record.card?.status;
  const provider = getResourceProviderListing(record);
  const claimHref = provider?.claimState === "unclaimed" ? resourceProviderClaimHref(record) : undefined;
  const relationships = new Set<ExchangeRelationshipState>((record.card?.relationships ?? []).filter((item) => item !== "owned"));
  if (record.saved) relationships.add("saved");
  const visibleMetadata = record.metadata.filter((item) => {
    const value = normalized(item);
    if (value === "owned by you" || value === "your organization") return false;
    if (status && value === normalized(status.label)) return false;
    return true;
  });

  return (
    <article
      className={`${styles.card} ${record.ownedByViewer ? styles.owned : ""} ${selected ? styles.selected : ""} ${placement === "sponsored" ? styles.sponsored : ""}`}
      data-record-id={record.id}
      data-record-type={record.type}
      data-selected={selected ? "true" : "false"}
      data-owned={record.ownedByViewer ? "true" : "false"}
      data-claim-state={provider?.claimState}
    >
      <button
        className={styles.main}
        type="button"
        onClick={() => {
          onSelect();
          onOpen();
        }}
        onFocus={onSelect}
        aria-label={`Open ${record.type} record: ${record.title}`}
      >
        <div className={`${styles.media} ${mediaClass[record.type]}`}>
          <span className={styles.mediaLabel}>{record.card?.media?.label ?? mediaLabels[record.type]}</span>
          {placement !== "organic" ? (
            <span className={styles.placement}>{placement === "sponsored" ? "Sponsored" : "Featured"}</span>
          ) : null}
        </div>

        <div className={styles.content}>
          <div className={styles.topline}>
            <span className={styles.eyebrow}>{record.card?.eyebrow ?? mediaLabels[record.type]}</span>
            {status ? (
              <span className={`${styles.status} ${statusClass[status.tone ?? "neutral"]}`}>{status.label}</span>
            ) : null}
          </div>

          <p className={styles.organization}>{record.organization}</p>
          <div className={styles.heading}>
            <h3>{record.title}</h3>
            <span aria-hidden>›</span>
          </div>

          <p className={styles.summary}>{record.summary}</p>

          <div className={styles.spatial}>
            <span>{record.geography}</span>
            {record.card?.distance ? <span>{record.card.distance}</span> : null}
            <span>{record.location ? "Mapped" : "Off map"}</span>
          </div>

          {record.card?.classifications?.length ? (
            <div className={styles.classifications} aria-label="Classifications">
              {record.card.classifications.slice(0, 2).map((item) => <span key={item}>{item}</span>)}
            </div>
          ) : null}

          {visibleMetadata.length ? (
            <div className={styles.metadata} aria-label="Record metadata">
              {visibleMetadata.slice(0, 2).map((item) => <span key={item}>{item}</span>)}
            </div>
          ) : null}

          {relationships.size ? (
            <div className={styles.relationships} aria-label="Relationship state">
              {[...relationships].slice(0, 2).map((relationship) => {
                const label = relationshipLabels[relationship];
                return label ? <span key={relationship}>{label}</span> : null;
              })}
            </div>
          ) : null}
        </div>
      </button>

      {provider?.claimState === "unclaimed" ? (
        <div className={providerStyles.cardBanner}>
          <span><strong>Unclaimed listing</strong> · Source: {provider.source.sourceName}</span>
          {claimHref ? <a className={providerStyles.claimLink} href={claimHref}>Claim listing</a> : null}
        </div>
      ) : null}

      <div className={styles.actionDock}>
        <RecordActionRow
          actions={actions}
          maxVisible={3}
          label={`Actions for ${record.title}`}
          onAction={(action) => {
            onSelect();
            onAction(action);
          }}
        />
      </div>

      <button
        type="button"
        className={styles.favorite}
        aria-label={record.saved ? `Remove ${record.title} from saved records` : `Save ${record.title}`}
        aria-pressed={Boolean(record.saved)}
        onClick={onToggleSave}
      >
        <span aria-hidden>{record.saved ? "★" : "☆"}</span>
      </button>
    </article>
  );
}
