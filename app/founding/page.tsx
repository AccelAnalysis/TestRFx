import type { Metadata } from "next";
import Link from "next/link";
import { ConversionLink } from "@/components/marketing/acquisition-context";
import { MarketingChrome } from "@/components/marketing/marketing-chrome";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { creditPolicy, formatUsdCents, foundingMembership } from "@/lib/membership/catalog";
import { publicJoinHrefForPlan } from "@/lib/membership/contracts";
import styles from "./founding.module.css";

export const metadata: Metadata = {
  title: "Founding Membership | RFxchange",
  description: "Review RFxchange Founding Membership and begin organization onboarding.",
};

const foundingJoinHref = publicJoinHrefForPlan("founding");

const membershipFacts = [
  ["Organization-level", "Membership belongs to the participating organization, while people access RFxchange through their organization roles."],
  ["Founding designation", "The founding offer is reserved for the first 250 participating organizations."],
  ["Onboarding before payment", "RFxchange establishes the person, geography, organization, and map location before paid membership is activated."],
  ["Shared lifecycle", "Billing, credits, invoices, and future plan changes plug into one membership service and the authenticated Menu."],
] as const;

const process = [
  ["Choose Founding Membership", "The public gateway carries the membership selection into Identity as acquisition context."],
  ["Create and verify your account", "Identity is established before RFxchange creates a paid organization relationship."],
  ["Set geography and organization", "Claim or create the organization, complete core details, and establish its map location."],
  ["Confirm membership", "RFxchange resolves the active organization and validates the Founding Membership path."],
  ["Complete secure payment", "Stripe is the checkout integration point; activation occurs only after verified payment confirmation."],
] as const;

const faqs = [
  ["Is Founding Membership for a person or an organization?", "It is organization-level. Individual users belong to organizations through their own roles and permissions."],
  ["When does payment happen?", "The registration flow places membership selection and payment after account verification, geography, organization setup, and map placement."],
  ["What does the 250 limit mean?", "Founding Membership is capped at 250 organizations. The production capacity service will be the source of truth for live availability."],
  ["How do RFxchange credits work?", `Credits are tracked in an organization ledger. One credit equals $${creditPolicy.usdValuePerCredit}, and issued credits expire after ${creditPolicy.expirationMonths} months.`],
] as const;

