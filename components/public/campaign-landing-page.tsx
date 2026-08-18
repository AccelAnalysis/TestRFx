import Link from "next/link";
import type { CampaignDefinition } from "@/lib/public/campaigns";

interface CampaignLandingPageProps {
  campaign: CampaignDefinition;
  registrationHref: string;
}

export function CampaignLandingPage({ campaign, registrationHref }: CampaignLandingPageProps) {
  return (
    <main className="campaign-shell">
      <div className="campaign-accent" aria-hidden="true" />
      <nav className="campaign-nav" aria-label="Campaign navigation">
        <Link className="campaign-brand" href="/">RFxchange</Link>
        <div className="campaign-nav-actions">
          <Link href="/login">Sign in</Link>
          <Link className="button button-primary" href={registrationHref}>Join free</Link>
        </div>
      </nav>

      <header className="campaign-hero">
        <div className="campaign-hero-copy">
          <p className="eyebrow">{campaign.eyebrow}</p>
          <h1>{campaign.headline}</h1>
          <p className="campaign-lede">{campaign.summary}</p>
          <div className="hero-actions">
            <Link className="button button-primary" href={registrationHref}>{campaign.primaryCta}</Link>
            <Link className="button button-secondary" href="#how-it-works">{campaign.secondaryCta}</Link>
          </div>
        </div>
        <aside className="campaign-context-card" aria-label="Campaign context">
          <span>{campaign.family.replaceAll("-", " ")}</span>
          <strong>{campaign.audience}</strong>
          {campaign.geography ? <p>{campaign.geography}</p> : null}
          {campaign.partner ? <p>Partner: {campaign.partner}</p> : null}
          {campaign.offer ? <p>Offer: {campaign.offer}</p> : null}
          <small>Onboarding destination: {campaign.intendedLens}</small>
        </aside>
      </header>

      <section className="campaign-section campaign-problem">
        <p className="eyebrow">Why this campaign exists</p>
        <div className="campaign-section-grid">
          <h2>{campaign.problemTitle}</h2>
          <p>{campaign.problemCopy}</p>
        </div>
      </section>

      <section className="campaign-proof-grid" aria-label="Campaign proof points">
        {campaign.proofPoints.map((point) => <article key={point}><span>✓</span><p>{point}</p></article>)}
      </section>

      <section className="campaign-section" id="how-it-works">
        <p className="eyebrow">How it works</p>
        <div className="campaign-section-heading">
          <h2>One acquisition path. One RFxchange identity. One Exchange.</h2>
          <p>Campaign presentation can be specific. Identity, organization truth, onboarding, and the authenticated operating chassis remain canonical.</p>
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

      <section className="campaign-section campaign-exchange-preview">
        <div>
          <p className="eyebrow">Operating chassis handoff</p>
          <h2>The campaign ends where the Exchange begins.</h2>
          <p>After registration and Exchange-ready onboarding, this campaign routes to the <strong>{campaign.intendedLens}</strong> lens while keeping the same shared map, search, drawer, cards, details, navigation, identity, and organization context.</p>
        </div>
        <div className="campaign-preview-frame" aria-label="RFxchange chassis preview">
          <div className="campaign-preview-search">Search the Exchange</div>
          <div className="campaign-preview-map"><span>Persistent map</span></div>
          <div className="campaign-preview-drawer">
            <i />
            <strong>{campaign.intendedLens} results</strong>
            <div className="campaign-preview-actions"><span /><span /><span /><span /></div>
            <div className="campaign-preview-card" />
          </div>
          <div className="campaign-preview-nav">RFx · Resources · Intelligence · Capabilities · Menu</div>
        </div>
      </section>

      <section className="campaign-section">
        <p className="eyebrow">What participants gain</p>
        <div className="campaign-benefits">
          {campaign.benefits.map((benefit) => <article key={benefit}><h3>{benefit}</h3></article>)}
        </div>
      </section>

      <section className="campaign-section campaign-faq">
        <p className="eyebrow">Questions</p>
        <h2>Keep campaign context useful without letting it become system truth.</h2>
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
          <Link className="button button-primary" href={registrationHref}>{campaign.primaryCta}</Link>
          <Link className="button button-secondary" href="/login">Sign in</Link>
        </div>
      </section>

      <footer className="campaign-footer">
        <Link href="/">RFxchange</Link>
        <span>Campaign landing page · Public / Acquisition Shell</span>
        <div><Link href="/login">Sign in</Link><Link href={registrationHref}>Join free</Link></div>
      </footer>
    </main>
  );
}
