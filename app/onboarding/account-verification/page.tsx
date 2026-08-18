import { Suspense } from "react";
import { AccountVerificationPanel } from "@/components/identity/AccountVerificationPanel";

export default function AccountVerificationPage() {
  return (
    <main className="identity-shell">
      <Suspense
        fallback={
          <section className="identity-card">
            <p className="eyebrow">Account verification</p>
            <h1>Loading verification…</h1>
            <p className="muted">Preparing your account verification workflow.</p>
          </section>
        }
      >
        <AccountVerificationPanel activePath={[]} />
      </Suspense>
    </main>
  );
}
