import Link from "next/link";
import { AcquisitionContextCapture, ConversionLink } from "@/components/marketing/acquisition-context";
import { PublicFooter } from "@/components/public/public-footer";
import { PublicHeader } from "@/components/public/public-header";
import {
  CampaignBreadcrumbs,
  CampaignHierarchy,
  CampaignWorkflowNavigation,
} from "@/components/public/campaign-hierarchy";
import {
  campaignJoinHref,
  campaignSignInHref,
  campaignCanonicalPath,
  type CampaignDefinition,
} from "@/lib/public/campaigns";
import { PUBLIC_DESTINATIONS } from "@/lib/public/destinations";

interface CampaignLandingPageProps {
  campaign: CampaignDefinition;
}

export function CampaignLandingPage({ campaign }: CampaignLandingPageProps) {
  const joinHref = campaignJoinHref(campaign);
  const signInHref = campaignSignInHref(campaign);
  const canonicalPath = campaignCanonicalPath(campaign);
  const sourceDestination = campaign.sourceDestinationId
    ? PUBLIC_DESTINATIONS[campaign.sourceDestinationId]
    : undefined;

  return (
    <main className="campaign-shell">
      <AcquisitionContextCapture />
      <div className="campaign-accent" aria-hidden="true" />
      <PublicHeader joinHref={joinHref} signInHref={signInHref} />

      <div className="campaign-page-width">
        <CampaignBreadcrumbs family={campaign.family} campaign={campaign} />
        <div className="campaign-hierarchy-layout">
          <CampaignHierarchy activeFamily={campaign.family} activeCampaign={campaign.slug} />

          <div className="campaign-content-column">
            <header className="campaign-hero" id="overview">
              <div className="campaign-hero-copy">
                <p className="eyebrow">{campaign.eyebrow}</p>
                <h1>{campaign.headline}</h1>
                <p className="campaign-lede">{campaign.summary}</p>
                <div className="hero-actions">
                  <ConversionLink className="button button-primary" href={joinHref}>
                    {campaign.primaryCta}
                  </ConversionLink>
                  {sourceDestination ? (
                    <Link className="button button-secondary" href={sourceDestination.href}>
                      {campaign.secondaryCta}
                    </Link>
                  ) : (
                    <Link className="button button-secondary" href={`${canonicalPath}#how-it-works`}>
                      {campaign.secondaryCta}
                    </Link>
                  )}
                </div>
              </div>
              <aside className="campaign-context-card" aria-label="Campaign context">
                <span>{campaign.family.replaceAll("-", " ")}</span>
                <strong>{campaign.audience}</strong>
                {campaign.geography ? <p>{campaign.geography}</p> : null}
                {campaign.membership ? <p>Membership path: {campaign.membership}</p> : null}
                <small>After readiness: /exchange/{campaign.intendedLens}</small>
              </aside>
            </header>

            <CampaignWorkflowNavigation campaign={campaign} />

            <section className="campaign-section campaign-problem">
              <p className="eyebrow">Why this campaign exists</p>
              <div className="campaign-section-grid">
                <h2>{campaign.problemTitle}</h2>
                <p>{campaign.problemCopy}</p>
              </div>
            </section>

            <section className="campaign-proof-grid" aria-label="Campaign proof points">
              {campaign.proofPoints.map((point) => (
                <article key={point}>
                  <span>✓</span>
                  <p>{point}</p>
                </article>
              ))}
            </section>

            <section className="campaign-section" id="how-it-works">
              <p className="eyebrow">How it works</p>
              <div className="campaign-section-heading">
                <h2>One acquisition path. One RFxchange identity. One Exchange.</h2>
                <p>
                  Campaign presentation can be specific. Identity, organization truth, onboarding,
                  and the authenticated operating chassis remain canonical.
                </p>
              </div>
              <div className="campaign-steps">
                {campaign.steps.map((step, index) => (
                  <article key={step.title}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <h3>{step.title}</h3>
                    <p>{step.description}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="campaign-section campaign-real-handoff">
              <div>
                <p className="eyebrow">Operating chassis handoff</p>
                <h2>The landing page hands off to services that already own the work.</h2>
                <p>
                  Join and Sign In go through the canonical Public identity gateways. Registration,
                  verification, organization resolution, geography, profile, capability enrichment,
                  membership where applicable, and Exchange-ready completion remain in their owning
                  modules. The campaign only carries bounded acquisition context and a protected
                  Exchange destination.
                </p>
              </div>
              <ol>
                <li><strong>Public acquisition</strong><span>{canonicalPath}</span></li>
                <li><strong>Identity entry</strong><span>/join or /signin</span></li>
                <li><strong>Identity &amp; Onboarding</strong><span>canonical readiness workflow</span></li>
                <li><strong>Authenticated Exchange</strong><span>/exchange/{campaign.intendedLens}</span></li>
              </ol>
            </section>

            <section className="campaign-section">
              <p className="eyebrow">What participants gain</p>
              <div className="campaign-benefits">
                {campaign.benefits.map((benefit) => (
                  <article key={benefit}><h3>{benefit}</h3></article>
                ))}
              </div>
            </section>

            <section className="campaign-section campaign-faq">
              <p className="eyebrow">Questions</p>
              <h2>Campaign context informs the journey; it does not become system truth.</h2>
              <div>
                {campaign.faqs.map((faq) => (
                  <details key={faq.question}>
                    <summary>{faq.question}</summary>
                    <p>{faq.answer}</p>
                  </details>
                ))}
              </div>
            </section>

            <section className="campaign-final-cta">
              <p className="eyebrow">Enter RFxchange</p>
              <h2>{campaign.headline}</h2>
              <p>{campaign.summary}</p>
              <div className="hero-actions">
                <ConversionLink className="button button-primary" href={joinHref}>
                  {campaign.primaryCta}
                </ConversionLink>
                <ConversionLink className="button button-secondary" href={signInHref}>
                  Sign In
                </ConversionLink>
              </div>
            </section>
          </div>
        </div>
      </div>

      <PublicFooter joinHref={joinHref} signInHref={signInHref} />
    </main>
  );
}
