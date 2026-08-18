import Link from "next/link";
import {
  AuthEntrySearchParams,
  buildIdentityHref,
  describeAuthEntryContext,
  hasAuthEntryContext,
  parseAuthEntryContext,
} from "@/lib/acquisition/auth-entry";
import styles from "./auth-entry.module.css";

export default async function AuthEntryPage({
  searchParams,
}: {
  searchParams: Promise<AuthEntrySearchParams>;
}) {
  const context = parseAuthEntryContext(await searchParams);
  const details = describeAuthEntryContext(context);

  return (
    <main className="identity-shell">
      <section className="identity-card">
        <p className="eyebrow">RFxchange access</p>
        <h1>Enter the Exchange</h1>
        <p className="muted">
          Choose how to continue. RFxchange will carry safe campaign, referral, invitation,
          membership, geography, and requested-destination context into the identity flow.
        </p>

        {hasAuthEntryContext(context) && (
          <div className={styles.context} aria-label="Preserved journey context">
            <strong>Journey preserved</strong>
            <dl>
              {details.map((detail) => (
                <div key={`${detail.label}-${detail.value}`}>
                  <dt>{detail.label}</dt>
                  <dd>{detail.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        <div className={styles.actions}>
          <Link className="button button-primary button-full" href={buildIdentityHref("register", context)}>
            Join Free
          </Link>
          <Link className="button button-secondary button-full" href={buildIdentityHref("signin", context)}>
            Sign In
          </Link>
        </div>

        <p className="identity-footer">
          <Link href="/">Return to RFxchange</Link>
        </p>
      </section>
    </main>
  );
}
