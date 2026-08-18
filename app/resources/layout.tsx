import Link from "next/link";
import type { ReactNode } from "react";
import "./resources.css";
import "./hierarchy.css";

export default function PublicResourcesLayout({ children }: { children: ReactNode }) {
  return (
    <div className="public-shell resource-public-shell">
      <nav className="public-nav resource-public-nav" aria-label="Public navigation">
        <Link className="resource-brand" href="/">RFxchange</Link>
        <div className="resource-nav-links" aria-label="Public resource sections">
          <Link href="/resources">Resources</Link>
          <Link href="/resources/learn">Learn</Link>
          <Link href="/resources/templates">Templates</Link>
          <Link href="/resources/insights">Insights</Link>
          <Link href="/resources/reference">Reference</Link>
        </div>
        <div className="public-nav-actions">
          <Link href="/login">Log in</Link>
          <Link className="button button-primary" href="/register?source=resources">Join the Exchange</Link>
        </div>
      </nav>

      {children}

      <footer className="resource-footer">
        <div>
          <strong>RFxchange</strong>
          <p>Public knowledge and preparation that hands authenticated work into one shared Exchange operating environment.</p>
        </div>
        <nav aria-label="Resource footer">
          <Link href="/resources">Resources Hub</Link>
          <Link href="/resources/learn">Learn / Guides</Link>
          <Link href="/resources/templates">Templates / Tools</Link>
          <Link href="/resources/insights">Insights / Research</Link>
          <Link href="/resources/stories">Stories / Examples</Link>
          <Link href="/resources/reference">Reference</Link>
          <Link href="/resources/events">Events / Learning</Link>
          <Link href="/resources/audiences">Audience paths</Link>
          <Link href="/login">Log in</Link>
        </nav>
      </footer>
    </div>
  );
}
