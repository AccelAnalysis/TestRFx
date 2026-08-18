import Link from "next/link";
import { ConversionLink } from "@/components/marketing/acquisition-context";
import {
  PUBLIC_DESTINATIONS,
  PUBLIC_FOOTER_GROUPS,
  type PublicDestinationId,
} from "@/lib/public/destinations";
import styles from "./public-shell.module.css";

export function PublicFooter({
  joinHref = PUBLIC_DESTINATIONS.join.href,
  signInHref = PUBLIC_DESTINATIONS.signIn.href,
}: {
  joinHref?: string;
  signInHref?: string;
} = {}) {
  const destinationHref = (destinationId: PublicDestinationId) => {
    if (destinationId === "join") return joinHref;
    if (destinationId === "signIn") return signInHref;
    return PUBLIC_DESTINATIONS[destinationId].href;
  };

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
                  const href = destinationHref(destinationId);
                  return destinationId === "join" || destinationId === "signIn" ? (
                    <ConversionLink href={href} key={destinationId}>
                      {destination.label}
                    </ConversionLink>
                  ) : (
                    <Link href={href} key={destinationId}>
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
