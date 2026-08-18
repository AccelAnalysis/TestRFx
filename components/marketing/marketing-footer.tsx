import Link from "next/link";
import { ConversionLink } from "./acquisition-context";
import {
  PUBLIC_DESTINATIONS,
  PUBLIC_FOOTER_GROUPS,
} from "@/lib/public/destinations";
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
        {PUBLIC_FOOTER_GROUPS.map((group) => (
          <section className={styles.footerGroup} key={group.id}>
            <h2>{group.label}</h2>
            <nav aria-label={`${group.label} footer links`}>
              {group.destinationIds.map((destinationId) => {
                const destination = PUBLIC_DESTINATIONS[destinationId];
                return destination.kind === "identity-entry" ? (
                  <ConversionLink key={destinationId} href={destination.href}>
                    {destination.label}
                  </ConversionLink>
                ) : (
                  <Link key={destinationId} href={destination.href}>
                    {destination.label}
                  </Link>
                );
              })}
            </nav>
          </section>
        ))}
      </div>

      <div className={styles.footerBottom}>
        <span>RFxchange public acquisition shell</span>
        <span>Public / Acquisition → Identity → Exchange</span>
      </div>
    </footer>
  );
}
