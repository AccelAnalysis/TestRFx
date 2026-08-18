"use client";

import type { ExchangeRecord } from "@/lib/exchange/contracts";
import { isResourceRecord } from "@/lib/exchange/resources";
import styles from "./resources.module.css";

export function ResourceDetail({ record, onRefer }: { record: ExchangeRecord; onRefer?: () => void }) {
  if (!isResourceRecord(record)) return null;

  const mapLabel = record.location
    ? "Mapped public location"
    : record.resource.visibility === "service-area"
      ? "Service area only"
      : "Off-map resource";

  return (
    <>
      <div className={styles.detailGrid}>
        <div className={styles.detailItem}><span>Category</span><strong>{record.resource.category}</strong></div>
        <div className={styles.detailItem}><span>Availability</span><strong>{record.resource.availabilityLabel}</strong></div>
        <div className={styles.detailItem}><span>Capacity</span><strong>{record.resource.capacity ?? "Provider confirms capacity"}</strong></div>
        <div className={styles.detailItem}><span>Geography</span><strong>{record.resource.serviceArea ?? record.geography}</strong></div>
        <div className={styles.detailItem}><span>Map presence</span><strong>{mapLabel}</strong></div>
        <div className={styles.detailItem}><span>Provider</span><strong>{record.organization}</strong></div>
      </div>
      {record.resource.terms ? <div className={styles.detailCallout}><p><strong>Resource terms:</strong> {record.resource.terms}</p></div> : null}
      <div className={styles.detailCallout}>
        <p><strong>Cross-lens referral:</strong> refer this Resource through the shared referral workflow, review the receiving organization’s referral policy / fee, then track the referral in Menu → Referrals Management.</p>
        {onRefer ? <button className={styles.detailAction} type="button" onClick={onRefer}>Refer this resource</button> : null}
      </div>
    </>
  );
}
