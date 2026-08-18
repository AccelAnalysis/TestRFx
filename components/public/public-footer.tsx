import Link from "next/link";
import {
  PUBLIC_DESTINATIONS,
  PUBLIC_FOOTER_GROUPS,
} from "@/lib/public/destinations";
import styles from "./public-shell.module.css";

export function PublicFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerLead}>
        <div className={styles.footerBrand}>
          <strong>RFxchange</strong>
          <p>
            One Exchange for opportunity, resources, intelligence, capabilities, and the
            organization relationships that connect them.
          </p>
        </div>
        <div className={styles.footerGrid}>
          {PUBLIC_FOOTER_GROUPS.map((group) => (
            <section className={styles.footerGroup} key={group.label}>
              <h2>{group.label}</h2>
              <nav aria-label={`${group.label} footer links`}>
                {group.destinationIds.map((destinationId) => {
                  const destination = PUBLIC_DESTINATIONS[destinationId];
                  return (
                    <Link href={destination.href} key={destinationId}>
                      {destination.label}
                    </Link>
                  );
                })}
              </nav>
            </section>
          ))}
        </div>
      </div>
      <div className={styles.footerBottom}>
        <span>© {new Date().getFullYear()} RFxchange</span>
        <span>Public / Acquisition Shell</span>
      </div>
    </footer>
  );
}
