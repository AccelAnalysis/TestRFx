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
          Drill into the source-defined child and grandchild workflows. Detail Surface owns hierarchy and continuity;
          canonical values and mutations stay with the onboarding services that own them.
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
