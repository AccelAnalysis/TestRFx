import Link from "next/link";

const steps = [
  { label: "Account verification", href: "/onboarding/account-verification", detail: "Verify control of the account email." },
  { label: "Organization", href: "/onboarding/organization?step=welcome", detail: "Resolve, claim, join, or create the canonical organization." },
  { label: "Geography", href: "/onboarding/geography", detail: "Establish authoritative location and service geography." },
  { label: "Organization profile", href: "/onboarding/organization-profile", detail: "Complete organization identity, contact, roles, and visibility." },
  { label: "Capabilities", href: "/onboarding/capabilities", detail: "Enrich capabilities and AMACS context." },
  { label: "Exchange ready", href: "/onboarding/completion", detail: "Confirm readiness and enter the authenticated Exchange." },
];

export default function OnboardingPage() {
  return (
    <main className="identity-shell onboarding-shell">
      <section className="identity-card onboarding-card">
        <p className="eyebrow">Exchange onboarding</p>
        <h1>Build your organization context</h1>
        <p className="muted">Each onboarding stage is a concrete route. Complete the stages in order so organization identity, geography, profile data, and capabilities resolve against the same canonical organization.</p>
        <div className="step-list">
          {steps.map((step, index) => (
            <Link className="step" href={step.href} key={step.label}>
              <span>{index + 1}</span>
              <div><strong>{step.label}</strong><small>{step.detail}</small></div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
