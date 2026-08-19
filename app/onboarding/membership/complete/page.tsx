import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { MembershipWorkflowNav } from "@/components/membership/membership-workflow-nav";
import { MEMBERSHIP_CONTEXT_COOKIE, readMembershipContext } from "@/lib/membership/context";
import { verifyCheckoutReturn } from "@/lib/membership/service";
import styles from "../membership.module.css";

export const metadata: Metadata = { title: "Registration Complete | RFxchange" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function MembershipCompletePage({ searchParams }: { searchParams: SearchParams }) {
  const query = await searchParams;
  const sessionIdValue = query.session_id;
  const sessionId = Array.isArray(sessionIdValue) ? sessionIdValue[0] : sessionIdValue;

  let result: Awaited<ReturnType<typeof verifyCheckoutReturn>> | null = null;
  let errorMessage: string | null = null;
  if (!sessionId) {
    errorMessage = "A verified Stripe Checkout session is required to confirm paid membership.";
  } else {
    try {
      const cookieStore = await cookies();
      const token = cookieStore.get(MEMBERSHIP_CONTEXT_COOKIE)?.value;
      const actor = readMembershipContext(token ? `${MEMBERSHIP_CONTEXT_COOKIE}=${token}` : null);
      result = await verifyCheckoutReturn(actor, sessionId);
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : "RFxchange could not verify this checkout session.";
    }
  }

  const active = result?.membership?.status === "active" && result.paymentStatus === "paid";

  return (
    <main className="identity-shell onboarding-shell">
      <section className="identity-card onboarding-card">
        <MembershipWorkflowNav currentStage="registration-complete" />
        <p className="eyebrow">11. Registration Complete</p>
        <h1>{active ? "Payment confirmed" : "Completion is still pending"}</h1>
        <p className="muted">
          {active
            ? "Stripe confirms payment and RFxchange has reconciled the organization's Founding Membership. The broader account, organization, geography, and Exchange-readiness checks continue in the owning completion workflow."
            : errorMessage ?? "RFxchange is waiting for a verified paid membership state."}
        </p>

        <div className={styles.completionList}>
          <div><strong>Account activated</strong><span>Confirmed by the Identity / Exchange-ready workflow, not inferred from payment.</span></div>
          <div><strong>Organization profile created</strong><span>Confirmed by the organization onboarding workflow.</span></div>
          <div><strong>Dashboard / Exchange access</strong><span>Granted only after Exchange-ready completion passes.</span></div>
          <div><strong>Welcome / Onboarding tips</strong><span>Presented after readiness is complete.</span></div>
        </div>

        {active ? (
          <Link className="button button-primary button-full" href="/onboarding/completion">Continue to Exchange-ready completion</Link>
        ) : (
          <>
            <div className={styles.integrationNote}><strong>No access was fabricated.</strong> A missing, mismatched, unpaid, or unreconciled Stripe session does not unlock the Exchange.</div>
            <Link className="button button-secondary button-full" href="/onboarding/membership/payment?membership=founding">Return to Payment</Link>
          </>
        )}
      </section>
    </main>
  );
}
