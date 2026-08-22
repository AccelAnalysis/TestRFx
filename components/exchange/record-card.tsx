"use client";

import type { ExchangeRecord, LensAction } from "@/lib/exchange/contracts";
import { buildCardPresentation } from "@/lib/exchange/card-presentation";
import { getResourceProviderListing } from "@/lib/resources/provider-listing";
import { resourceProviderClaimHref } from "@/lib/resources/claim-handoff";
import { CardMedia } from "./card-media";
import { RecordActionRow } from "./record-actions";
import styles from "./record-card.module.css";
import providerStyles from "./resource-provider-listing.module.css";

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
  const presentation = buildCardPresentation(record);
  const provider = getResourceProviderListing(record);
  const claimHref = provider?.claimState === "unclaimed" ? resourceProviderClaimHref(record) : undefined;
  const visibleStatus = provider?.claimState === "unclaimed" ? undefined : presentation.status;
  const identityLabel = presentation.subtitle ? `${presentation.title}. ${presentation.subtitle}` : presentation.title;

  function openRecord() {
    onSelect();
    onOpen();
  }

  return (
    <article
      className={`${styles.card} ${record.ownedByViewer ? styles.owned : ""} ${selected ? styles.selected : ""} ${presentation.placement === "sponsored" ? styles.sponsored : ""}`}
      data-record-id={record.id}
      data-record-type={record.type}
      data-selected={selected ? "true" : "false"}
      data-owned={record.ownedByViewer ? "true" : "false"}
      data-claim-state={provider?.claimState}
    >
      <CardMedia
        record={record}
        media={presentation.media}
        placement={presentation.placement}
        status={visibleStatus}
        onSelect={onSelect}
        onOpen={onOpen}
      />

      <button
        className={styles.identity}
        type="button"
        onClick={openRecord}
        onFocus={onSelect}
        aria-label={`Open ${identityLabel}`}
      >
        <h3>{presentation.title}</h3>
        {presentation.subtitle ? <p className={styles.subtitle}>{presentation.subtitle}</p> : null}
        {presentation.contextLine ? <p className={styles.context}>{presentation.contextLine}</p> : null}
        {presentation.classifications.length ? (
          <p className={styles.classification}>{presentation.classifications.join(" · ")}</p>
        ) : null}
      </button>

      {provider?.claimState === "unclaimed" ? (
        <div className={providerStyles.cardBanner}>
          <span>Unclaimed listing</span>
          {claimHref ? <a className={providerStyles.claimLink} href={claimHref}>Claim</a> : null}
        </div>
      ) : null}

      <div className={styles.actionDock}>
        <div className={styles.actionSlot}>
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
        <button type="button" className={styles.detailButton} onClick={openRecord}>
          {presentation.detailLabel}
        </button>
      </div>

      <button
        type="button"
        className={styles.favorite}
        aria-label={record.saved ? `Remove ${record.title} from saved records` : `Save ${record.title}`}
        aria-pressed={Boolean(record.saved)}
        onClick={() => {
          onSelect();
          onToggleSave();
        }}
      >
        <span aria-hidden>{record.saved ? "★" : "☆"}</span>
      </button>
    </article>
  );
}
