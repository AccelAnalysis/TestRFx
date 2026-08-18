import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const root = process.cwd();

async function write(relativePath, content) {
  const target = join(root, relativePath);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content, "utf8");
}

// GitHub Pages cannot execute Stripe, PostgreSQL, signed organization context,
// or webhook reconciliation. These files are a clearly labeled static projection
// of the source-approved membership flow, not a mock production service.
await write(
  "app/founding/page.tsx",
  `import Link from "next/link";
import { MarketingChrome } from "@/components/marketing/marketing-chrome";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import styles from "./founding.module.css";

export default function FoundingMembershipPreview() {
  return (
    <main className={styles.page}>
      <MarketingChrome />
      <div className={styles.content}>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className="eyebrow">Static preview · Pricing / Membership</p>
            <h1>Founding Membership</h1>
            <p className={styles.lede}>The source-approved offer is $49/month for the first 250 organizations. Live price validation, remaining capacity, and checkout require the server runtime.</p>
            <Link className={styles.secondaryAction} href="/onboarding/membership">Preview the registration membership path</Link>
          </div>
          <aside className={styles.priceCard}>
            <p className={styles.planName}>Founding Membership</p>
            <div className={styles.price}><strong>$49</strong><span>/ month</span></div>
            <ul className={styles.facts}><li>Organization-level membership</li><li>First 250 organizations</li><li>Payment occurs after organization setup</li></ul>
            <p className={styles.planDescription}>Static Pages preview: no Stripe session or membership state is created here.</p>
          </aside>
        </section>
      </div>
      <MarketingFooter />
    </main>
  );
}
`,
);

await write(
  "app/onboarding/membership/page.tsx",
  `import Link from "next/link";
import { MembershipWorkflowNav } from "@/components/membership/membership-workflow-nav";
import styles from "./membership.module.css";

export default function MembershipSelectionPreview() {
  return (
    <main className="identity-shell onboarding-shell">
      <section className="identity-card onboarding-card">
        <MembershipWorkflowNav currentStage="membership-selection" />
        <p className="eyebrow">Static preview · 9. Membership Selection</p>
        <h1>Founding Membership</h1>
        <div className={styles.summary}><div className={styles.summaryHeader}><div><h2>Founding Membership</h2></div><div className={styles.price}>$49 <small>/ month</small></div></div></div>
        <p className="muted">The static preview does not fabricate live remaining capacity. Production reads Stripe and the RFxchange membership repository.</p>
        <Link className="button button-primary button-full" href="/onboarding/membership/payment?membership=founding">Continue to Payment preview</Link>
      </section>
    </main>
  );
}
`,
);

await write(
  "app/onboarding/membership/payment/page.tsx",
  `import Link from "next/link";
import { MembershipWorkflowNav } from "@/components/membership/membership-workflow-nav";
import styles from "../membership.module.css";

export default function MembershipPaymentPreview() {
  return (
    <main className="identity-shell onboarding-shell">
      <section className="identity-card onboarding-card">
        <MembershipWorkflowNav currentStage="payment" />
        <p className="eyebrow">Static preview · 10. Payment (Stripe)</p>
        <h1>Secure checkout runs only in the server runtime</h1>
        <div className={styles.integrationNote}><strong>No mock checkout.</strong> GitHub Pages cannot create Stripe Checkout Sessions, reserve membership capacity, or reconcile webhooks.</div>
        <Link className="button button-secondary button-full" href="/onboarding/membership">Back to Membership Selection</Link>
      </section>
    </main>
  );
}
`,
);

await write(
  "app/onboarding/membership/complete/page.tsx",
  `import Link from "next/link";
import { MembershipWorkflowNav } from "@/components/membership/membership-workflow-nav";
import styles from "../membership.module.css";

export default function MembershipCompletePreview() {
  return (
    <main className="identity-shell onboarding-shell">
      <section className="identity-card onboarding-card">
        <MembershipWorkflowNav currentStage="registration-complete" />
        <p className="eyebrow">Static preview · 11. Registration Complete</p>
        <h1>Completion requires verified runtime state</h1>
        <div className={styles.integrationNote}><strong>No fake activation.</strong> The production server verifies Stripe payment and Exchange readiness before granting access.</div>
        <Link className="button button-secondary button-full" href="/onboarding/completion">Preview Exchange-ready completion</Link>
      </section>
    </main>
  );
}
`,
);

console.log("Prepared Pricing / Membership static preview projection.");
