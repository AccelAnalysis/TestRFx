import Link from "next/link";
import { Suspense } from "react";
import { MembershipCheckoutCompletion } from "@/components/membership/MembershipCheckoutCompletion";

export default function MembershipCompletePage() {
  return (
    <main className="identity-shell onboarding-shell">
      <section className="identity-card onboarding-card">
        <p className="eyebrow">Membership payment</p>
        <h1>Confirming Founding Membership</h1>
        <p className="muted">
          RFxchange confirms the returned Checkout Session directly with Stripe. Organization membership entitlement is not unlocked from the browser redirect alone; signed Stripe webhook events finalize the membership state.
        </p>
        <Suspense fallback={<p className="muted">Preparing checkout confirmation…</p>}>
          <MembershipCheckoutCompletion />
        </Suspense>
        <p className="identity-footer"><Link href="/onboarding/membership?membership=founding">Return to membership</Link></p>
      </section>
    </main>
  );
}
