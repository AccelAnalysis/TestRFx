"use client";

import type { ExchangeRecord } from "@/lib/exchange/contracts";
import {
  referenceActorContext,
  sharedServiceDefinitions,
  type RelationshipKind,
  type SharedServiceId,
  type SharedWorkflowEvent,
} from "@/lib/exchange/shared-workflows";
import styles from "./shared-workflow-surface.module.css";

const relationshipLabels: Record<RelationshipKind, string> = { saved: "Saved", watching: "Watching", tracking: "Tracking", following: "Following" };

export function SharedServiceSurface({ service, events, relationships, records, onClose }: {
  service: SharedServiceId;
  events: SharedWorkflowEvent[];
  relationships: Record<string, RelationshipKind[]>;
  records: ExchangeRecord[];
  onClose: () => void;
}) {
  const definition = sharedServiceDefinitions[service];
  const relationshipRecords = records.filter((record) => (relationships[record.id] ?? []).length > 0);
  const referralEvents = events.filter((event) => event.workflow === "refer");

  return (
    <div className={styles.backdrop} role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <section className={styles.panel} role="dialog" aria-modal="true" aria-label={definition.label}>
        <header className={styles.header}>
          <div><p className={styles.eyebrow}>Cross-lens management</p><h2>{definition.label}</h2></div>
          <button className={styles.close} type="button" onClick={onClose} aria-label="Close service">×</button>
        </header>
        <p>{definition.description}</p>
        <div className={styles.notice}><strong>Management surface, not a lens.</strong> Opening this service leaves the mounted Exchange context intact underneath it.</div>

        {service === "saved" ? (
          <div className={styles.serviceGrid}>
            {relationshipRecords.length ? relationshipRecords.map((record) => (
              <article className={styles.item} key={record.id}><strong>{record.title}</strong><small>{record.organization}</small><div className={styles.badges}>{(relationships[record.id] ?? []).map((kind) => <span className={styles.badge} key={kind}>{relationshipLabels[kind]}</span>)}</div></article>
            )) : <div className={styles.empty}>No saved, watched, tracked, or followed records in this reference session.</div>}
          </div>
        ) : null}

        {service === "referrals" ? (
          <div className={styles.serviceGrid}>
            {referralEvents.length ? referralEvents.map((event) => <article className={styles.item} key={event.id}><strong>{event.recordTitle}</strong><small>{String(event.payload.recipientOrganization ?? "Recipient pending")} · {event.occurredAt}</small></article>) : <div className={styles.empty}>No referrals have been created in this reference session.</div>}
          </div>
        ) : null}

        {service === "notifications" ? (
          <div className={styles.serviceGrid}>
            {events.length ? events.map((event) => <article className={styles.item} key={event.id}><strong>{event.eventName}</strong><small>{event.recordTitle} · {event.occurredAt}</small></article>) : <div className={styles.empty}>Workflow events will appear here as in-app reference notifications.</div>}
          </div>
        ) : null}

        {service === "membership" ? (
          <div className={styles.stack}>
            <article className={styles.item}><strong>{referenceActorContext.organizationName}</strong><small>Reference organization context</small><div className={styles.badges}><span className={styles.badge}>{referenceActorContext.membership} membership</span><span className={styles.badge}>{referenceActorContext.role}</span></div></article>
            <div className={styles.notice}>Production membership, Stripe payment state, credits, referral fees, and payouts remain server-authoritative integrations. This surface only proves the Menu-to-service chassis boundary.</div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
