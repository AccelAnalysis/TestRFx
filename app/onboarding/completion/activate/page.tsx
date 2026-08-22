import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { CompletionActivationClient } from "@/components/onboarding/completion-activation-client";
import styles from "@/components/onboarding/completion-transition.module.css";
import { resolveExchangeDestination } from "@/lib/onboarding/readiness";
import {
  loadAuthoritativeReadiness,
  OnboardingReadinessError,
} from "@/lib/server/onboarding/readiness-service";

export const dynamic = "force-dynamic";

export default async function CompletionActivationPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const requested = Array.isArray(params.returnTo) ? params.returnTo[0] : params.returnTo;
  const returnTo = resolveExchangeDestination(requested);
  const requestHeaders = await headers();

  let readiness;
  try {
    readiness = await loadAuthoritativeReadiness(requestHeaders.get("cookie"));
  } catch (error) {
    if (error instanceof OnboardingReadinessError && error.status === 401) {
      redirect(`/login?returnTo=${encodeURIComponent(`/onboarding/completion/activate?returnTo=${returnTo}`)}`);
    }
    throw error;
  }

  const organization = readiness.organization;
  return (
    <main className={styles.shell}>
      <div className={styles.frame}>
        <header className={styles.topbar}>
          <span className={styles.brand}>RFxchange</span>
          <span className={styles.step}>Step 9 · Publish & activate</span>
        </header>
        <div className={styles.grid}>
          <section className={styles.card}>
            <h1>Confirm Exchange presence</h1>
            <p>
              Activation performs a fresh server-side readiness check, records the Exchange-ready handoff, and preserves the requested destination. It does not invent a coordinate, verification badge, capability, or membership state.
            </p>
            <dl className={styles.summary}>
              <div><dt>Organization</dt><dd>{organization.name}</dd></div>
              <div><dt>Geography</dt><dd>{organization.geography}</dd></div>
              <div><dt>Visibility</dt><dd>{organization.visibility}</dd></div>
              <div><dt>Map presence</dt><dd>{organization.mapPresence === "marker_ready" ? "Marker ready" : "Off-map presence"}</dd></div>
              <div><dt>Participation</dt><dd>{organization.entitlementSummary}</dd></div>
              <div><dt>Destination</dt><dd>{returnTo}</dd></div>
            </dl>
            {readiness.exchangeAccessAllowed ? (
              <>
                <ul className={styles.checklist}>
                  <li><span>✓</span><div>All blocking readiness checks are currently satisfied.</div></li>
                  <li><span>✓</span><div>AMACS, evidence, certification, keyword, and specialty enrichment can continue after entry.</div></li>
                  <li><span>✓</span><div>The activation record is an audit handoff; canonical onboarding domains remain the source of truth.</div></li>
                </ul>
                <CompletionActivationClient readiness={readiness} returnTo={returnTo} />
              </>
            ) : (
              <div className={styles.notice}>
                <strong>Activation is blocked.</strong> {readiness.blockingItemIds.length} required readiness check{readiness.blockingItemIds.length === 1 ? " is" : "s are"} incomplete.
              </div>
            )}
            <Link className={styles.secondaryLink} href={`/onboarding/completion?returnTo=${encodeURIComponent(returnTo)}`}>← Back to readiness review</Link>
          </section>
          <aside className={styles.card}>
            <h2>Controlled handoff</h2>
            <p>The activation API re-runs the authoritative checks. A stale browser state cannot grant Exchange-ready status.</p>
            <ul className={styles.checklist}>
              <li><span>1</span><div>Re-read identity and organization membership.</div></li>
              <li><span>2</span><div>Re-read geography, profile, capability, visibility, and entitlement state.</div></li>
              <li><span>3</span><div>Persist the activation snapshot and activity event transactionally.</div></li>
              <li><span>4</span><div>Advance to Step 10 and the existing Exchange shell.</div></li>
            </ul>
          </aside>
        </div>
      </div>
    </main>
  );
}
