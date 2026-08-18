import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { findPublicContent, publicContentCatalog, relatedPublicContent } from "@/lib/public-content/catalog";

export function generateStaticParams() {
  return publicContentCatalog.map((item) => ({ slug: item.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const item = findPublicContent(slug);
  if (!item) return { title: "Resource not found | RFxchange" };
  return {
    title: `${item.title} | RFxchange Resources`,
    description: item.summary,
  };
}

function typeLabel(type: string) {
  return type
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default async function PublicResourceDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const item = findPublicContent(slug);
  if (!item) notFound();
  const related = relatedPublicContent(item);

  return (
    <main className="resource-detail-page">
      <nav className="resource-breadcrumb" aria-label="Breadcrumb">
        <Link href="/resources">Resources</Link>
        <span aria-hidden="true">/</span>
        <span>{item.topic}</span>
      </nav>

      <article className="resource-detail">
        <header>
          <div className="resource-card-meta">
            <span>{typeLabel(item.type)}</span>
            <span>{item.readingTime}</span>
            <span>{item.publishedOn}</span>
          </div>
          <p className="resource-card-topic">{item.topic}</p>
          <h1>{item.title}</h1>
          <p className="resource-detail-summary">{item.summary}</p>
          <div className="resource-audience-row" aria-label="Audience">
            {item.audiences.map((audience) => <span key={audience}>{audience}</span>)}
          </div>
        </header>

        <div className="resource-detail-layout">
          <div className="resource-prose">
            {item.body.map((paragraph, index) => <p key={index}>{paragraph}</p>)}

            {item.takeaways && item.takeaways.length > 0 && (
              <section className="resource-takeaways" aria-labelledby="takeaways-title">
                <p className="eyebrow">Practical takeaways</p>
                <h2 id="takeaways-title">Use this before the next step</h2>
                <ul>
                  {item.takeaways.map((takeaway) => <li key={takeaway}>{takeaway}</li>)}
                </ul>
              </section>
            )}
          </div>

          <aside className="resource-exchange-cta">
            <p className="eyebrow">Continue in RFxchange</p>
            <h2>Move from learning to the live Exchange.</h2>
            <p>This public item is intentionally separate from operational Exchange records and actions.</p>
            <Link className="button button-primary button-full" href={item.exchangeCta.href}>{item.exchangeCta.label}</Link>
            <Link className="button button-secondary button-full" href="/register">Create account</Link>
          </aside>
        </div>
      </article>

      <section className="resource-related" aria-labelledby="related-title">
        <div className="resource-section-heading">
          <p className="eyebrow">Related public content</p>
          <h2 id="related-title">Keep preparing</h2>
        </div>
        <div className="resource-content-grid">
          {related.map((candidate) => (
            <article className="resource-content-card" key={candidate.slug}>
              <div className="resource-card-meta">
                <span>{typeLabel(candidate.type)}</span>
                <span>{candidate.readingTime}</span>
              </div>
              <p className="resource-card-topic">{candidate.topic}</p>
              <h3><Link href={`/resources/${candidate.slug}`}>{candidate.title}</Link></h3>
              <p>{candidate.summary}</p>
              <Link className="resource-text-link" href={`/resources/${candidate.slug}`}>Read resource <span aria-hidden="true">→</span></Link>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
