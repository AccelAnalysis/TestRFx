import type { Metadata } from "next";
import Link from "next/link";
import { MembershipCheckoutButton } from "@/components/membership/MembershipCheckoutButton";
import { formatUsdCents, foundingMembership } from "@/lib/membership/catalog";
import { normalizeMembershipSelection } from "@/lib/membership/contracts";
import styles from "./membership.module.css";

export const metadata: Metadata = {
  title: "Membership Selection | RFxchange",
};

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function MembershipSelectionPage({ searchParams }: { searchParams: SearchParams }) {
  const query = await searchParams;
  const selection = normalizeMembershipSelection(query.membership) ?? "founding";
  const plan = foundingMembership;
  const price = formatUsdCents(plan.price.cents);
  const checkoutCancelled = query.checkout === "cancelled";

  return (
    <main className="identity-shell onboarding-shell">
      <section className="identity-card onboarding-card">
        <p className="eyebrow">Membership selection</p>
        <h1>Confirm the organization membership path</h1>
        <p className="muted">
          The Public shell selected {selection === "founding" ? "Founding Membership" : "a membership plan"}. Checkout resolves the authenticated active organization before Stripe creates a subscription.
        </p>

        <div className={styles.summary}>
          <div className={styles.summaryHeader}>
            <div>
              <p className="eyebrow">Selected plan</p>
              <h2>{plan.name}</h2>
            </div>
            <div className={styles.price}>{price} <small>/ month</small></div>
          </div>
          <div className={styles.details}>
            <div className={styles.detail}><strong>Owner</strong><span>Organization-level membership</span></div>
            <div className={styles.detail}><strong>Capacity</strong><span>First {plan.capacity.limit} organizations</span></div>
            <div className={styles.detail}><strong>Activation</strong><span>After verified Stripe confirmation</span></div>
          </div>
        </div>

        <div className={styles.integrationNote}>
          <strong>Stripe-hosted subscription checkout.</strong> RFxchange resolves the active organization from the authenticated session, validates the configured Founding Price, enforces the 250-organization subscription cap from Stripe subscription data, and sends payment to Stripe-hosted Checkout. Exchange entitlement is finalized only from signed Stripe webhook events.
        </div>

        {checkoutCancelled ? <p className={styles.checkoutStatus}>Checkout was canceled. No membership change was made.</p> : null}
        <MembershipCheckoutButton />
        <Link className={styles.backLink} href="/founding">Back to Founding Membership</Link>
      </section>
    </main>
  );
}
