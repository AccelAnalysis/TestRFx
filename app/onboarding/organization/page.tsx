import { Suspense } from "react";
import OrganizationSelectionRoute from "./OrganizationSelectionRoute";

export default function OrganizationSelectionPage() {
  return (
    <Suspense fallback={<main className="identity-shell"><section className="identity-card"><p className="eyebrow">Organization setup</p><h1>Loading organization workflow…</h1></section></main>}>
      <OrganizationSelectionRoute />
    </Suspense>
  );
}
