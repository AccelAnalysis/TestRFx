import Link from "next/link";

export default function MarketingPage() {
  return (
    <main className="public-shell">
      <nav className="public-nav">
        <strong>RFxchange</strong>
        <div className="public-nav-actions">
          <Link href="/login">Log in</Link>
          <Link className="button button-primary" href="/register">Join the Exchange</Link>
        </div>
      </nav>
      <section className="hero">
        <p className="eyebrow">The business-to-business exchange</p>
        <h1>Discover demand, capabilities, resources, and market intelligence in one operating environment.</h1>
        <p className="hero-copy">This TestRFx build proves the common RFxchange chassis: public acquisition, identity and onboarding, and one persistent map-first Exchange shell.</p>
        <div className="hero-actions">
          <Link className="button button-primary" href="/register">Create account</Link>
          <Link className="button button-secondary" href="/exchange">Open reference Exchange</Link>
        </div>
      </section>
      <section className="public-grid">
        {[
          ["RFx", "Find and act on opportunity records."],
          ["Resources", "Discover offers, needs, providers, and assets."],
          ["Intelligence", "View market signals and geographic patterns."],
          ["Capabilities", "Find organizations through governed capability data."],
        ].map(([title, copy]) => (
          <article className="public-card" key={title}>
            <h2>{title}</h2><p>{copy}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
