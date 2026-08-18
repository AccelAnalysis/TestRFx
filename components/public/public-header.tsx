import Link from "next/link";
import {
  PUBLIC_DESTINATIONS,
  PUBLIC_HEADER_DESTINATIONS,
} from "@/lib/public/destinations";
import styles from "./public-shell.module.css";

export function PublicHeader({
  joinHref = PUBLIC_DESTINATIONS.join.href,
  signInHref = PUBLIC_DESTINATIONS.signIn.href,
}: {
  joinHref?: string;
  signInHref?: string;
} = {}) {
  return (
    <header className={styles.chrome}>
      <div className={styles.header}>
        <Link className={styles.brand} href="/" aria-label="RFxchange home">
          RFxchange
        </Link>
        <nav className={styles.primaryNav} aria-label="Public navigation">
          {PUBLIC_HEADER_DESTINATIONS.map((destinationId) => {
            const destination = PUBLIC_DESTINATIONS[destinationId];
            return (
              <Link href={destination.href} key={destinationId}>
                {destination.label}
              </Link>
            );
          })}
        </nav>
        <div className={styles.headerActions}>
          <Link className={styles.textAction} href={signInHref}>
            Sign In
          </Link>
          <Link className={styles.primaryAction} href={joinHref}>
            Join Free
          </Link>
        </div>
      </div>
    </header>
  );
}
