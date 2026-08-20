import Link from "next/link";
import { LoginFlow } from "@/components/identity/LoginFlow";
import {
  type AuthEntrySearchParams,
  buildIdentityHref,
  hasAuthEntryContext,
  parseAuthEntryContext,
} from "@/lib/acquisition/auth-entry";
import { sanitizeReturnTo } from "@/lib/identity/login";
import styles from "@/components/identity/login.module.css";

interface LoginPageProps {
  searchParams: Promise<AuthEntrySearchParams>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const context = parseAuthEntryContext(await searchParams);
  const returnTo = sanitizeReturnTo(context.returnTo);
  const registrationHref = buildIdentityHref("register", context);

  return (
    <main className={styles.shell}>
      <section className={styles.card} aria-labelledby="login-title">
        <div className={styles.brandRow}>
          <span className={styles.brandMark} aria-hidden="true">RF</span>
          <span>RFxchange</span>
        </div>
        <p className={styles.eyebrow}>Identity &amp; onboarding</p>
        <h1 id="login-title" className={styles.title}>Sign in to the Exchange</h1>
        <p className={styles.copy}>
          Secure access for registered participants. Your intended Exchange destination is preserved through authentication and readiness checks.
          {hasAuthEntryContext(context) ? " Acquisition, campaign, referral, invitation, organization, membership, geography, and record context also remains attached if you move into Registration." : ""}
        </p>
        <LoginFlow initialReturnTo={returnTo} registrationHref={registrationHref} />
        <div className={styles.metaLinks}>
          <Link href="/">Back to RFxchange</Link>
          <span aria-hidden="true">·</span>
          <Link href="/auth/sign-in">View sign-in workflow</Link>
          <span aria-hidden="true">·</span>
          <span>One identity across every Exchange lens</span>
        </div>
      </section>
    </main>
  );
}