export default function FoundingMembershipPage() {
  const price = formatUsdCents(foundingMembership.price.cents);

  return (
    <main className={styles.page}>
      <MarketingChrome />

      <div className={styles.content}>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className="eyebrow">RFxchange Founding Membership</p>
            <h1>Establish your organization in the Exchange from the beginning.</h1>
            <p className={styles.lede}>
              Start with an RFxchange account, establish your organization and geography, then activate the paid Founding Membership for that organization.
            </p>
          </div>

          <aside className={styles.priceCard} aria-label="Founding Membership offer">
            <p className={styles.planName}>{foundingMembership.name}</p>
            <div className={styles.price}><strong>{price}</strong><span>/ month</span></div>
            <p className={styles.planDescription}>{foundingMembership.description}</p>
            <ul className={styles.facts}>
              <li>Membership is attached to the organization.</li>
              <li>Founding capacity is limited to {foundingMembership.capacity.limit} organizations.</li>
              <li>Payment occurs after organization setup.</li>
              <li>Billing and membership management continue inside the authenticated Menu.</li>
            </ul>
            <ConversionLink className={styles.primaryAction} href={foundingJoinHref}>Become a Founding Member</ConversionLink>
            <ConversionLink className={styles.textAction} href="/join">Join free without selecting paid membership</ConversionLink>
          </aside>
        </section>

        <section className={styles.section} aria-labelledby="membership-establishes">
          <div className={styles.sectionHeader}>
            <p className="eyebrow">Membership architecture</p>
            <h2 id="membership-establishes">One commercial relationship, connected to the whole platform.</h2>
            <p>Pricing is public, but paid membership only becomes platform truth after RFxchange knows which verified person is acting for which organization.</p>
          </div>
          <div className={styles.gridFour}>
            {membershipFacts.map(([title, copy]) => (
              <article className={styles.card} key={title}><strong>{title}</strong><p>{copy}</p></article>
            ))}
          </div>
        </section>

        <section className={styles.section} aria-labelledby="choose-path">
          <div className={styles.sectionHeader}>
            <p className="eyebrow">Choose your path</p>
            <h2 id="choose-path">Joining RFxchange and buying membership are separate decisions.</h2>
            <p>The Join Free path begins identity and organization setup. Selecting Founding Membership adds the paid-membership intent to that same governed entry path.</p>
          </div>
          <div className={styles.paths}>
            <article className={styles.pathCard}>
              <p className="eyebrow">Account path</p>
              <h3>Join free</h3>
              <p>Create an RFxchange identity and begin establishing your organization without pre-selecting the paid plan.</p>
              <ConversionLink className={styles.secondaryAction} href="/join">Create account</ConversionLink>
            </article>
            <article className={`${styles.pathCard} ${styles.pathFeatured}`}>
              <p className="eyebrow">Membership path</p>
              <h3>{foundingMembership.name}</h3>
              <p>Carry the {price}/month membership selection into Identity, organization setup, membership confirmation, and payment.</p>
              <ConversionLink className={styles.primaryAction} href={foundingJoinHref}>Select Founding Membership</ConversionLink>
            </article>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="credits">
          <div className={styles.sectionHeader}>
            <p className="eyebrow">Credits</p>
            <h2 id="credits">A ledger, not an unexplained balance.</h2>
            <p>The membership domain reserves a shared organization credit ledger so issuance, use, adjustments, reversals, and expiration can be auditable.</p>
          </div>
          <div className={styles.creditLayout}>
            <article className={styles.creditCard}>
              <p className="eyebrow">Credit value</p>
              <div className={styles.creditMetric}><strong>1 credit</strong><span>= $1</span></div>
              <p className="muted">Credits are represented as organization-level ledger entries rather than a mutable number on a user record.</p>
            </article>
            <article className={styles.creditCard}>
              <p className="eyebrow">Expiration policy</p>
              <div className={styles.creditMetric}><strong>{creditPolicy.expirationMonths}</strong><span>months</span></div>
              <p className="muted">Issued credits expire twelve months after issuance, with the ledger retaining the transaction history.</p>
            </article>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="how-membership-works">
          <div className={styles.sectionHeader}>
            <p className="eyebrow">Conversion handoff</p>
            <h2 id="how-membership-works">From public offer to organization membership.</h2>
            <p>The Public shell explains and captures intent. Identity and Onboarding establish the organization. The membership service and Stripe integration activate the commercial relationship.</p>
          </div>
          <div className={styles.steps}>
            {process.map(([title, copy]) => (
              <article className={styles.stepCard} key={title}><strong>{title}</strong><p>{copy}</p></article>
            ))}
          </div>
        </section>

        <section className={styles.section} aria-labelledby="faq">
          <div className={styles.sectionHeader}>
            <p className="eyebrow">Frequently asked questions</p>
            <h2 id="faq">Membership boundaries made explicit.</h2>
          </div>
          <div className={styles.faqGrid}>
            {faqs.map(([question, answer]) => (
              <article className={styles.faqCard} key={question}><strong>{question}</strong><p>{answer}</p></article>
            ))}
          </div>
        </section>

        <section className={styles.integrationBand}>
          <div>
            <h2>Start the Founding Membership path.</h2>
            <p>The public gateway carries `membership=founding` and the membership-selection return destination into Identity so sibling auth/onboarding modules can preserve the same commercial intent.</p>
          </div>
          <div className={styles.integrationActions}>
            <ConversionLink className={styles.primaryAction} href={foundingJoinHref}>Become a Founding Member</ConversionLink>
            <ConversionLink className={styles.secondaryAction} href="/signin?membership=founding">Sign in</ConversionLink>
          </div>
        </section>
      </div>

      <MarketingFooter />
    </main>
  );
}
