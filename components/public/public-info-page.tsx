import Link from "next/link";
import type { PublicDestination } from "@/lib/public/destinations";
import { PUBLIC_DESTINATIONS } from "@/lib/public/destinations";
import type { PublicInfoPageDefinition } from "@/lib/public/pages";
import { PublicFooter } from "./public-footer";
import { PublicHeader } from "./public-header";
import styles from "./public-shell.module.css";

function sectionAnchor(heading: string) {
  return heading
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function PublicInfoPage({ page }: { page: PublicInfoPageDefinition }) {
  return (
    <div className={styles.pageShell}>
      <PublicHeader />
      <main className={styles.main}>
        <header className={styles.masthead}>
          <p className={styles.eyebrow}>{page.eyebrow}</p>
          <h1>{page.title}</h1>
          <p className={styles.intro}>{page.intro}</p>
          {page.statusNote ? <p className={styles.notice}>{page.statusNote}</p> : null}
        </header>

        <div className={styles.contentGrid}>
          <div className={styles.sections}>
            {page.sections.map((section) => {
              const anchor = sectionAnchor(section.heading);
              return (
                <section className={styles.section} id={anchor} key={section.heading}>
                  <h2>{section.heading}</h2>
                  {section.paragraphs?.map((paragraph, index) => (
                    <p key={`${section.heading}-paragraph-${index}`}>{paragraph}</p>
                  ))}
                  {section.bullets ? (
                    <ul>
                      {section.bullets.map((bullet, index) => (
                        <li key={`${section.heading}-bullet-${index}`}>{bullet}</li>
                      ))}
                    </ul>
                  ) : null}
                </section>
              );
            })}
          </div>

          <aside className={styles.aside} aria-label="Related public destinations">
            <div className={styles.asideCard}>
              <h2>On this page</h2>
              <nav aria-label={`Sections in ${page.title}`}>
                {page.sections.map((section) => (
                  <Link href={`#${sectionAnchor(section.heading)}`} key={section.heading}>
                    {section.heading}
                  </Link>
                ))}
              </nav>
            </div>
            <div className={styles.asideCard}>
              <h2>Related destinations</h2>
              <div className={styles.relatedGrid}>
                {page.relatedDestinationIds.map((destinationId) => {
                  const destination = PUBLIC_DESTINATIONS[destinationId];
                  return (
                    <Link href={destination.href} key={destinationId}>
                      {destination.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          </aside>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}

const OWNER_LABELS: Record<PublicDestination["owner"], string> = {
  "about-legal-footer": "About / Legal / Footer",
  marketing: "Marketing",
  "pricing-membership": "Pricing / Membership",
  identity: "Identity & Onboarding",
};

export function PublicIntegrationPage({ destination }: { destination: PublicDestination }) {
  return (
    <div className={styles.pageShell}>
      <PublicHeader />
      <main className={styles.main}>
        <header className={styles.masthead}>
          <p className={styles.eyebrow}>Public route contract</p>
          <h1>{destination.label}</h1>
          <p className={styles.intro}>{destination.summary}</p>
        </header>
        <section className={styles.integrationCard}>
          <h2>This route is reserved for its owning Public-shell module.</h2>
          <p>
            The shared footer can safely point here now. A sibling Public / Acquisition module can
            replace this integration surface with a static route without changing the footer,
            canonical URL, or shell ownership model.
          </p>
          <div className={styles.integrationMeta}>
            <span>Owner: {OWNER_LABELS[destination.owner]}</span>
            <span>Route: {destination.href}</span>
          </div>
          <div className={styles.integrationActions}>
            <Link className={styles.textAction} href="/">
              Back to marketing
            </Link>
            <Link className={styles.primaryAction} href={PUBLIC_DESTINATIONS.join.href}>
              Join Free
            </Link>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
