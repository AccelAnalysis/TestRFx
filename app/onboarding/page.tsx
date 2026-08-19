import Link from "next/link";
import { listOnboardingDetailDefinitions, onboardingDetailHref } from "@/lib/onboarding/detail-surface";

export default function OnboardingPage() {
  const steps = listOnboardingDetailDefinitions().filter((definition) => definition.subject !== "membership");
  const membership = listOnboardingDetailDefinitions().find((definition) => definition.subject === "membership");

  return (
    <main className="identity-shell onboarding-shell">
      <section className="identity-card onboarding-card">
        <p className="eyebrow">Exchange onboarding</p>
        <h1>Build your organization context</h1>
        <p className="muted">
          Each stage opens the governed Detail Surface hierarchy and then hands concrete work to the onboarding workflow that owns it.
        </p>
        <div className="step-list">
          {steps.map((step) => (
            <Link className="step" href={onboardingDetailHref(step.subject)} key={step.subject} style={{ textDecoration: "none" }}>
              <span>{step.step}</span>
              <strong>{step.label}</strong>
            </Link>
          ))}
        </div>
        {membership ? (
          <p className="muted">
            Commercial membership is a conditional path, not a universal access gate. <Link href={onboardingDetailHref(membership.subject)}>Review membership options.</Link>
          </p>
        ) : null}
        <Link className="button button-primary button-full" href="/onboarding/detail/readiness">Review Exchange readiness</Link>
      </section>
    </main>
  );
}
