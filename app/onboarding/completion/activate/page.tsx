import Link from "next/link";
import { cookies } from "next/headers";
import { CompletionActivationClient } from "@/components/onboarding/completion-activation-client";
import { CompletionNavigation } from "@/components/onboarding/completion-navigation";
import styles from "@/components/onboarding/completion-transition.module.css";
import { buildExchangeReadiness, resolveExchangeDestination } from "@/lib/onboarding/readiness";
import {
  ONBOARDING_PROGRESS_COOKIE,
  readOnboardingProgressCookie,
} from "@/lib/onboarding/progress-store";

export const dynamic = "force-dynamic";

export default async function CompletionActivationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const requested = Array.isArray(params.returnTo) ? params.returnTo[0] : params.returnTo;
  const returnTo = resolveExchangeDestination(requested);
  const cookieStore = await cookies();
  const progress = readOnboardingProgressCookie(cookieStore.get(ONBOARDING_PROGRESS_COOKIE)?.value);
  const readiness = buildExchangeReadiness(progress);
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
              Activation re-evaluates the actual completion checkpoints and records that this onboarding session has reached Exchange-ready status. It does not invent a map coordinate, paid membership, verification badge, or authorization state.
            </p>

            <dl className={styles.summary}>
              <div><dt>Organization</dt><dd>{organization.name ?? "Not resolved"}</dd></div>
              <div><dt>Geography</dt><dd>{organization.geography ?? "Not established"}</dd></div>
              <div><dt>Visibility</dt><dd>{organization.visibility ?? "Not selected"}</dd></div>
              <div><dt>Map presence</dt><dd>{organization.mapPresence === "marker_ready" ? "Marker ready" : "Off-map until a real coordinate exists"}</dd></div>
              <div><dt>Participation</dt><dd>{organization.entitlementSummary ?? "Not resolved"}</dd></div>
              <div><dt>Destination</dt><dd>{returnTo}</dd></div>
            </dl>

            {readiness.exchangeAccessAllowed ? (
              <>
                <ul className={styles.checklist}>
                  <li><span>✓</span><div>All blocking readiness checkpoints are complete.</div></li>
                  <li><span>✓</span><div>Progressive AMACS, evidence, certification, and keyword enrichment can continue later.</div></li>
                  <li><span>✓</span><div>The handoff uses the existing authenticated Exchange shell and preserves the requested lens destination.</div></li>
                </ul>
                <CompletionActivationClient readiness={readiness} returnTo={returnTo} />
              </>
            ) : (
              <div className={styles.notice}>
                <strong>Activation is blocked.</strong> {readiness.blockingItemIds.length} required checkpoint{readiness.blockingItemIds.length === 1 ? " is" : "s are"} still incomplete. Return to the readiness review to resolve them.
              </div>
            )}

            <Link className={styles.secondaryLink} href={`/onboarding/completion?returnTo=${encodeURIComponent(returnTo)}`}>← Back to readiness review</Link>
          </section>

          <CompletionNavigation readiness={readiness} activePath="/onboarding/completion/activate" />
        </div>
      </div>
    </main>
  );
}
