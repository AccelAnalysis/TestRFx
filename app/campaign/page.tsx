import Link from "next/link";
import { campaigns } from "@/lib/public/campaigns";

export default function CampaignIndexPage() {
  const liveCampaigns = campaigns.filter((campaign) => campaign.status === "live");
  return (
    <main className="campaign-shell">
      <nav className="campaign-nav">
        <Link className="campaign-brand" href="/">RFxchange</Link>
        <div className="campaign-nav-actions"><Link href="/login">Sign in</Link><Link className="button button-primary" href="/register">Join free</Link></div>
      </nav>
      <header className="campaign-hero" style={{ minHeight: "520px" }}>
        <div className="campaign-hero-copy">
          <p className="eyebrow">Public / Acquisition Shell</p>
          <h1>Campaign landing pages that route into one RFxchange.</h1>
          <p className="campaign-lede">These reference campaigns demonstrate membership, geography, use-case, capability, audience, and partner acquisition without forking identity, onboarding, or the authenticated Exchange.</p>
        </div>
      </header>
      <section className="campaign-section">
        <p className="eyebrow">Live campaign references</p>
        <div className="campaign-benefits">
          {liveCampaigns.map((campaign) => (
            <article key={campaign.slug}>
              <p className="eyebrow">{campaign.family.replaceAll("-", " ")}</p>
              <h3>{campaign.headline}</h3>
              <p className="muted">{campaign.audience} · routes to {campaign.intendedLens}</p>
              <Link href={`/campaign/${campaign.slug}`}>Open campaign →</Link>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
