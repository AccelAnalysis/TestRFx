import Link from "next/link";
import type { MarketingPageDefinition } from "@/lib/marketing/navigation";
import { ConversionLink } from "./acquisition-context";
import { MarketingChrome } from "./marketing-chrome";
import { MarketingFooter } from "./marketing-footer";
import styles from "./marketing.module.css";

export function PublicInfoPage({ definition }: { definition: MarketingPageDefinition }) {
  return (
    <div className={styles.marketingShell}>
      <MarketingChrome />
      <main className={styles.publicMain}>
        <section className={styles.infoHero}>
          <p className={styles.eyebrow}>{definition.eyebrow}</p>
          <h1>{definition.title}</h1>
          <p>{definition.lead}</p>
          <Link className={styles.textLink} href="/">← Back to the marketing page</Link>
        </section>

        <div className={styles.infoSections}>
          {definition.sections.map((section) => (
            <section className={styles.infoSection} key={section.title}>
              <h2>{section.title}</h2>
              <p>{section.body}</p>
              {section.points ? (
                <ul>
                  {section.points.map((point) => <li key={point}>{point}</li>)}
                </ul>
              ) : null}
            </section>
          ))}
        </div>

        {definition.cta ? (
          <section className={styles.compactCta}>
            <div>
              <p className={styles.eyebrow}>Next step</p>
              <h2>{definition.cta.title}</h2>
              <p>{definition.cta.body}</p>
            </div>
            <ConversionLink className={styles.primaryButton} href={definition.cta.primaryHref}>
              {definition.cta.primaryLabel}
            </ConversionLink>
          </section>
        ) : null}
      </main>
      <MarketingFooter />
    </div>
  );
}
