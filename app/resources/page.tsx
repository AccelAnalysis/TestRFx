import Link from "next/link";
import type { Metadata } from "next";
import { ResourceExplorer } from "@/components/public-resources/resource-explorer";
import { publicContentCatalog } from "@/lib/public-content/catalog";

export const metadata: Metadata = {
  title: "Public Resources | RFxchange",
  description: "Guides, templates, insights, reference material, and learning content that prepare organizations to use RFxchange.",
};

const learningPaths = [
  ["RFx & procurement", "Prepare for opportunity discovery, pursuit decisions, and response work."],
  ["Capabilities & AMACS", "Understand governed capability language, evidence, matching, and discovery."],
  ["Resources", "Prepare useful offers, requests, availability, and provider context."],
  ["Intelligence", "Understand market signals, geography, supply, demand, and public briefs."],
  ["Teaming & referrals", "Turn capability gaps and relationships into structured cross-lens workflows."],
] as const;

export default function PublicResourcesPage() {
  const featured = publicContentCatalog.find((item) => item.featured) ?? publicContentCatalog[0];

  return (
    <main>
      <section className="resource-hero">
        <div>
          <p className="eyebrow">Public resources / content</p>
          <h1>Learn the Exchange before you transact in it.</h1>
          <p className="resource-hero-copy">
            Practical guides, templates, market explainers, AMACS education, examples, and reference material for businesses, buyers, and resource providers.
          </p>
          <div className="hero-actions">
            <a className="button button-primary" href="#explore">Explore the library</a>
            <Link className="button button-secondary" href="/register">Create account</Link>
          </div>
        </div>
        <aside className="resource-hero-panel" aria-label="Public versus authenticated boundary">
          <p className="eyebrow">Platform boundary</p>
          <h2>Prepare publicly. Act in the Exchange.</h2>
          <p>Public content explains, prepares, and previews value. Live records, saved state, offers, requests, responses, referrals, and other transactional workflows stay inside the authenticated operating chassis.</p>
          <div className="resource-boundary-list">
            <span>Public: learn · research · prepare</span>
            <span>Exchange: discover · save · respond · connect</span>
          </div>
        </aside>
      </section>

      <section className="resource-section" aria-labelledby="featured-title">
        <div className="resource-section-heading resource-section-heading-split">
          <div>
            <p className="eyebrow">Featured</p>
            <h2 id="featured-title">Start with a pursuit decision</h2>
          </div>
          <p>Public content should create a useful next step, then hand the user into the appropriate Exchange lens instead of duplicating the application.</p>
        </div>
        <article className="resource-feature-card">
          <div>
            <p className="resource-card-topic">{featured.topic}</p>
            <h3>{featured.title}</h3>
            <p>{featured.summary}</p>
            <div className="resource-audience-row">
              {featured.audiences.map((audience) => <span key={audience}>{audience}</span>)}
            </div>
          </div>
          <div className="resource-feature-actions">
            <Link className="button button-primary" href={`/resources/${featured.slug}`}>Read featured guide</Link>
            <Link className="button button-secondary" href={featured.exchangeCta.href}>{featured.exchangeCta.label}</Link>
          </div>
        </article>
      </section>

      <section className="resource-section" aria-labelledby="paths-title">
        <div className="resource-section-heading">
          <p className="eyebrow">Learn by Exchange concept</p>
          <h2 id="paths-title">Five public learning paths</h2>
          <p>Topic organization mirrors the RFxchange mental model while keeping Referrals and Teaming cross-lens.</p>
        </div>
        <div className="resource-learning-grid">
          {learningPaths.map(([title, copy], index) => (
            <article key={title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="resource-section resource-audience-section" aria-labelledby="audience-title">
        <div className="resource-section-heading">
          <p className="eyebrow">Explore by audience</p>
          <h2 id="audience-title">One library, different operating questions</h2>
        </div>
        <div className="resource-audience-grid">
          <article>
            <h3>Businesses</h3>
            <p>Prepare capabilities, evaluate RFx, identify resource needs, find partners, and understand local market context.</p>
          </article>
          <article>
            <h3>Buyers</h3>
            <p>Understand capability discovery, supplier context, market coverage, geographic concentration, and Exchange terminology.</p>
          </article>
          <article>
            <h3>Resource providers</h3>
            <p>Prepare clear offers, availability, service geography, capability context, and connection-ready information.</p>
          </article>
        </div>
      </section>

      <ResourceExplorer items={publicContentCatalog} />

      <section className="resource-handoff" aria-labelledby="handoff-title">
        <div>
          <p className="eyebrow">Public → Exchange handoff</p>
          <h2 id="handoff-title">Ready to work with live records?</h2>
          <p>The authenticated chassis keeps one map, one search model, one result drawer, shared cards, and governed actions across the four Exchange lenses.</p>
        </div>
        <div className="resource-handoff-links">
          <Link href="/exchange/rfx">RFx <span aria-hidden="true">→</span></Link>
          <Link href="/exchange/resources">Resources <span aria-hidden="true">→</span></Link>
          <Link href="/exchange/intelligence">Intelligence <span aria-hidden="true">→</span></Link>
          <Link href="/exchange/capabilities">Capabilities <span aria-hidden="true">→</span></Link>
        </div>
      </section>
    </main>
  );
}
