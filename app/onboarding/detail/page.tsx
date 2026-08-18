import Link from "next/link";
import { listOnboardingDetailDefinitions } from "@/lib/onboarding/detail-surface";

export default function OnboardingDetailIndexPage() {
  const definitions = listOnboardingDetailDefinitions();
  return (
    <main className="identity-shell onboarding-shell">
      <section className="identity-card onboarding-card">
        <p className="eyebrow">Identity & onboarding chassis</p>
        <h1>Detail Surface reference routes</h1>
        <p className="muted">
          Each route exercises the reusable review/edit/resolve surface. Adjacent onboarding domains provide canonical data, validation, and persistence through this contract rather than creating separate detail-page patterns.
        </p>
        <div className="step-list">
          {definitions.map((definition) => (
            <Link className="step" href={`/onboarding/detail/${definition.subject}`} key={definition.subject} style={{ textDecoration: "none" }}>
              <span>{definition.step}</span>
              <strong>{definition.subjectLabel}</strong>
            </Link>
          ))}
        </div>
        <Link className="button button-secondary button-full" href="/onboarding">Back to onboarding</Link>
      </section>
    </main>
  );
}
