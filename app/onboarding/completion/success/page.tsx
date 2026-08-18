import Link from "next/link";
import { cookies } from "next/headers";
import { CompletionNavigation } from "@/components/onboarding/completion-navigation";
import styles from "@/components/onboarding/completion-transition.module.css";
import { buildExchangeReadiness, resolveExchangeDestination } from "@/lib/onboarding/readiness";
import {
  ONBOARDING_PROGRESS_COOKIE,
  readOnboardingProgressCookie,
} from "@/lib/onboarding/progress-store";

export const dynamic = "force-dynamic";

export default async function ExchangeReadySuccessPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const requested = Array.isArray(params.returnTo) ? params.returnTo[0] : params.returnTo;
  const cookieStore = await cookies();
  const progress = readOnboardingProgressCookie(cookieStore.get(ONBOARDING_PROGRESS_COOKIE)?.value);
  const readiness = buildExchangeReadiness(progress);
  const destination = resolveExchangeDestination(progress.activation?.destination ?? requested);
  const activated = progress.activation?.status === "exchange_active";

  return (
    <main className={styles.shell}>
      <div className={styles.frame}>
        <header className={styles.topbar}>
          <span className={styles.brand}>RFxchange</span>
          <span className={styles.step}>Step 10 of 10 · Exchange Ready</span>
        </header>

        <div className={styles.grid}>
          <section className={styles.card}>
            <div className={styles.successMark} aria-hidden="true">{activated ? "✓" : "!"}</div>
            <h1>{activated ? "Your organization is Exchange ready" : "Activation has not been recorded"}</h1>
            {activated ? (
              <>
                <p>
                  {readiness.organization.name ?? "Your organization"} completed the Exchange-ready handoff. Continue into the existing map-first Exchange; optional profile and capability enrichment remains available afterward.
                </p>
                <dl className={styles.summary}>
                  <div><dt>Organization</dt><dd>{readiness.organization.name ?? "Organization"}</dd></div>
                  <div><dt>Geography</dt><dd>{readiness.organization.geography ?? "Off-map"}</dd></div>
                  <div><dt>Presence</dt><dd>{readiness.organization.mapPresence === "marker_ready" ? "Marker ready" : "Exchange record · off-map"}</dd></div>
                  <div><dt>Participation</dt><dd>{readiness.organization.entitlementSummary ?? "Resolved"}</dd></div>
                </dl>
                <Link className={styles.primaryLink} href={destination}>Enter RFxchange</Link>
                <div className={styles.lensGrid} aria-label="Exchange destinations">
                  <Link href="/exchange/rfx">Browse RFx</Link>
                  <Link href="/exchange/resources">Browse Resources</Link>
                  <Link href="/exchange/intelligence">Browse Intelligence</Link>
                  <Link href="/exchange/capabilities">Browse Capabilities</Link>
                  <Link href="/exchange">Open Menu / organization profile</Link>
                  <Link href="/onboarding/capabilities?stage=amacs">Continue capability enrichment</Link>
                </div>
              </>
            ) : (
              <>
                <p>The success route cannot grant Exchange-ready status by itself. Complete the activation workflow first.</p>
                <Link className={styles.primaryLink} href="/onboarding/completion">Return to readiness review</Link>
              </>
            )}
          </section>

          <CompletionNavigation readiness={readiness} activePath="/onboarding/completion/success" />
        </div>
      </div>
    </main>
  );
}
