import Link from "next/link";
import { listOnboardingDetailDefinitions, onboardingDetailHref } from "@/lib/onboarding/detail-surface";

export default function OnboardingDetailIndexPage() {
  const definitions = listOnboardingDetailDefinitions();
  return (
    <main className="identity-shell onboarding-shell">
      <section className="identity-card onboarding-card">
        <p className="eyebrow">Identity & onboarding chassis</p>
        <h1>Detail Surface hierarchy</h1>
        <p className="muted">
          Drill into the actual child and grandchild onboarding workflows. Detail Surface owns hierarchy, continuity, and routing; canonical values and actions stay with the organization, geography, profile, capabilities, membership, and readiness services that own them.
        </p>
        <div className="step-list">
          {definitions.map((definition) => (
            <Link className="step" href={onboardingDetailHref(definition.subject)} key={definition.subject} style={{ textDecoration: "none" }}>
              <span>{definition.step}</span>
              <strong>{definition.label} · {definition.children.length} paths</strong>
            </Link>
          ))}
        </div>
        <Link className="button button-secondary button-full" href="/onboarding">Back to onboarding</Link>
      </section>
    </main>
  );
}
