"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "@/app/onboarding/membership/membership.module.css";

type ConfirmationState = "checking" | "confirmed" | "pending" | "error";

type ConfirmationResponse = {
  state?: "confirmed" | "pending";
  message?: string;
  nextPath?: string;
  error?: string;
};

export function MembershipCheckoutCompletion() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id")?.trim() ?? "";
  const started = useRef(false);
  const [state, setState] = useState<ConfirmationState>(sessionId ? "checking" : "error");
  const [message, setMessage] = useState(
    sessionId ? "Confirming your Stripe Checkout Session…" : "Checkout Session ID is missing.",
  );
  const [nextPath, setNextPath] = useState("/onboarding/completion");

  useEffect(() => {
    if (!sessionId || started.current) return;
    started.current = true;

    async function confirm() {
      try {
        const response = await fetch("/api/membership/checkout/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
        const payload = (await response.json()) as ConfirmationResponse;
        if (!response.ok && payload.state !== "pending") {
          setState("error");
          setMessage(payload.error || "RFxchange could not confirm this checkout.");
          return;
        }
        if (payload.state === "pending") {
          setState("pending");
          setMessage(payload.message || "Stripe is still confirming this checkout.");
          return;
        }
        if (payload.state === "confirmed") {
          setState("confirmed");
          setMessage(payload.message || "Stripe confirmed the checkout.");
          setNextPath(payload.nextPath || "/onboarding/completion");
          return;
        }
        setState("error");
        setMessage("RFxchange received an unexpected checkout confirmation response.");
      } catch {
        setState("error");
        setMessage("RFxchange could not confirm this checkout right now.");
      }
    }

    void confirm();
  }, [sessionId]);

  if (state === "checking") {
    return <p className={styles.checkoutStatus}>{message}</p>;
  }

  if (state === "confirmed") {
    return (
      <div className={styles.checkoutConfirmation}>
        <strong>Payment confirmed by Stripe</strong>
        <p>{message}</p>
        <button className={styles.checkoutButton} type="button" onClick={() => router.push(nextPath)}>
          Continue to Exchange readiness
        </button>
      </div>
    );
  }

  if (state === "pending") {
    return (
      <div className={styles.checkoutConfirmation}>
        <strong>Payment confirmation pending</strong>
        <p>{message}</p>
        <Link href="/onboarding/membership?membership=founding">Return to membership</Link>
      </div>
    );
  }

  return (
    <div className={styles.checkoutConfirmation}>
      <strong>Unable to confirm checkout</strong>
      <p>{message}</p>
      <Link href="/onboarding/membership?membership=founding">Return to membership</Link>
    </div>
  );
}
