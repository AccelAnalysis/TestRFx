import type { Metadata } from "next";
import Link from "next/link";
import { ConversionLink } from "@/components/marketing/acquisition-context";
import { MarketingChrome } from "@/components/marketing/marketing-chrome";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { creditPolicy, formatUsdCents } from "@/lib/membership/catalog";
import { publicJoinHrefForPlan, type MembershipPlan } from "@/lib/membership/contracts";
import { foundingPublicSections } from "@/lib/membership/navigation";
import { getPublicMembershipCatalog } from "@/lib/membership/service";
import styles from "./founding.module.css";

export const metadata: Metadata = {
  title: "Founding Membership | RFxchange",
  description: "Review RFxchange Founding Membership and begin organization onboarding.",
};
export const dynamic = "force-dynamic";

const foundingJoinHref = publicJoinHrefForPlan("founding");

const process = [
  ["Choose Founding Membership", "The public gateway carries the membership selection into Identity as acquisition context."],
  ["Create and verify your account", "Identity is established before RFxchange creates a paid organization relationship."],
  ["Set geography and organization", "Claim or create the organization, complete core details, and establish its map location."],
  ["Confirm membership", "RFxchange resolves the active organization and validates live Founding Membership availability."],
  ["Complete secure payment", "Stripe Checkout collects payment; RFxchange activates only after verified Stripe state is reconciled."],
] as const;

const faqs = [
  ["Is Founding Membership for a person or an organization?", "It is organization-level. Individual users belong to organizations through their own roles and permissions."],
  ["When does payment happen?", "The registration flow places Membership Selection and Payment after organization details and Location / Map Placement."],
  ["What does the 250 limit mean?", "The live capacity service counts organizations that have activated Founding Membership plus unexpired checkout reservations. It does not rely on a marketing-page counter."],
  ["How do RFxchange credits work?", `Credits are tracked in an organization ledger. One credit equals $${creditPolicy.usdValuePerCredit}, and issued credits expire after ${creditPolicy.expirationMonths} months.`],
] as const;

function AvailabilityFacts({ plan }: { plan: MembershipPlan | null }) {
  if (!plan) {
    return (
      <article className={styles.card}>
        <strong>Live availability unavailable</strong>
        <p>RFxchange could not verify Stripe pricing and the membership repository, so paid checkout is not offered from this runtime.</p>
      </article>
    );
  }
  return (
    <>
      <article className={styles.card}><strong>Organization-level</strong><p>Membership belongs to the participating organization, while people access RFxchange through organization roles.</p></article>
      <article className={styles.card}><strong>Founding designation</strong><p>The offer is limited to the first {plan.capacity.limit} participating organizations.</p></article>
      <article className={styles.card}><strong>Live capacity</strong><p>{plan.capacity.remaining} positions are currently unconsumed and unreserved; {plan.capacity.reserved} are temporarily reserved for checkout.</p></article>
      <article className={styles.card}><strong>Activation</strong><p>RFxchange reconciles verified Stripe state before changing organization membership truth.</p></article>
    </>
  );
}

