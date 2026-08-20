import type { Metadata } from "next";
import Link from "next/link";
import { MembershipWorkflowNav } from "@/components/membership/membership-workflow-nav";
import { formatUsdCents } from "@/lib/membership/catalog";
import { membershipPaymentHref, normalizeMembershipSelection } from "@/lib/membership/contracts";
import { getPublicMembershipCatalog } from "@/lib/membership/service";
import styles from "./membership.module.css";

export const metadata: Metadata = { title: "Membership Selection | RFxchange" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function MembershipSelectionPage({ searchParams }: { searchParams: SearchParams }) {
  const query = await searchParams;
  const selection = normalizeMembershipSelection(query.membership) ?? "founding";

  let catalog;
  try {
    catalog = await getPublicMembershipCatalog();
  } catch {
    return (
      <main className="identity-shell onboarding-shell">
        <section className="identity-card onboarding-card">
          <MembershipWorkflowNav currentStage="membership-selection" />
          <p className="eyebrow">9. Membership Selection</p>
          <h1>Membership service unavailable</h1>
          <p className="muted">RFxchange could not verify the live Stripe plan and organization-capacity service. No plan or checkout state has been fabricated.</p>
          <Link className="button button-secondary button-full" href="/founding">Return to Founding Membership</Link>
        </section>
      </main>
    );
  }

  const plan = catalog.plans.find((item) => item.code === selection);
  if (!plan) {
    return (
      <main className="identity-shell onboarding-shell">
        <section className="identity-card onboarding-card">
          <MembershipWorkflowNav currentStage="membership-selection" />
          <h1>Membership plan unavailable</h1>
          <p className="muted">The selected plan is not present in the live membership catalog.</p>
          <Link className="button button-secondary button-full" href="/founding">Review membership</Link>
        </section>
      </main>
    );
  }

  const price = formatUsdCents(plan.price.cents);
  const capacityText = plan.capacity.state === "full"
    ? "Founding capacity reached"
    : `${plan.capacity.remaining} of ${plan.capacity.limit} founding positions currently unconsumed/unreserved`;

  return (
    <main className="identity-shell onboarding-shell">
      <section className="identity-card onboarding-card">
        <MembershipWorkflowNav currentStage="membership-selection" />
        <p className="eyebrow">9. Membership Selection</p>
        <h1>Choose the organization membership plan</h1>
        <p className="muted">The source defines Founding Membership and future plans as they become available. RFxchange only renders plans that actually exist in the live catalog.</p>

        <div className={styles.summary}>
          <div className={styles.summaryHeader}>
            <div><p className="eyebrow">Available plan</p><h2>{plan.name}</h2></div>
            <div className={styles.price}>{price} <small>/ month</small></div>
          </div>
          <div className={styles.details}>
            <div className={styles.detail}><strong>Owner</strong><span>Organization-level membership</span></div>
            <div className={styles.detail}><strong>Capacity</strong><span>{capacityText}</span></div>
            <div className={styles.detail}><strong>Source</strong><span>Stripe price + RFxchange membership repository</span></div>
          </div>
        </div>

        {plan.capacity.state === "full" ? (
          <div className={styles.integrationNote}><strong>Founding Membership is full.</strong> No checkout can be reserved for a new founding organization.</div>
        ) : (
          <Link className="button button-primary button-full" href={membershipPaymentHref(plan.code)}>Continue to Payment</Link>
        )}
        <Link className={styles.backLink} href="/founding">Back to Founding Membership</Link>
      </section>
    </main>
  );
}
