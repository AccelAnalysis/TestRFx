import Link from "next/link";
import { notFound } from "next/navigation";
import { ResourceTree } from "@/components/public-resources/resource-tree";
import { withBasePath } from "@/lib/exchange/base-path";
import {
  findPublicResourceNodeByHref,
  publicResourceBreadcrumbs,
  publicResourceNodes,
} from "@/lib/public-content/navigation";
import {
  contentForPublicResourceNode,
  joinForExchangeHref,
  signInForExchangeHref,
} from "@/lib/public-content/service";

function typeLabel(type: string) {
  return type.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

export function PublicResourceCollectionPage({ href }: { href: string }) {
  const node = findPublicResourceNodeByHref(href);
  if (!node) notFound();
  const breadcrumbs = publicResourceBreadcrumbs(href);
  const content = contentForPublicResourceNode(node);
  const aggregateDownloads = node.id === "templates-downloads"
    ? publicResourceNodes.filter((candidate) => candidate.downloadHref)
    : [];

  return (
    <main className="resource-hierarchy-page">
      <div className="resource-hierarchy-shell">
        <ResourceTree activeHref={href} />
        <div className="resource-hierarchy-content">
          <nav className="resource-breadcrumb" aria-label="Breadcrumb">
            <Link href="/resources">Resources Hub</Link>
            {breadcrumbs.map((crumb) => (
              <span key={crumb.id} className="resource-breadcrumb-segment">
                <span aria-hidden="true">/</span>
                <Link href={crumb.href} aria-current={crumb.href === href ? "page" : undefined}>{crumb.label}</Link>
              </span>
            ))}
          </nav>

          <header className="resource-collection-header">
            <p className="eyebrow">{node.kind === "section" ? "Public resources section" : "Public resources collection"}</p>
            <h1>{node.label}</h1>
            <p>{node.description}</p>
          </header>

          {node.children && node.children.length > 0 ? (
            <section className="resource-collection-block" aria-labelledby="children-title">
              <div className="resource-section-heading">
                <p className="eyebrow">Continue deeper</p>
                <h2 id="children-title">Child workflows and collections</h2>
              </div>
              <div className="resource-child-grid">
                {node.children.map((child) => (
                  <Link className="resource-child-card" href={child.href} key={child.id}>
                    <span>{child.kind}</span>
                    <h3>{child.label}</h3>
                    <p>{child.description}</p>
                    <strong>Open <span aria-hidden="true">→</span></strong>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {node.downloadHref ? (
            <section className="resource-download-panel" aria-labelledby="download-title">
              <div>
                <p className="eyebrow">Working asset</p>
                <h2 id="download-title">Download the source-controlled worksheet</h2>
                <p>This is a real file in the Public Resources publishing layer. It does not simulate saving or mutating an authenticated Exchange record.</p>
              </div>
              <a className="button button-primary" href={withBasePath(node.downloadHref)} download>Download worksheet</a>
            </section>
          ) : null}

          {aggregateDownloads.length > 0 ? (
            <section className="resource-collection-block" aria-labelledby="downloads-title">
              <div className="resource-section-heading">
                <p className="eyebrow">Downloads</p>
                <h2 id="downloads-title">Available worksheets and checklists</h2>
                <p>These are committed files, not placeholder download buttons.</p>
              </div>
              <div className="resource-child-grid">
                {aggregateDownloads.map((download) => (
                  <a className="resource-child-card" href={withBasePath(download.downloadHref!)} download key={download.id}>
                    <span>Download</span>
                    <h3>{download.label}</h3>
                    <p>{download.description}</p>
                    <strong>Download file <span aria-hidden="true">↓</span></strong>
                  </a>
                ))}
              </div>
            </section>
          ) : null}

          <section className="resource-collection-block" aria-labelledby="published-title">
            <div className="resource-section-heading resource-section-heading-split">
              <div>
                <p className="eyebrow">Published content</p>
                <h2 id="published-title">{content.length} {content.length === 1 ? "item" : "items"} in this branch</h2>
              </div>
              <p>Only committed published content is shown. Empty source-defined collections remain empty instead of being filled with fictional articles, success stories, or events.</p>
            </div>

            {content.length > 0 ? (
              <div className="resource-content-grid">
                {content.map((item) => (
                  <article className="resource-content-card" key={item.slug}>
                    <div className="resource-card-meta">
                      <span>{typeLabel(item.type)}</span>
                      <span>{item.readingTime}</span>
                    </div>
                    <p className="resource-card-topic">{item.topic}</p>
                    <h3><Link href={`/resources/${item.slug}`}>{item.title}</Link></h3>
                    <p>{item.summary}</p>
                    <div className="resource-audience-row" aria-label="Audience">
                      {item.audiences.map((audience) => <span key={audience}>{audience}</span>)}
                    </div>
                    <Link className="resource-text-link" href={`/resources/${item.slug}`}>Read resource <span aria-hidden="true">→</span></Link>
                  </article>
                ))}
              </div>
            ) : (
              <div className="resource-empty-state">
                <strong>No published items in this collection.</strong>
                <p>The route is part of the source-defined hierarchy, but RFxchange has not published a real item for it. No placeholder content is generated.</p>
              </div>
            )}
          </section>

          {node.exchangeHref ? (
            <section className="resource-auth-handoff" aria-labelledby="handoff-title">
              <div>
                <p className="eyebrow">Authenticated handoff</p>
                <h2 id="handoff-title">Continue this workflow in the Exchange</h2>
                <p>Sign in or register with this destination preserved through the Identity &amp; Onboarding shell.</p>
              </div>
              <div className="resource-auth-actions">
                <Link className="button button-primary" href={signInForExchangeHref(node.exchangeHref)}>Sign in to continue</Link>
                <Link className="button button-secondary" href={joinForExchangeHref(node.exchangeHref)}>Create account</Link>
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </main>
  );
}
