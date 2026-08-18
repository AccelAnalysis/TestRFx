import Link from "next/link";

const steps = ["Account", "Organization", "Geography", "Profile", "Capabilities", "Exchange ready"];

export default function OnboardingPage() {
  return (
    <main className="identity-shell onboarding-shell">
      <section className="identity-card onboarding-card">
        <p className="eyebrow">Exchange onboarding</p>
        <h1>Build your organization context</h1>
        <div className="step-list">
          {steps.map((step, index) => <div className="step" key={step}><span>{index + 1}</span><strong>{step}</strong></div>)}
        </div>
        <p className="muted">The chassis establishes the route and state boundary. Production verification, organization claiming, geocoding, and AMACS enrichment plug into these steps later.</p>
        <Link className="button button-primary button-full" href="/exchange">Enter reference Exchange</Link>
      </section>
    </main>
  );
}
