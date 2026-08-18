import Link from "next/link";
import styles from "./onboarding.module.css";

const workflow = [
  {
    step: 1,
    label: "Account verification",
    description: "Establish the person-level RFxchange identity before organization access.",
    href: "/onboarding/account-verification",
    children: [
      { label: "Verify email / access", href: "/onboarding/account-verification" },
    ],
  },
  {
    step: 2,
    label: "Organization selection / creation",
    description: "Resolve one canonical organization and the user's affiliation with it.",
    href: "/onboarding/organization",
    children: [
      { label: "Find or claim an existing organization", href: "/onboarding/organization" },
      { label: "Create a new organization", href: "/onboarding/organization" },
    ],
  },
  {
    step: 3,
    label: "Geography",
    description: "Establish primary locality, base location, public location treatment, and service geography.",
    href: "/onboarding/geography",
    children: [
      { label: "Primary locality", href: "/onboarding/geography" },
      { label: "Base location / map treatment", href: "/onboarding/geography" },
      { label: "Privacy preference", href: "/onboarding/geography" },
      { label: "Service geography", href: "/onboarding/geography" },
    ],
  },
  {
    step: 4,
    label: "Organization profile",
    description: "Build the shared Exchange-facing organization identity and visibility preferences.",
    href: "/onboarding/organization-profile",
    children: [
      { label: "Core profile details", href: "/onboarding/organization-profile" },
      { label: "Industry & services", href: "/onboarding/organization-profile" },
      { label: "Visibility preferences", href: "/onboarding/organization-profile" },
    ],
  },
  {
    step: 5,
    label: "Capability enrichment",
    description: "Capture real capability claims and progressively enrich them without blocking optional depth.",
    href: "/onboarding/capabilities",
    children: [
      { label: "Capabilities entry", href: "/onboarding/capabilities?stage=capabilities" },
      { label: "AMACS mapping / assistance", href: "/onboarding/capabilities?stage=amacs" },
      { label: "Evidence / certifications", href: "/onboarding/capabilities?stage=evidence" },
      { label: "Tags / keywords / specialties", href: "/onboarding/capabilities?stage=discoverability" },
    ],
  },
  {
    step: 6,
    label: "Participation / membership",
    description: "Resolve a valid free or paid participation path without treating payment as verification or authority.",
    href: "/onboarding/membership?membership=free",
    children: [
      { label: "Free organization participation", href: "/onboarding/membership?membership=free" },
      { label: "Founding Membership", href: "/onboarding/membership?membership=founding" },
    ],
  },
  {
    step: 7,
    label: "Exchange-ready Completion",
    description: "Review saved readiness, activate the organization presence, and enter the existing Exchange shell.",
    href: "/onboarding/completion",
    children: [
      { label: "Review & completion checkpoint", href: "/onboarding/completion" },
      { label: "Confirm Exchange presence", href: "/onboarding/completion/activate" },
      { label: "Exchange-ready confirmation", href: "/onboarding/completion/success" },
    ],
  },
] as const;

export default function OnboardingPage() {
  return (
    <main className={styles.shell}>
      <div className={styles.frame}>
        <header className={styles.header}>
          <Link className={styles.brand} href="/">RFxchange</Link>
          <Link href="/login">Return to sign in</Link>
        </header>

        <section className={styles.intro}>
          <p className="eyebrow">Identity & onboarding</p>
          <h1>Build the organization context once</h1>
          <p>
            Work through the concrete onboarding workflows below. RFxchange saves the completion checkpoints used by Exchange-ready review; there is no direct onboarding bypass into the authenticated Exchange.
          </p>
        </section>

        <ol className={styles.tree} aria-label="Onboarding workflow hierarchy">
          {workflow.map((item) => (
            <li className={styles.node} key={item.label}>
              <Link className={styles.nodeHeader} href={item.href}>
                <span>{item.step}</span>
                <span>
                  <strong>{item.label}</strong>
                  <small>{item.description}</small>
                </span>
                <span aria-hidden="true">›</span>
              </Link>
              <ul className={styles.children}>
                {item.children.map((child) => (
                  <li key={child.label}>
                    <Link href={child.href}><span>{child.label}</span><span aria-hidden="true">→</span></Link>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>

        <p className={styles.note}>
          Progressive onboarding remains intentional: AMACS depth, evidence, certifications, keywords, and specialties can continue after entry. Exchange activation itself remains blocked until the required identity, organization, geography, profile, capability, visibility, and participation checkpoints are complete.
        </p>
      </div>
    </main>
  );
}
