"use client";

import Link from "next/link";
import { useState } from "react";
import type {
  ExchangeActivation,
  ExchangeReadinessSnapshot,
  ReadinessItem,
} from "@/lib/onboarding/readiness";
import { readinessItemSatisfied } from "@/lib/onboarding/readiness";
import styles from "./exchange-ready-completion.module.css";

interface ExchangeReadyCompletionProps {
  readiness: ExchangeReadinessSnapshot;
  returnTo: string;
}

interface ActivationResponse {
  error?: string;
  activation?: ExchangeActivation;
}

const statusLabels: Record<ReadinessItem["status"], string> = {
  complete: "Complete",
  needs_attention: "Needs attention",
  recommended: "Recommended",
  not_applicable: "Not applicable",
  processing: "Processing",
  blocked: "Blocked",
};

function ReadinessRow({ item }: { item: ReadinessItem }) {
  const satisfied = readinessItemSatisfied(item);

  return (
    <div className={`${styles.item} ${satisfied ? styles.itemComplete : styles.itemAttention}`}>
      <span className={styles.statusIcon} aria-hidden="true">
        {satisfied ? "✓" : item.blocking ? "!" : "+"}
      </span>
      <div className={styles.itemBody}>
        <strong>{item.label}</strong>
        <p>{item.description}</p>
      </div>
      <span className={styles.itemValue}>{item.value ?? statusLabels[item.status]}</span>
    </div>
  );
}

