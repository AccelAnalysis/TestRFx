"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { OrganizationMediaEditor } from "./organization-media-editor";
import styles from "./organization-media-profile-page.module.css";

type MediaRouteContext = {
  organizationId?: string;
  organizationName?: string;
  returnTo?: string;
};

export function OrganizationMediaProfilePage() {
  const [context, setContext] = useState<MediaRouteContext | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setContext({
      organizationId: params.get("organization")?.trim() || undefined,
      organizationName: params.get("name")?.trim() || undefined,
      returnTo: params.get("returnTo")?.trim() || undefined,
    });
  }, []);

  const backParams = new URLSearchParams();
  if (context?.organizationId) backParams.set("organization", context.organizationId);
  if (context?.returnTo) backParams.set("returnTo", context.returnTo);
  const backHref = `/onboarding/organization-profile/organization-details${backParams.size ? `?${backParams.toString()}` : ""}`;

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <Link href={backHref} aria-label="Back to Organization Details">‹</Link>
        <h1>Logo & Media</h1>
        <span aria-hidden />
      </header>
      <section className={styles.content}>
        {!context ? null : !context.organizationId ? (
          <div className={styles.empty}>
            <h2>Choose an organization first</h2>
            <Link href="/onboarding/organization">Continue</Link>
          </div>
        ) : (
          <OrganizationMediaEditor organizationId={context.organizationId} organizationName={context.organizationName} />
        )}
      </section>
    </main>
  );
}
