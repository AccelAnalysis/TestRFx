import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const root = process.cwd();

async function write(relativePath, content) {
  const target = join(root, relativePath);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content, "utf8");
}

// The main Pages projection removes runtime APIs because GitHub Pages is a
// static host. Re-project the Login/Register surfaces after that step so Pages
// mirrors the real hierarchy without pretending to execute unavailable APIs.

await write(
  "app/auth/page.tsx",
  `import { Suspense } from "react";
import { AuthEntryNavigator } from "@/components/public/AuthEntryNavigator";
import { findAuthEntryNode } from "@/lib/acquisition/auth-entry-navigation-complete";

export default function AuthEntryPage() {
  const resolved = findAuthEntryNode([]);
  if (!resolved) return null;
  return (
    <Suspense fallback={<main className="identity-shell"><section className="identity-card"><p className="eyebrow">RFxchange access</p><h1>Loading entry workflow…</h1></section></main>}>
      <AuthEntryNavigator resolved={resolved} />
    </Suspense>
  );
}
`,
);

await write(
  "app/login/page.tsx",
  `import Link from "next/link";
import styles from "@/components/identity/login.module.css";

export default function LoginPage() {
  return (
    <main className={styles.shell}>
      <section className={styles.card} aria-labelledby="login-title">
        <div className={styles.brandRow}><span className={styles.brandMark} aria-hidden="true">RF</span><span>RFxchange</span></div>
        <p className={styles.eyebrow}>Identity &amp; onboarding</p>
        <h1 id="login-title" className={styles.title}>Sign in to the Exchange</h1>
        <p className={styles.copy}>This GitHub Pages build is a static preview. The production route requests a real one-time sign-in link from the configured Identity provider; Pages does not simulate delivery or session creation.</p>
        <Link className={styles.primaryButton} href="/auth/sign-in/enter-email">View the sign-in workflow</Link>
        <p className={styles.registerPrompt}>New to RFxchange? <Link href="/register">Create an account</Link></p>
        <div className={styles.metaLinks}><Link href="/">Back to RFxchange</Link><span aria-hidden="true">·</span><span>Runtime authentication is intentionally unavailable on static Pages</span></div>
      </section>
    </main>
  );
}
`,
);

await write(
  "app/login/verify/page.tsx",
  `import Link from "next/link";
import styles from "@/components/identity/login.module.css";

export default function LoginVerifyPage() {
  return (
    <main className={styles.shell}>
      <section className={styles.card}>
        <div className={styles.brandRow}><span className={styles.brandMark} aria-hidden="true">RF</span><span>RFxchange</span></div>
        <p className={styles.eyebrow}>Identity &amp; onboarding</p>
        <h1 className={styles.title}>Complete sign in</h1>
        <p className={styles.copy}>Magic-link token validation, optional MFA, and HttpOnly session establishment require the production Identity provider and are not simulated by the static preview.</p>
        <Link className={styles.primaryButton} href="/auth/sign-in/enter-email/continue/email-found-system/email-found/send-sign-in-link/check-email/click-magic-link">View the magic-link workflow</Link>
        <p className={styles.registerPrompt}><Link href="/login">Return to sign in</Link></p>
      </section>
    </main>
  );
}
`,
);

await write(
  "app/register/page.tsx",
  `import Link from "next/link";

export default function RegisterPage() {
  return (
    <main className="identity-shell">
      <section className="identity-card">
        <p className="eyebrow">RFxchange registration</p>
        <h1>Create your account</h1>
        <p className="muted">This GitHub Pages build is a static preview. Production Registration requires a real Identity provider registration ID before Account Verification; Pages does not manufacture one.</p>
        <Link className="button button-primary button-full" href="/auth/register/create-account">View the registration workflow</Link>
        <p className="identity-footer">Already registered? <Link href="/login">Sign in</Link></p>
      </section>
    </main>
  );
}
`,
);

await write(
  "app/onboarding/membership/page.tsx",
  `import type { Metadata } from "next";
import Link from "next/link";
import { formatUsdCents, foundingMembership } from "@/lib/membership/catalog";
import styles from "./membership.module.css";

export const metadata: Metadata = { title: "Membership Selection | RFxchange" };

export default function MembershipSelectionPage() {
  const plan = foundingMembership;
  const price = formatUsdCents(plan.price.cents);
  return (
    <main className="identity-shell onboarding-shell">
      <section className="identity-card onboarding-card">
        <p className="eyebrow">Membership selection</p>
        <h1>Confirm the organization membership path</h1>
        <p className="muted">The static preview displays the source-defined Founding Membership. Production requires an authenticated organization and creates a real Stripe-hosted subscription Checkout Session server-side.</p>
        <div className={styles.summary}>
          <div className={styles.summaryHeader}>
            <div><p className="eyebrow">Selected plan</p><h2>{plan.name}</h2></div>
            <div className={styles.price}>{price} <small>/ month</small></div>
          </div>
          <div className={styles.details}>
            <div className={styles.detail}><strong>Owner</strong><span>Organization-level membership</span></div>
            <div className={styles.detail}><strong>Capacity</strong><span>First {plan.capacity.limit} organizations</span></div>
            <div className={styles.detail}><strong>Activation</strong><span>After verified Stripe confirmation</span></div>
          </div>
        </div>
        <div className={styles.integrationNote}><strong>Runtime-only payment.</strong> GitHub Pages cannot create server-side Stripe sessions or verify signed webhook events, so this static projection does not pretend to perform checkout.</div>
        <Link className="button button-primary button-full" href="/auth/register/payment">View the Stripe payment workflow</Link>
        <Link className={styles.backLink} href="/founding">Back to Founding Membership</Link>
      </section>
    </main>
  );
}
`,
);

await write(
  "app/onboarding/membership/complete/page.tsx",
  `import Link from "next/link";

export default function MembershipCompletePage() {
  return (
    <main className="identity-shell onboarding-shell">
      <section className="identity-card onboarding-card">
        <p className="eyebrow">Membership payment</p>
        <h1>Stripe confirmation</h1>
        <p className="muted">The production runtime retrieves the Checkout Session from Stripe and waits for signed webhook-driven entitlement. GitHub Pages cannot perform that server-side verification.</p>
        <Link className="button button-primary button-full" href="/auth/register/payment">View the payment workflow</Link>
        <p className="identity-footer"><Link href="/onboarding/membership">Return to membership</Link></p>
      </section>
    </main>
  );
}
`,
);

console.log("Aligned static Pages preview with the real Login/Register hierarchy and runtime service boundaries.");
