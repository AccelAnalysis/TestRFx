"use client";

import { useEffect, useState } from "react";
import type { ExchangeRecord } from "@/lib/exchange/contracts";
import styles from "./shared-workflow-surface.module.css";

type ReferralPolicy = {
  organizationName: string;
  configured: boolean;
  policy: Record<string, unknown>;
  fee: Record<string, unknown>;
  publishedAt?: string;
};

const referenceMode = process.env.NEXT_PUBLIC_RFXCHANGE_REFERENCE_MODE === "1";

function entries(value: Record<string, unknown>) {
  return Object.entries(value).filter(([, item]) => typeof item === "string" || typeof item === "number" || typeof item === "boolean");
}

export function ReferralPolicySurface({ record, onClose }: { record: ExchangeRecord; onClose: () => void }) {
  const [policy, setPolicy] = useState<ReferralPolicy>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(!referenceMode);

  useEffect(() => {
    if (referenceMode) return;
    let active = true;
    fetch(`/api/exchange/referrals/policy?recordId=${encodeURIComponent(record.id)}`)
      .then(async (response) => {
        const body = await response.json().catch(() => ({})) as { error?: string; policy?: ReferralPolicy };
        if (!response.ok || !body.policy) throw new Error(body.error ?? "Referral policy could not be loaded.");
        if (active) setPolicy(body.policy);
      })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Referral policy could not be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [record.id]);

  return (
    <div className={styles.backdrop} role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <section className={styles.panel} role="dialog" aria-modal="true" aria-label="Recipient referral policy and fee">
        <header className={styles.header}><div><p className={styles.eyebrow}>Cross-lens referral</p><h2>Recipient referral policy / fee</h2></div><button className={styles.close} type="button" onClick={onClose} aria-label="Close referral policy">×</button></header>
        <div className={styles.record}><strong>{record.organization}</strong><span>Source record: {record.title}</span></div>
        {referenceMode ? <div className={styles.notice}>The static preview does not invent a recipient policy or fee. The server-capable app loads the organization's published policy from PostgreSQL.</div> : null}
        {loading ? <p className={styles.muted}>Loading published recipient policy…</p> : null}
        {error ? <div className={styles.notice} role="alert">{error}</div> : null}
        {policy && !policy.configured ? <div className={styles.notice}><strong>No published policy is configured.</strong> RFxchange does not synthesize a fee when the recipient organization has not published one.</div> : null}
        {policy?.configured ? <div className={styles.stack}>
          <article className={styles.item}><strong>Policy</strong>{entries(policy.policy).map(([key, value]) => <small key={key}>{key}: {String(value)}</small>)}</article>
          <article className={styles.item}><strong>Fee</strong>{entries(policy.fee).map(([key, value]) => <small key={key}>{key}: {String(value)}</small>)}</article>
          {policy.publishedAt ? <p className={styles.muted}>Published {new Date(policy.publishedAt).toLocaleString()}</p> : null}
        </div> : null}
        <div className={styles.actions}><button className={styles.secondary} type="button" onClick={onClose}>Back</button></div>
      </section>
    </div>
  );
}
