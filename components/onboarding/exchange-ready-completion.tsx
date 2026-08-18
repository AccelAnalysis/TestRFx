import Link from "next/link";
import type { ExchangeReadinessSnapshot, ReadinessItem } from "@/lib/onboarding/readiness";
import { readinessItemSatisfied } from "@/lib/onboarding/readiness";
import { CompletionNavigation } from "./completion-navigation";
import styles from "./exchange-ready-completion.module.css";
import extras from "./exchange-ready-extras.module.css";

interface ExchangeReadyCompletionProps {
  readiness: ExchangeReadinessSnapshot;
  returnTo: string;
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
        <div className={extras.itemActions}>
          <Link href={item.href}>{satisfied ? "Review workflow" : item.blocking ? "Resolve now" : "Continue enrichment"}</Link>
          {item.detailHref ? <Link href={item.detailHref}>Review details</Link> : null}
        </div>
      </div>
      <span className={styles.itemValue}>{item.value ?? statusLabels[item.status]}</span>
    </div>
  );
}

export function ExchangeReadyCompletion({ readiness, returnTo }: ExchangeReadyCompletionProps) {
  const requiredItems = readiness.items.filter((item) => item.classification === "required");
  const enrichmentItems = readiness.items.filter((item) => item.classification !== "required");
  const organization = readiness.organization;
  const readinessLabel =
    readiness.state === "blocked"
      ? "Needs attention"
      : readiness.state === "ready"
        ? "Exchange ready"
        : "Ready — enrichment can continue";
  const activationHref = `/onboarding/completion/activate?returnTo=${encodeURIComponent(returnTo)}`;

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
              RFxchange now evaluates the progress saved by the actual onboarding workflows. Required identity, organization, geography, profile, capability, visibility, and participation checks gate activation; AMACS depth, evidence, certifications, keywords, and specialties remain progressive.
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
              <p className={styles.metricNote}>{readiness.requiredComplete} of {readiness.requiredTotal} required checks complete.</p>
            </div>
            <div className={styles.metricRow}>
              <div className={styles.metricLabel}>
                <span>Profile completeness</span>
                <strong>{readiness.profileCompletenessPercent}%</strong>
              </div>
              <progress className={`${styles.progress} ${styles.profileProgress}`} value={readiness.profileCompletenessPercent} max={100}>
                {readiness.profileCompletenessPercent}%
              </progress>
              <p className={styles.metricNote}>Progressive enrichment can continue after Exchange entry.</p>
            </div>
          </div>
        </section>

        <div className={styles.contentGrid}>
          <div>
            <section className={styles.panel} aria-labelledby="required-heading">
              <div className={styles.sectionHeading}>
                <div>
                  <h2 id="required-heading">Required for Exchange entry</h2>
                  <p>Every missing item links directly to the onboarding workflow that owns the underlying state.</p>
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
                  <p>These source-defined enrichment steps remain revisitable and do not become artificial access gates.</p>
                </div>
                <span className={styles.countPill}>Non-blocking</span>
              </div>
              <div className={styles.itemList}>
                {enrichmentItems.map((item) => <ReadinessRow item={item} key={item.id} />)}
              </div>
            </section>
          </div>

          <aside className={styles.sidebar}>
            <CompletionNavigation readiness={readiness} activePath="/onboarding/completion" />

            <section className={styles.presenceCard} aria-labelledby="presence-heading">
              <h2 id="presence-heading">Exchange presence</h2>
              <p>The preview is derived from onboarding progress rather than a seeded completion record.</p>

              <div className={styles.orgIdentity}>
                <span className={styles.orgMark} aria-hidden="true">R</span>
                <div>
                  <strong>{organization.name ?? "Organization not yet resolved"}</strong>
                  <span>{organization.geography ?? "Geography not yet established"}</span>
                </div>
              </div>

              <dl className={styles.presenceMeta}>
                <div>
                  <dt>Visibility</dt>
                  <dd>{organization.visibility ?? "Not yet selected"}</dd>
                </div>
                <div>
                  <dt>Map state</dt>
                  <dd>{organization.mapPresence === "marker_ready" ? "Marker ready" : "Off-map / no published point"}</dd>
                </div>
                <div>
                  <dt>AMACS</dt>
                  <dd>{organization.amacsSummary ?? "Not yet reviewed"}</dd>
                </div>
                <div>
                  <dt>Access</dt>
                  <dd>{organization.entitlementSummary ?? "Not yet resolved"}</dd>
                </div>
              </dl>

              <div className={styles.tags} aria-label="Capability summary">
                {organization.capabilitySummary.length ? organization.capabilitySummary.map((capability) => (
                  <span className={styles.tag} key={capability}>{capability}</span>
                )) : <span className={extras.emptyTag}>No capability summary yet</span>}
              </div>
            </section>

            <section className={styles.handoffCard} aria-labelledby="handoff-heading">
              <h2 id="handoff-heading">Activation workflow</h2>
              <p>Completion is a controlled handoff into the existing Exchange chassis.</p>
              <ul className={styles.handoffList}>
                <li><span>1</span><div>Re-evaluate the saved required checkpoints.</div></li>
                <li><span>2</span><div>Confirm the organization&apos;s Exchange-facing presence and participation state.</div></li>
                <li><span>3</span><div>Persist the onboarding activation state for this RFxchange session.</div></li>
                <li><span>4</span><div>Show the Exchange-ready confirmation and enter the existing RFx, Resources, Intelligence, or Capabilities lens.</div></li>
              </ul>
            </section>
          </aside>
        </div>

        <section className={styles.actionBar} aria-label="Completion actions">
          <div className={styles.actionCopy}>
            <strong>{readiness.exchangeAccessAllowed ? "All blocking readiness checks are complete." : "Required items still need attention."}</strong>
            <span>
              {readiness.exchangeAccessAllowed
                ? "Review the activation handoff, then enter the Exchange."
                : "Use the Resolve links above; your completed progress is saved for later."}
            </span>
          </div>
          <div className={styles.actions}>
            <Link className={styles.secondaryLink} href="/onboarding">Save and finish later</Link>
            {readiness.exchangeAccessAllowed ? (
              <Link className={styles.primaryButton} href={activationHref}>Review activation</Link>
            ) : (
              <span className={`${styles.primaryButton} ${extras.primaryDisabled}`} aria-disabled="true">Activation blocked</span>
            )}
          </div>
        </section>

        <p className={styles.boundaryNote}>
          Completion progress is saved by the onboarding workflows themselves. Exchange authorization must still be enforced independently by the authenticated server/session boundary; this readiness state does not substitute for authorization.
        </p>
      </div>
    </main>
  );
}
