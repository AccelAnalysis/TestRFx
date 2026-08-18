import Link from "next/link";
import type { ReactNode } from "react";
import "./resources.css";

export default function PublicResourcesLayout({ children }: { children: ReactNode }) {
  return (
    <div className="public-shell resource-public-shell">
      <nav className="public-nav resource-public-nav" aria-label="Public navigation">
        <Link className="resource-brand" href="/">RFxchange</Link>
        <div className="resource-nav-links" aria-label="Public sections">
          <Link href="/">Home</Link>
          <Link href="/resources">Resources</Link>
        </div>
        <div className="public-nav-actions">
          <Link href="/login">Log in</Link>
          <Link className="button button-primary" href="/register">Join the Exchange</Link>
        </div>
      </nav>

      {children}

      <footer className="resource-footer">
        <div>
          <strong>RFxchange</strong>
          <p>Public knowledge and education that prepares users to enter one shared Exchange operating environment.</p>
        </div>
        <nav aria-label="Resource footer">
          <Link href="/resources">Resources hub</Link>
          <Link href="/register">Create account</Link>
          <Link href="/login">Log in</Link>
          <Link href="/exchange/rfx">Reference Exchange</Link>
        </nav>
      </footer>
    </div>
  );
}
