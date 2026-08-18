import Link from "next/link";
import { LoginFlow } from "@/components/identity/LoginFlow";
import { sanitizeReturnTo } from "@/lib/identity/login";
import styles from "@/components/identity/login.module.css";

interface LoginPageProps {
  searchParams: Promise<{ returnTo?: string | string[] }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const rawReturnTo = Array.isArray(params.returnTo) ? params.returnTo[0] : params.returnTo;
  const returnTo = sanitizeReturnTo(rawReturnTo);

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
        </p>
        <LoginFlow initialReturnTo={returnTo} />
        <div className={styles.metaLinks}>
          <Link href="/">Back to RFxchange</Link>
          <span aria-hidden="true">·</span>
          <span>One identity across every Exchange lens</span>
        </div>
      </section>
    </main>
  );
}
