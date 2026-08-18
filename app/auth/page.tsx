import { Suspense } from "react";
import { AuthEntryNavigator } from "@/components/public/AuthEntryNavigator";
import { findAuthEntryNode } from "@/lib/acquisition/auth-entry-navigation";

export default function AuthEntryPage() {
  const resolved = findAuthEntryNode([]);
  if (!resolved) return null;

  return (
    <Suspense
      fallback={
        <main className="identity-shell">
          <section className="identity-card">
            <p className="eyebrow">RFxchange access</p>
            <h1>Loading entry workflow…</h1>
          </section>
        </main>
      }
    >
      <AuthEntryNavigator resolved={resolved} />
    </Suspense>
  );
}