export function ExchangeReadyCompletion({ readiness, returnTo }: ExchangeReadyCompletionProps) {
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requiredItems = readiness.items.filter((item) => item.classification === "required");
  const enrichmentItems = readiness.items.filter((item) => item.classification !== "required");
  const organization = readiness.organization;
  const readinessLabel =
    readiness.state === "blocked"
      ? "Needs attention"
      : readiness.state === "ready"
        ? "Exchange ready"
        : "Ready — enrichment can continue";

  async function enterExchange() {
    setActivating(true);
    setError(null);

    try {
      const response = await fetch("/api/onboarding/readiness/activate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ returnTo }),
      });
      const payload = (await response.json()) as ActivationResponse;

      if (!response.ok || !payload.activation) {
        setError(payload.error ?? "RFxchange could not activate Exchange access. Review the required items and try again.");
        return;
      }

      window.location.assign(payload.activation.destination);
    } catch {
      setError("RFxchange could not complete the activation request. Please try again.");
    } finally {
      setActivating(false);
    }
  }

  return (
    <main className={styles.shell}>
      <div className={styles.frame}>
        <header className={styles.topbar}>
          <span className={styles.brand}>RFxchange</span>
          <span className={styles.stepPill}>Step 9 of 10 · Review & completion</span>
        </header>

        <section className={styles.hero} aria-labelledby="completion-title">
          <div className={styles.heroCard}>
            <p className={styles.eyebrow}>Exchange onboarding</p>
            <h1 id="completion-title">Review your Exchange readiness</h1>
            <p className={styles.heroCopy}>
              Required identity, organization, geography, capability, visibility, and access checks determine whether you can enter. Recommended enrichment improves discovery and matching, but it does not keep an otherwise-ready organization outside the Exchange.
            </p>
          </div>

          <div className={styles.metricCard} aria-label="Readiness summary">
            <span className={styles.stateBadge} role="status">{readinessLabel}</span>
            <div className={styles.metricRow}>
              <div className={styles.metricLabel}>
                <span>Exchange readiness</span>
                <strong>{readiness.readinessPercent}%</strong>
              </div>
              <progress className={styles.progress} value={readiness.readinessPercent} max={100}>
                {readiness.readinessPercent}%
              </progress>
              <p className={styles.metricNote}>
                {readiness.requiredComplete} of {readiness.requiredTotal} required checks complete.
              </p>
            </div>
            <div className={styles.metricRow}>
              <div className={styles.metricLabel}>
                <span>Profile completeness</span>
                <strong>{readiness.profileCompletenessPercent}%</strong>
              </div>
              <progress
                className={`${styles.progress} ${styles.profileProgress}`}
                value={readiness.profileCompletenessPercent}
                max={100}
              >
                {readiness.profileCompletenessPercent}%
              </progress>
              <p className={styles.metricNote}>A richer profile can be built progressively after entry.</p>
            </div>
          </div>
        </section>

        <div className={styles.contentGrid}>
          <div>
            <section className={styles.panel} aria-labelledby="required-heading">
              <div className={styles.sectionHeading}>
                <div>
                  <h2 id="required-heading">Required for Exchange entry</h2>
                  <p>These are the readiness gates the server must revalidate before activation.</p>
                </div>
                <span className={styles.countPill}>{readiness.requiredComplete}/{readiness.requiredTotal} complete</span>
              </div>
              <div className={styles.itemList}>
                {requiredItems.map((item) => <ReadinessRow item={item} key={item.id} />)}
              </div>
            </section>

            <section className={styles.panel} aria-labelledby="enrichment-heading">
              <div className={styles.sectionHeading}>
                <div>
                  <h2 id="enrichment-heading">Continue enriching</h2>
                  <p>AMACS alignment, evidence, certifications, keywords, and specialties remain revisitable after entry.</p>
                </div>
                <span className={styles.countPill}>Non-blocking</span>
              </div>
              <div className={styles.itemList}>
                {enrichmentItems.map((item) => <ReadinessRow item={item} key={item.id} />)}
              </div>
            </section>
          </div>

          <aside className={styles.sidebar}>
            <section className={styles.presenceCard} aria-labelledby="presence-heading">
              <h2 id="presence-heading">Your Exchange presence</h2>
              <p>This is the organization context that will carry into the authenticated chassis.</p>

              <div className={styles.orgIdentity}>
                <span className={styles.orgMark} aria-hidden="true">R</span>
                <div>
                  <strong>{organization.name}</strong>
                  <span>{organization.geography}</span>
                </div>
              </div>

              <dl className={styles.presenceMeta}>
                <div>
                  <dt>Visibility</dt>
                  <dd>{organization.visibility}</dd>
                </div>
                <div>
                  <dt>Map state</dt>
                  <dd>{organization.mapPresence === "marker_ready" ? "Marker ready" : "Off-map presence"}</dd>
                </div>
                <div>
                  <dt>AMACS</dt>
                  <dd>{organization.amacsSummary}</dd>
                </div>
                <div>
                  <dt>Access</dt>
                  <dd>{organization.entitlementSummary}</dd>
                </div>
              </dl>

              <div className={styles.tags} aria-label="Capability summary">
                {organization.capabilitySummary.map((capability) => (
                  <span className={styles.tag} key={capability}>{capability}</span>
                ))}
              </div>
            </section>

            <section className={styles.handoffCard} aria-labelledby="handoff-heading">
              <h2 id="handoff-heading">What activation does</h2>
              <p>Completion is a controlled handoff, not a separate dashboard.</p>
              <ul className={styles.handoffList}>
                <li><span>1</span><div>Revalidate blocking readiness and the organization access state.</div></li>
                <li><span>2</span><div>Publish the organization&apos;s Exchange-visible presence and map/off-map state.</div></li>
                <li><span>3</span><div>Queue search, capability, matching, and activity/indexing work behind the application boundary.</div></li>
                <li><span>4</span><div>Open the existing persistent Exchange shell without creating a new onboarding-only home.</div></li>
              </ul>
            </section>
          </aside>
        </div>

        <section className={styles.actionBar} aria-label="Completion actions">
          <div className={styles.actionCopy}>
            <strong>{readiness.exchangeAccessAllowed ? "You can enter the Exchange." : "Required items still need attention."}</strong>
            <span>
              {readiness.exchangeAccessAllowed
                ? "Your organization can keep improving its profile and capabilities after entry."
                : "Return to onboarding and resolve the blocking items before activation."}
            </span>
          </div>
          <div className={styles.actions}>
            <Link className={styles.secondaryLink} href="/onboarding">Save and finish later</Link>
            <button
              className={styles.primaryButton}
              type="button"
              disabled={!readiness.exchangeAccessAllowed || activating}
              onClick={enterExchange}
            >
              {activating ? "Activating…" : "Enter the Exchange"}
            </button>
          </div>
          {error ? <p className={styles.error} role="alert">{error}</p> : null}
        </section>

        <p className={styles.boundaryNote}>
          Reference mode: this screen exercises the chassis contract with deterministic readiness data. Production identity, organization, geography, entitlement, persistence, indexing, and audit services replace the reference adapter behind the same boundary.
        </p>
      </div>
    </main>
  );
}
