import Link from "next/link";
import { ConversionLink } from "@/components/marketing/acquisition-context";
import {
  PUBLIC_DESTINATIONS,
  PUBLIC_HEADER_DESTINATIONS,
} from "@/lib/public/destinations";
import styles from "./public-shell.module.css";

export function PublicHeader() {
  return (
    <header className={styles.chrome}>
      <div className={styles.header}>
        <Link className={styles.brand} href="/" aria-label="RFxchange home">
          RFxchange
        </Link>
        <nav className={styles.primaryNav} aria-label="Public navigation">
          {PUBLIC_HEADER_DESTINATIONS.map((destinationId) => {
            const destination = PUBLIC_DESTINATIONS[destinationId];
            const label = "headerLabel" in destination ? destination.headerLabel : destination.label;
            return (
              <Link href={destination.href} key={destinationId}>
                {label}
              </Link>
            );
          })}
        </nav>
        <div className={styles.headerActions}>
          <ConversionLink className={styles.textAction} href={PUBLIC_DESTINATIONS.signIn.href}>
            Sign In
          </ConversionLink>
          <ConversionLink className={styles.primaryAction} href={PUBLIC_DESTINATIONS.join.href}>
            Join Free
          </ConversionLink>
        </div>
      </div>
    </header>
  );
}
