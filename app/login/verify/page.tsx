import Link from "next/link";
import { Suspense } from "react";
import { LoginVerificationFlow } from "@/components/identity/LoginVerificationFlow";
import styles from "@/components/identity/login.module.css";

export default function LoginVerifyPage() {
  return (
    <main className={styles.shell}>
      <section className={styles.card} aria-labelledby="verify-title">
        <div className={styles.brandRow}>
          <span className={styles.brandMark} aria-hidden="true">RF</span>
          <span>RFxchange</span>
        </div>
        <p className={styles.eyebrow}>Identity &amp; onboarding</p>
        <h1 id="verify-title" className={styles.title}>Complete sign in</h1>
        <p className={styles.copy}>
          RFxchange validates the one-time link with the configured Identity provider, requests additional verification when required, then establishes the session before readiness routing.
        </p>
        <Suspense
          fallback={
            <section className={styles.statusPanel}>
              <div className={styles.statusIcon} aria-hidden="true">↻</div>
              <h2>Preparing verification</h2>
            </section>
          }
        >
          <LoginVerificationFlow />
        </Suspense>
        <div className={styles.metaLinks}>
          <Link href="/auth/sign-in/enter-email/email-found/send-sign-in-link/click-magic-link">View magic-link workflow</Link>
          <span aria-hidden="true">·</span>
          <Link href="/">RFxchange</Link>
        </div>
      </section>
    </main>
  );
}
