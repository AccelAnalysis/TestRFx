import Link from "next/link";
import { AcquisitionContextCapture, ConversionLink } from "./acquisition-context";
import { marketingNavigation } from "@/lib/marketing/navigation";
import styles from "./marketing.module.css";

export function MarketingChrome() {
  return (
    <>
      <AcquisitionContextCapture />
      <aside className={styles.campaignBar} aria-label="Founding Membership campaign">
        <span><strong>Founding Organizations</strong> · $49/month · first 250 organizations</span>
        <Link href="/founding">See Founding Membership <span aria-hidden="true">→</span></Link>
      </aside>

      <header className={styles.marketingHeader}>
        <Link className={styles.brand} href="/" aria-label="RFxchange home">
          <span className={styles.brandMark}>RF</span>
          <span>RFxchange</span>
        </Link>

        <nav className={styles.desktopNav} aria-label="Primary marketing navigation">
          {marketingNavigation.map((item) => (
            <Link key={item.href} href={item.href}>{item.label}</Link>
          ))}
        </nav>

        <div className={styles.headerActions}>
          <ConversionLink className={styles.signInLink} href="/signin">Sign In</ConversionLink>
          <ConversionLink className={styles.primaryButton} href="/join">Join Free</ConversionLink>
        </div>

        <details className={styles.mobileMenu}>
          <summary aria-label="Open marketing navigation">Menu</summary>
          <nav aria-label="Mobile marketing navigation">
            {marketingNavigation.map((item) => (
              <Link key={item.href} href={item.href}>{item.label}</Link>
            ))}
            <ConversionLink href="/signin">Sign In</ConversionLink>
            <ConversionLink href="/join">Join Free</ConversionLink>
          </nav>
        </details>
      </header>
    </>
  );
}