export default async function FoundingMembershipPage() {
  let plan: MembershipPlan | null = null;
  try {
    const catalog = await getPublicMembershipCatalog();
    plan = catalog.plans.find((item) => item.code === "founding") ?? null;
  } catch {
    plan = null;
  }

  const price = plan ? formatUsdCents(plan.price.cents) : null;
  const canPurchase = Boolean(plan && plan.capacity.state === "open");

  return (
    <main className={styles.page}>
      <MarketingChrome />

      <div className={styles.content}>
        <nav className={styles.paths} aria-label="Pricing and membership sections">
          {foundingPublicSections.map((item) => (
            <Link className={styles.pathCard} href={item.href ?? "/founding"} key={item.id}>
              <strong>{item.label}</strong>
              <p>{item.description}</p>
            </Link>
          ))}
        </nav>

        <section className={styles.hero} id="membership-offer">
          <div className={styles.heroCopy}>
            <p className="eyebrow">RFxchange Founding Membership</p>
            <h1>Establish your organization in the Exchange from the beginning.</h1>
            <p className={styles.lede}>Start with an RFxchange account, establish your organization and geography, then activate paid Founding Membership for that organization.</p>
          </div>

          <aside className={styles.priceCard} aria-label="Founding Membership offer">
            <p className={styles.planName}>{plan?.name ?? "Founding Membership"}</p>
            {price ? <div className={styles.price}><strong>{price}</strong><span>/ month</span></div> : null}
            <p className={styles.planDescription}>{plan?.description ?? "Live price and availability require the configured Stripe and RFxchange membership services."}</p>
            {plan ? (
              <ul className={styles.facts}>
                <li>Membership is attached to the organization.</li>
                <li>Founding capacity is limited to {plan.capacity.limit} organizations.</li>
                <li>{plan.capacity.remaining} positions are currently unconsumed and unreserved.</li>
                <li>Payment occurs after organization setup.</li>
              </ul>
            ) : null}
            {canPurchase ? (
              <ConversionLink className={styles.primaryAction} href={foundingJoinHref}>Become a Founding Member</ConversionLink>
            ) : (
              <p className={styles.planDescription}>Paid membership selection is unavailable until the live service reports an open position.</p>
            )}
            <ConversionLink className={styles.textAction} href="/join">Join free without selecting paid membership</ConversionLink>
          </aside>
        </section>

        <section className={styles.section} id="availability" aria-labelledby="membership-availability">
          <div className={styles.sectionHeader}>
            <p className="eyebrow">Availability</p>
            <h2 id="membership-availability">One organization membership, backed by live capacity.</h2>
            <p>Pricing is public, but paid membership becomes RFxchange truth only after the verified person, organization, checkout reservation, and Stripe state agree.</p>
          </div>
          <div className={styles.gridFour}><AvailabilityFacts plan={plan} /></div>
        </section>

        <section className={styles.section} aria-labelledby="choose-path">
          <div className={styles.sectionHeader}>
            <p className="eyebrow">Choose your path</p>
            <h2 id="choose-path">Joining RFxchange and buying membership are separate decisions.</h2>
            <p>Join Free begins identity and organization setup. Founding Membership carries paid-plan intent into the same governed onboarding path.</p>
          </div>
          <div className={styles.paths}>
            <article className={styles.pathCard}>
              <p className="eyebrow">Account path</p><h3>Join free</h3>
              <p>Create an RFxchange identity and begin organization setup without pre-selecting paid membership.</p>
              <ConversionLink className={styles.secondaryAction} href="/join">Create account</ConversionLink>
            </article>
            <article className={`${styles.pathCard} ${styles.pathFeatured}`}>
              <p className="eyebrow">Membership path</p><h3>{plan?.name ?? "Founding Membership"}</h3>
              <p>{price ? `Carry the ${price}/month selection into Identity, organization setup, Membership Selection, and Stripe Payment.` : "The paid path opens only when the live membership service verifies price and capacity."}</p>
              {canPurchase ? <ConversionLink className={styles.primaryAction} href={foundingJoinHref}>Select Founding Membership</ConversionLink> : null}
            </article>
          </div>
        </section>

        <section className={styles.section} id="credits" aria-labelledby="credits-heading">
          <div className={styles.sectionHeader}>
            <p className="eyebrow">Credits</p>
            <h2 id="credits-heading">A ledger, not an unexplained balance.</h2>
            <p>The organization credit ledger records issuance, use, adjustment, reversal, and expiration as auditable entries.</p>
          </div>
          <div className={styles.creditLayout}>
            <article className={styles.creditCard}><p className="eyebrow">Credit value</p><div className={styles.creditMetric}><strong>1 credit</strong><span>= $1</span></div><p className="muted">Credits belong to the organization ledger.</p></article>
            <article className={styles.creditCard}><p className="eyebrow">Expiration policy</p><div className={styles.creditMetric}><strong>{creditPolicy.expirationMonths}</strong><span>months</span></div><p className="muted">Issued credits expire twelve months after issuance while ledger history remains auditable.</p></article>
          </div>
        </section>

        <section className={styles.section} id="how-membership-works" aria-labelledby="how-membership-works-heading">
          <div className={styles.sectionHeader}>
            <p className="eyebrow">How membership works</p>
            <h2 id="how-membership-works-heading">From public offer to organization membership.</h2>
            <p>The Public shell explains and captures intent. Identity and Onboarding establish the organization. Stripe Checkout and the membership service establish the paid relationship.</p>
          </div>
          <div className={styles.steps}>{process.map(([title, copy]) => <article className={styles.stepCard} key={title}><strong>{title}</strong><p>{copy}</p></article>)}</div>
        </section>

        <section className={styles.section} id="faq" aria-labelledby="faq-heading">
          <div className={styles.sectionHeader}><p className="eyebrow">Frequently asked questions</p><h2 id="faq-heading">Membership boundaries made explicit.</h2></div>
          <div className={styles.faqGrid}>{faqs.map(([question, answer]) => <article className={styles.faqCard} key={question}><strong>{question}</strong><p>{answer}</p></article>)}</div>
        </section>

        <section className={styles.integrationBand}>
          <div><h2>Start the Founding Membership path.</h2><p>The public gateway carries membership intent into Identity; secure checkout is created only after organization context is established and verified.</p></div>
          <div className={styles.integrationActions}>
            {canPurchase ? <ConversionLink className={styles.primaryAction} href={foundingJoinHref}>Become a Founding Member</ConversionLink> : null}
            <ConversionLink className={styles.secondaryAction} href="/signin?membership=founding">Sign in</ConversionLink>
          </div>
        </section>
      </div>

      <MarketingFooter />
    </main>
  );
}
