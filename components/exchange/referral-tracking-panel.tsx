"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "./referral-tracking-panel.module.css";

type ReferralTrackingRecord = {
  id: string;
  direction: "sent" | "received";
  status: string;
  recordTitle?: string;
  senderOrganization: string;
  recipientOrganization: string;
  createdAt: string;
};

function statusLabel(value: string) {
  return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

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
      if (!response.ok) throw new Error(body.error ?? "Referrals could not be loaded.");
      setRecords(body.referrals ?? []);
      setStatus("ready");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Referrals could not be loaded.");
      setStatus("error");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <section className={styles.panel} aria-label="Referral summary">
      <div className={styles.header}>
        <h3>Recent referrals</h3>
        <button type="button" onClick={() => { void load(); }}>Refresh</button>
      </div>
      {status === "loading" ? <p className={styles.status}>Loading…</p> : null}
      {status === "error" ? <p className={`${styles.status} ${styles.error}`} role="alert">{error}</p> : null}
      {status === "ready" && records.length === 0 ? <p className={styles.status}>No referrals yet.</p> : null}
      {status === "ready" && records.length ? (
        <div className={styles.list}>
          {records.slice(0, 8).map((record) => (
            <div className={styles.item} key={record.id}>
              <div>
                <strong>{record.recordTitle ?? "Referral"}</strong>
                <span>{record.direction === "sent" ? `To ${record.recipientOrganization}` : `From ${record.senderOrganization}`}</span>
              </div>
              <div className={styles.trailing}>
                <span>{statusLabel(record.status)}</span>
                <time dateTime={record.createdAt}>{new Date(record.createdAt).toLocaleDateString()}</time>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
