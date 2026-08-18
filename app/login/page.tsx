import Link from "next/link";
import { LoginFlow } from "@/components/identity/LoginFlow";
import { parseAuthEntryContext, type AuthEntrySearchParams } from "@/lib/acquisition/auth-entry";
import styles from "@/components/identity/login.module.css";

export default async function LoginPage({ searchParams }: { searchParams: Promise<AuthEntrySearchParams> }) {
  const context = parseAuthEntryContext(await searchParams);
  return (
    <main className={styles.shell}>
      <section className={styles.card} aria-labelledby="login-title">
        <div className={styles.brandRow}><span className={styles.brandMark} aria-hidden="true">RF</span><span>RFxchange</span></div>
        <p className={styles.eyebrow}>Identity &amp; onboarding</p>
        <h1 id="login-title" className={styles.title}>Sign in to the Exchange</h1>
        <p className={styles.copy}>Secure access for registered participants. RFxchange preserves your safe journey context, authenticates with Firebase, resolves organization authority, and routes you to the next valid state.</p>
        <LoginFlow initialContext={context} />
        <div className={styles.metaLinks}><Link href="/">Back to RFxchange</Link><span aria-hidden="true">·</span><Link href="/login/support">Support</Link></div>
      </section>
    </main>
  );
}
