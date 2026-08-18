"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  authContextSearchParams,
  parseAuthEntryContext,
} from "@/lib/acquisition/auth-entry";
import {
  type AuthEntryResolvedNode,
  authEntryNodeHref,
  resolveAuthEntryDestination,
} from "@/lib/acquisition/auth-entry-navigation";
import styles from "./auth-entry-navigator.module.css";

const maturityLabels = {
  "connected-workflow": "Connected workflow",
  "connected-api-boundary": "Connected API boundary",
  "identity-service-owned": "Identity service owned",
  "production-pending": "Production service pending",
} as const;

export function AuthEntryNavigator({ resolved }: { resolved: AuthEntryResolvedNode }) {
  const searchParams = useSearchParams();
  const context = parseAuthEntryContext(Object.fromEntries(searchParams.entries()));
  const contextQuery = authContextSearchParams(context).toString();
  const { node, path, breadcrumbs } = resolved;
  const destination = resolveAuthEntryDestination(node, context);
  const parentPath = path.slice(0, -1);

  return (
    <main className={styles.shell}>
      <section className={styles.surface} aria-labelledby="auth-entry-title">
        <div className={styles.brandRow}>
          <Link href="/" className={styles.brand}>RFxchange</Link>
          <span>Public / Acquisition</span>
        </div>

        <nav className={styles.breadcrumbs} aria-label="Login and registration workflow location">
          {breadcrumbs.map((crumb, index) => (
            <span key={`${crumb.label}-${crumb.path.join("/")}`}>
              {index > 0 ? <span aria-hidden="true">›</span> : null}
              {index === breadcrumbs.length - 1 ? (
                <strong aria-current="page">{crumb.label}</strong>
              ) : (
                <Link href={authEntryNodeHref(crumb.path, contextQuery)}>{crumb.label}</Link>
              )}
            </span>
          ))}
        </nav>

        <div className={styles.headingRow}>
          <div>
            <p className={styles.eyebrow}>{node.source}</p>
            <h1 id="auth-entry-title">{node.label}</h1>
            <p className={styles.summary}>{node.summary}</p>
          </div>
          <span className={styles.kind}>{node.kind}</span>
        </div>

        {node.sourceDetail ? <p className={styles.sourceDetail}>{node.sourceDetail}</p> : null}

        {node.destination ? (
          <section className={styles.ownerCard} aria-label="Owning workflow">
            <div>
              <span>Owning workflow</span>
              <strong>{node.destination.owner}</strong>
              {node.destination.service ? <code>{node.destination.service}</code> : null}
            </div>
            <span className={`${styles.maturity} ${styles[node.destination.maturity]}`}>
              {maturityLabels[node.destination.maturity]}
            </span>
          </section>
        ) : null}

        {node.children?.length ? (
          <section className={styles.children} aria-labelledby="child-workflows-title">
            <div className={styles.sectionHeading}>
              <p className={styles.eyebrow}>Child workflows</p>
              <h2 id="child-workflows-title">Continue through this branch</h2>
            </div>
            <div className={styles.childGrid}>
              {node.children.map((child) => (
                <Link
                  className={styles.childCard}
                  href={authEntryNodeHref([...path, child.id], contextQuery)}
                  key={child.id}
                >
                  <div>
                    <span className={styles.childKind}>{child.kind}</span>
                    <h3>{child.label}</h3>
                    <p>{child.summary}</p>
                  </div>
                  <span className={styles.arrow} aria-hidden="true">→</span>
                </Link>
              ))}
            </div>
          </section>
        ) : (
          <section className={styles.leafNote}>
            <strong>End of this source-defined branch.</strong>
            <p>No additional child workflow is added here because the source does not define one.</p>
          </section>
        )}

        <div className={styles.actions}>
          {destination ? (
            <Link className="button button-primary" href={destination}>
              {node.destination?.label ?? "Continue"}
            </Link>
          ) : null}
          {path.length ? (
            <Link className="button button-secondary" href={authEntryNodeHref(parentPath, contextQuery)}>
              Parent workflow
            </Link>
          ) : null}
          <Link className={styles.textLink} href="/">Return to public RFxchange</Link>
        </div>

        {node.destination?.maturity === "production-pending" ? (
          <p className={styles.boundary}>
            This source branch is represented and routed to its owning RFxchange boundary, but TestRFx does not currently contain the production service required to execute it. The entry layer does not simulate success.
          </p>
        ) : null}
      </section>
    </main>
  );
}
