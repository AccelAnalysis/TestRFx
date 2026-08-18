"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReferralTrackingRecord } from "@/lib/exchange/referrals";
import styles from "./referral-tracking-panel.module.css";

export function ReferralTrackingPanel() {
  const [records, setRecords] = useState<ReferralTrackingRecord[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setStatus("loading");
    setError("");
    try {
      const response = await fetch("/api/exchange/referrals", { credentials: "same-origin", cache: "no-store" });
      const body = await response.json().catch(() => ({})) as { referrals?: ReferralTrackingRecord[]; error?: string };
      if (!response.ok) throw new Error(body.error ?? "Referral tracking could not be loaded.");
      setRecords(body.referrals ?? []);
      setStatus("ready");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Referral tracking could not be loaded.");
      setStatus("error");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <section className={styles.panel} aria-label="Referral tracking">
      <div className={styles.header}><h3>Referral tracking</h3><button type="button" onClick={() => { void load(); }}>Refresh</button></div>
      {status === "loading" ? <p className={styles.status}>Loading referrals…</p> : null}
      {status === "error" ? <p className={`${styles.status} ${styles.error}`} role="alert">{error}</p> : null}
      {status === "ready" && records.length === 0 ? <p className={styles.status}>No referrals are currently tracked for this organization.</p> : null}
      {status === "ready" && records.length ? <div className={styles.list}>{records.map((record) => (
        <article className={styles.item} key={record.id}>
          <div className={styles.itemTop}><strong>{record.recordTitle ?? "Exchange referral"}</strong><span className={styles.badge}>{record.status}</span></div>
          <p>{record.direction === "sent" ? `Sent to ${record.recipientOrganization}` : `Received from ${record.senderOrganization}`}</p>
          {record.message ? <p>{record.message}</p> : null}
          <div className={styles.meta}><span>{record.direction}</span><span>{new Date(record.createdAt).toLocaleString()}</span>{record.feeSummary ? <span>{record.feeSummary}</span> : null}</div>
        </article>
      ))}</div> : null}
    </section>
  );
}
