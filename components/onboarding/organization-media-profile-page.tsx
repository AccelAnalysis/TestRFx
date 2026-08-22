"use client";

import Link from "next/link";
import { OrganizationMediaEditor } from "./organization-media-editor";
import styles from "./organization-media-profile-page.module.css";

export function OrganizationMediaProfilePage({
  organizationId,
  organizationName = "Organization",
  returnTo,
}: {
  organizationId?: string;
  organizationName?: string;
  returnTo?: string;
}) {
  const params = new URLSearchParams();
  if (organizationId) params.set("organization", organizationId);
  if (returnTo) params.set("returnTo", returnTo);
  const backHref = `/onboarding/organization-profile/organization-details${params.size ? `?${params.toString()}` : ""}`;

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <Link href={backHref} aria-label="Back to Organization Details">‹</Link>
        <h1>Logo & Media</h1>
        <span aria-hidden />
      </header>
      <section className={styles.content}>
        {!organizationId ? (
          <div className={styles.empty}>
            <h2>Choose an organization first</h2>
            <Link href="/onboarding/organization">Continue</Link>
          </div>
        ) : (
          <OrganizationMediaEditor organizationId={organizationId} organizationName={organizationName} />
        )}
      </section>
    </main>
  );
}
