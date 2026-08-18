import type { Metadata } from "next";
import Link from "next/link";
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

  return (
    <main className="identity-shell onboarding-shell">
      <section className="identity-card onboarding-card">
        <p className="eyebrow">Membership selection</p>
        <h1>Confirm the organization membership path</h1>
        <p className="muted">
          The Public shell selected {selection === "founding" ? "Founding Membership" : "a membership plan"}. Production checkout must resolve the authenticated active organization before creating a subscription.
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
            <div className={styles.detail}><strong>Activation</strong><span>After verified payment confirmation</span></div>
          </div>
        </div>

        <div className={styles.integrationNote}>
          <strong>Stripe checkout integration point.</strong> The pricing/membership slice intentionally stops here until authenticated organization context, live capacity reservation, billing authorization, and Stripe-backed subscription creation are connected. The UI does not locally unlock Exchange access from an unverified payment state.
        </div>

        <button className={styles.disabledButton} type="button" disabled aria-disabled="true">Continue to secure checkout — integration pending</button>
        <Link className={styles.backLink} href="/founding">Back to Founding Membership</Link>
      </section>
    </main>
  );
}
