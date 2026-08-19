import Link from "next/link";
import type { Metadata } from "next";
import { ResourceExplorer } from "@/components/public-resources/resource-explorer";
import { ResourceTree } from "@/components/public-resources/resource-tree";
import { publicResourceTree } from "@/lib/public-content/navigation";
import {
  getFeaturedPublicContent,
  joinForExchangeHref,
  listPublishedContent,
  publicContentFacets,
  signInForExchangeHref,
} from "@/lib/public-content/service";

export const metadata: Metadata = {
  title: "Public Resources | RFxchange",
  description: "Guides, templates, insights, reference material, examples, and learning collections that prepare organizations to use RFxchange.",
};

export default function PublicResourcesPage() {
  const published = listPublishedContent();
  const facets = publicContentFacets();
  const featured = getFeaturedPublicContent();
  const latest = published.slice(0, 3);
  const audienceSection = publicResourceTree.find((item) => item.id === "audiences");

  return (
    <main>
      <section className="resource-hero">
        <div>
          <p className="eyebrow">Public resources / content</p>
          <h1>Learn the Exchange before you transact in it.</h1>
          <p className="resource-hero-copy">Practical guides, downloadable preparation tools, published insights, AMACS education, examples, and reference material for businesses, buyers, and resource providers.</p>
          <div className="hero-actions">
            <a className="button button-primary" href="#explore">Search published content</a>
            <Link className="button button-secondary" href="/resources/learn">Browse the hierarchy</Link>
          </div>
        </div>
        <aside className="resource-hero-panel" aria-label="Public versus authenticated boundary">
          <p className="eyebrow">Platform boundary</p>
          <h2>Prepare publicly. Act in the Exchange.</h2>
          <p>Public content explains, prepares, and previews value. Live records, saved/follow state, offers, requests, responses, referrals, and other transactional workflows stay inside the authenticated operating chassis.</p>
          <div className="resource-boundary-list">
            <span>Public: learn · research · prepare · download</span>
            <span>Exchange: discover · save · respond · connect</span>
          </div>
        </aside>
      </section>

      <section className="resource-hierarchy-overview" aria-labelledby="hierarchy-title">
        <ResourceTree activeHref="/resources" />
        <div>
          <div className="resource-section-heading">
            <p className="eyebrow">True hierarchy</p>
            <h2 id="hierarchy-title">Browse child and grandchild collections</h2>
            <p>Each branch is a real route. The route is the nested navigation state, so bookmarks and browser Back/Forward restore the same location.</p>
          </div>
          <div className="resource-child-grid">
            {publicResourceTree.map((item) => (
              <Link className="resource-child-card" href={item.href} key={item.id}>
                <span>{item.kind}</span>
                <h3>{item.label}</h3>
                <p>{item.description}</p>
                <strong>{item.children?.length ?? 0} child paths <span aria-hidden="true">→</span></strong>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {featured ? (
        <section className="resource-section" aria-labelledby="featured-title">
          <div className="resource-section-heading resource-section-heading-split">
            <div><p className="eyebrow">Featured</p><h2 id="featured-title">Featured published guide</h2></div>
            <p>Featured status is curated publication metadata, not fabricated popularity.</p>
          </div>
          <article className="resource-feature-card">
            <div>
              <p className="resource-card-topic">{featured.topic}</p>
              <h3>{featured.title}</h3>
              <p>{featured.summary}</p>
              <div className="resource-audience-row">{featured.audiences.map((audience) => <span key={audience}>{audience}</span>)}</div>
            </div>
            <div className="resource-feature-actions">
              <Link className="button button-primary" href={`/resources/${featured.slug}`}>Read featured guide</Link>
              <Link className="button button-secondary" href={signInForExchangeHref(featured.exchangeCta.href)}>Sign in for next step</Link>
            </div>
          </article>
        </section>
      ) : null}

      <section className="resource-section" aria-labelledby="latest-title">
        <div className="resource-section-heading"><p className="eyebrow">Latest</p><h2 id="latest-title">Most recently published</h2></div>
        <div className="resource-content-grid">
          {latest.map((item) => (
            <article className="resource-content-card" key={item.slug}>
              <div className="resource-card-meta"><span>{item.type}</span><span>{item.publishedOn}</span></div>
              <p className="resource-card-topic">{item.topic}</p>
              <h3><Link href={`/resources/${item.slug}`}>{item.title}</Link></h3>
              <p>{item.summary}</p>
              <Link className="resource-text-link" href={`/resources/${item.slug}`}>Read resource <span aria-hidden="true">→</span></Link>
            </article>
          ))}
        </div>
      </section>

      {audienceSection?.children ? (
        <section className="resource-section resource-audience-section" aria-labelledby="audience-title">
          <div className="resource-section-heading">
            <p className="eyebrow">Explore by audience</p>
            <h2 id="audience-title">Businesses, Buyers, and Resource Providers</h2>
            <p>These audience paths are carried directly from the public Marketing flow.</p>
          </div>
          <div className="resource-audience-grid">
            {audienceSection.children.map((audience) => (
              <Link className="resource-audience-link" href={audience.href} key={audience.id}>
                <h3>{audience.label}</h3>
                <p>{audience.description}</p>
                <strong>Open audience path <span aria-hidden="true">→</span></strong>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <ResourceExplorer items={published} facets={facets} />

      <section className="resource-handoff" aria-labelledby="handoff-title">
        <div>
          <p className="eyebrow">Public → Identity → Exchange</p>
          <h2 id="handoff-title">Ready to work with authenticated records?</h2>
          <p>These handoffs preserve the intended Exchange lens through Login or Registration instead of bypassing the Identity &amp; Onboarding shell.</p>
        </div>
        <div className="resource-handoff-links">
          {([[
            "RFx", "/exchange/rfx"
          ], [
            "Resources", "/exchange/resources"
          ], [
            "Intelligence", "/exchange/intelligence"
          ], [
            "Capabilities", "/exchange/capabilities"
          ]] as const).map(([label, href]) => (
            <div className="resource-handoff-choice" key={label}>
              <strong>{label}</strong>
              <Link href={signInForExchangeHref(href)}>Sign in</Link>
              <Link href={joinForExchangeHref(href)}>Create account</Link>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
