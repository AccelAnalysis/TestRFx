import type { Metadata } from "next";
import Link from "next/link";
import { CheckoutButton } from "@/components/membership/checkout-button";
import { MembershipWorkflowNav } from "@/components/membership/membership-workflow-nav";
import { formatUsdCents } from "@/lib/membership/catalog";
import { membershipSelectionHref, normalizeMembershipSelection } from "@/lib/membership/contracts";
import { getPublicMembershipCatalog } from "@/lib/membership/service";
import styles from "../membership.module.css";

export const metadata: Metadata = { title: "Payment | RFxchange" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function MembershipPaymentPage({ searchParams }: { searchParams: SearchParams }) {
  const query = await searchParams;
  const planCode = normalizeMembershipSelection(query.membership) ?? "founding";
  const cancelled = Array.isArray(query.cancelled) ? query.cancelled[0] === "1" : query.cancelled === "1";

  let plan;
  try {
    const catalog = await getPublicMembershipCatalog();
    plan = catalog.plans.find((item) => item.code === planCode);
  } catch {
    plan = undefined;
  }

  return (
    <main className="identity-shell onboarding-shell">
      <section className="identity-card onboarding-card">
        <MembershipWorkflowNav currentStage="payment" />
        <p className="eyebrow">10. Payment (Stripe)</p>
        <h1>Complete secure payment</h1>
        <p className="muted">Stripe Checkout collects payment details. RFxchange reserves capacity and creates checkout only after a signed organization context is verified against the organization membership repository.</p>

        {cancelled ? (
          <div className={styles.integrationNote}><strong>Checkout was cancelled.</strong> No paid membership was activated. You can retry or return to Membership Selection.</div>
        ) : null}

        {plan ? (
          <div className={styles.summary}>
            <div className={styles.summaryHeader}>
              <div><p className="eyebrow">Selected plan</p><h2>{plan.name}</h2></div>
              <div className={styles.price}>{formatUsdCents(plan.price.cents)} <small>/ month</small></div>
            </div>
            <div className={styles.details}>
              <div className={styles.detail}><strong>Payment details</strong><span>Entered on Stripe's hosted Checkout.</span></div>
              <div className={styles.detail}><strong>Secure checkout</strong><span>Raw payment credentials do not pass through RFxchange.</span></div>
              <div className={styles.detail}><strong>Confirmation</strong><span>Verified Stripe state is reconciled before membership activation.</span></div>
            </div>
          </div>
        ) : (
          <div className={styles.integrationNote}><strong>Live membership data is unavailable.</strong> Checkout cannot begin until Stripe and the membership repository both verify the plan.</div>
        )}

        <CheckoutButton planCode={planCode} disabled={!plan || plan.capacity.state === "full"} />
        <Link className={styles.backLink} href={membershipSelectionHref(planCode)}>Back to Membership Selection</Link>
      </section>
    </main>
  );
}
