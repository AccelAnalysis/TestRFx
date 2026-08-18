"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "@/app/onboarding/membership/membership.module.css";

export function MembershipSelectionClient({
  foundingName,
  foundingPrice,
  foundingCapacity,
  requestedPlan,
}: {
  foundingName: string;
  foundingPrice: string;
  foundingCapacity: number;
  requestedPlan: "free" | "founding";
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function chooseFree() {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/onboarding/membership/selection", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan: "free" }),
      });
      const payload = (await response.json()) as { error?: string; nextPath?: string };
      if (!response.ok || !payload.nextPath) {
        setError(payload.error ?? "Participation could not be activated.");
        return;
      }
      router.push(payload.nextPath);
    } catch {
      setError("Participation could not be activated. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="identity-shell onboarding-shell">
      <section className="identity-card onboarding-card">
        <p className="eyebrow">Participation & membership</p>
        <h1>Choose how this organization enters RFxchange</h1>
        <p className="muted">
          Exchange readiness and commercial membership are separate. Free organization participation can activate now; Founding Membership requires a verified Stripe payment before any paid entitlement is granted.
        </p>

        <div className={styles.planGrid}>
          <article className={`${styles.summary} ${requestedPlan === "free" ? styles.selectedPlan : ""}`}>
            <div className={styles.summaryHeader}>
              <div>
                <p className="eyebrow">Core participation</p>
                <h2>Free organization</h2>
              </div>
              <div className={styles.price}>$0 <small>/ month</small></div>
            </div>
            <div className={styles.details}>
              <div className={styles.detail}><strong>Owner</strong><span>Organization-level participation</span></div>
              <div className={styles.detail}><strong>Readiness</strong><span>Satisfies the participation entitlement gate</span></div>
              <div className={styles.detail}><strong>Credibility</strong><span>Does not create verification, evidence, or authority</span></div>
            </div>
            <button className={styles.activeButton} type="button" onClick={() => void chooseFree()} disabled={saving}>
              {saving ? "Activating…" : "Continue with Free participation"}
            </button>
          </article>

          <article className={`${styles.summary} ${requestedPlan === "founding" ? styles.selectedPlan : ""}`}>
            <div className={styles.summaryHeader}>
              <div>
                <p className="eyebrow">Optional membership</p>
                <h2>{foundingName}</h2>
              </div>
              <div className={styles.price}>{foundingPrice} <small>/ month</small></div>
            </div>
            <div className={styles.details}>
              <div className={styles.detail}><strong>Owner</strong><span>Organization-level membership</span></div>
              <div className={styles.detail}><strong>Capacity</strong><span>First {foundingCapacity} organizations</span></div>
              <div className={styles.detail}><strong>Activation</strong><span>Only after verified payment confirmation</span></div>
            </div>
            <div className={styles.integrationNote}>
              <strong>Secure checkout is not connected.</strong> RFxchange will not simulate a Stripe payment or unlock paid membership from client-side state. You can continue free now and return to Founding Membership later.
            </div>
            <button className={styles.disabledButton} type="button" disabled aria-disabled="true">Secure checkout unavailable</button>
          </article>
        </div>

        {error ? <p className={styles.error} role="alert">{error}</p> : null}
        <div className={styles.footerLinks}>
          <Link className={styles.backLink} href="/onboarding/completion">Back to Exchange-ready review</Link>
          <Link className={styles.backLink} href="/founding">Review Founding Membership</Link>
        </div>
      </section>
    </main>
  );
}
