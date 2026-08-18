import Link from "next/link";
import { ConversionLink } from "./acquisition-context";
import { marketingFooterGroups } from "@/lib/marketing/navigation";
import styles from "./marketing.module.css";

export function MarketingFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerLead}>
        <Link className={styles.brand} href="/" aria-label="RFxchange home">
          <span className={styles.brandMark}>RF</span>
          <span>RFxchange</span>
        </Link>
        <p>One business-to-business Exchange for demand, resources, intelligence, and capability.</p>
      </div>

      <div className={styles.footerGrid}>
        {marketingFooterGroups.map((group) => (
          <section className={styles.footerGroup} key={group.label}>
            <h2>{group.label}</h2>
            <nav aria-label={`${group.label} footer links`}>
              {group.links.map((link) =>
                "conversion" in link && link.conversion ? (
                  <ConversionLink key={link.href} href={link.href}>{link.label}</ConversionLink>
                ) : (
                  <Link key={link.href} href={link.href}>{link.label}</Link>
                ),
              )}
            </nav>
          </section>
        ))}
      </div>

      <div className={styles.footerBottom}>
        <span>RFxchange reference marketing shell</span>
        <span>Public / Acquisition → Identity → Exchange</span>
      </div>
    </footer>
  );
}
