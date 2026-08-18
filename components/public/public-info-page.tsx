import Link from "next/link";
import { AcquisitionContextCapture } from "@/components/marketing/acquisition-context";
import {
  PUBLIC_ASSET_POLICY,
  PUBLIC_IMAGE_ASSET_LIST,
} from "@/lib/public/assets";
import {
  PUBLIC_DESTINATIONS,
  PUBLIC_FOOTER_GROUPS,
} from "@/lib/public/destinations";
import type { PublicInfoPageDefinition } from "@/lib/public/pages";
import { PublicFooter } from "./public-footer";
import { PublicHeader } from "./public-header";
import { PublicHierarchyNav } from "./public-hierarchy-nav";
import styles from "./public-shell.module.css";

function footerGroupFor(page: PublicInfoPageDefinition) {
  return PUBLIC_FOOTER_GROUPS.find((group) =>
    group.destinationIds.includes(
      page.destinationId as (typeof group.destinationIds)[number],
    ),
  );
}

export function PublicInfoPage({ page }: { page: PublicInfoPageDefinition }) {
  const destination = PUBLIC_DESTINATIONS[page.destinationId];
  const group = footerGroupFor(page);

  return (
    <div className={styles.pageShell}>
      <AcquisitionContextCapture />
      <PublicHeader />
      <main className={styles.main}>
        <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
          <Link href="/">Public / Acquisition</Link>
          {group ? <span aria-hidden="true">›</span> : null}
          {group ? <span>{group.label}</span> : null}
          <span aria-hidden="true">›</span>
          <span aria-current="page">{destination.label}</span>
        </nav>

        <header className={styles.masthead}>
          <p className={styles.eyebrow}>{page.eyebrow}</p>
          <h1>{page.title}</h1>
          {page.policy ? (
            <div className={styles.policyMeta} aria-label="Policy publication">
              <span>Version {page.policy.version}</span>
              <span>Effective {page.policy.effectiveDate}</span>
            </div>
          ) : null}
          <p className={styles.intro}>{page.intro}</p>
        </header>

        <div className={styles.contentGrid}>
          <div className={styles.sections}>
            {page.sections.map((section) => (
              <section className={styles.section} id={section.id} key={section.id}>
                <h2>{section.heading}</h2>
                {section.paragraphs?.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
                {section.bullets ? (
                  <ul>
                    {section.bullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ))}

            {page.assetRegistry === "public-images" ? (
              <section className={styles.assetRegistry} aria-labelledby="asset-register-title">
                <div className={styles.assetRegistryHeading}>
                  <p className={styles.eyebrow}>Governed photography register</p>
                  <h2 id="asset-register-title">Current public image sources</h2>
                </div>
                <div className={styles.assetGrid}>
                  {PUBLIC_IMAGE_ASSET_LIST.map((asset) => (
                    <article className={styles.assetCard} key={asset.id}>
                      <img src={asset.src} alt={asset.alt} loading="lazy" />
                      <div>
                        <h3>{asset.alt}</h3>
                        <p>{asset.creditLabel}</p>
                        <p>Use: atmosphere only—not product evidence.</p>
                        <a href={asset.sourceUrl} target="_blank" rel="noreferrer">
                          View source
                        </a>
                      </div>
                    </article>
                  ))}
                </div>
                <p className={styles.assetReviewNote}>
                  Final commercial rights and licensing review: <strong>{PUBLIC_ASSET_POLICY.finalCommercialLicenseReviewRequired ? "required" : "not required"}</strong>.
                </p>
              </section>
            ) : null}

            {page.policy ? (
              <aside className={styles.policyRecord}>
                <strong>Policy record</strong>
                <p>
                  RFxchange may retain version and acknowledgement history for auditability. Material changes may require renewed acceptance or acknowledgement.
                </p>
              </aside>
            ) : null}
          </div>

          <aside className={styles.aside} aria-label="Public page navigation">
            <PublicHierarchyNav />
            <div className={styles.asideCard}>
              <h2>Related destinations</h2>
              <div className={styles.relatedGrid}>
                {page.relatedDestinationIds.map((destinationId) => {
                  const related = PUBLIC_DESTINATIONS[destinationId];
                  return (
                    <Link href={related.href} key={destinationId}>
                      {related.label}
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
