import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import styles from "@/components/onboarding/completion-transition.module.css";
import {
  loadAuthoritativeActivation,
  loadAuthoritativeReadiness,
  OnboardingReadinessError,
} from "@/lib/server/onboarding/readiness-service";

export const dynamic = "force-dynamic";

export default async function ExchangeReadySuccessPage() {
  const requestHeaders = await headers();
  const cookieHeader = requestHeaders.get("cookie");

  let readiness;
  let activation;
  try {
    [readiness, activation] = await Promise.all([
      loadAuthoritativeReadiness(cookieHeader),
      loadAuthoritativeActivation(cookieHeader),
    ]);
  } catch (error) {
    if (error instanceof OnboardingReadinessError && error.status === 401) {
      redirect(`/login?returnTo=${encodeURIComponent("/onboarding/completion/success")}`);
    }
    throw error;
  }

  return (
    <main className={styles.shell}>
      <div className={styles.frame}>
        <header className={styles.topbar}>
          <span className={styles.brand}>RFxchange</span>
          <span className={styles.step}>Step 10 of 10 · Exchange Ready</span>
        </header>
        <div className={styles.grid}>
          <section className={styles.card}>
            <div className={styles.successMark} aria-hidden="true">{activation ? "✓" : "!"}</div>
            <h1>{activation ? "Your organization is Exchange ready" : "Activation has not been recorded"}</h1>
            {activation ? (
              <>
                <p>
                  {readiness.organization.name} completed the controlled Exchange-ready handoff. Optional profile and capability enrichment remains available after entry.
                </p>
                <dl className={styles.summary}>
                  <div><dt>Organization</dt><dd>{readiness.organization.name}</dd></div>
                  <div><dt>Geography</dt><dd>{readiness.organization.geography}</dd></div>
                  <div><dt>Presence</dt><dd>{readiness.organization.mapPresence === "marker_ready" ? "Marker ready" : "Exchange record · off-map"}</dd></div>
                  <div><dt>Participation</dt><dd>{readiness.organization.entitlementSummary}</dd></div>
                  <div><dt>Activated</dt><dd>{activation.activatedAt}</dd></div>
                </dl>
                <Link className={styles.primaryLink} href={activation.destination}>Enter RFxchange</Link>
                <div className={styles.lensGrid} aria-label="Exchange destinations">
                  <Link href="/exchange/rfx">Browse RFx</Link>
                  <Link href="/exchange/resources">Browse Resources</Link>
                  <Link href="/exchange/intelligence">Browse Intelligence</Link>
                  <Link href="/exchange/capabilities">Browse Capabilities</Link>
                  <Link href="/exchange">Open Exchange Menu</Link>
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
          <aside className={styles.card}>
            <h2>Readiness remains live</h2>
            <p>Step 10 records the handoff; it does not freeze the organization. Changes to membership, profile, geography, or capabilities continue to come from their canonical services.</p>
            <div className={styles.notice}>Authorization remains independent of onboarding readiness and is enforced again inside the authenticated Exchange.</div>
          </aside>
        </div>
      </div>
    </main>
  );
}
