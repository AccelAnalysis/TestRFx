"use client";

import { useState } from "react";
import styles from "@/app/onboarding/membership/membership.module.css";

type CheckoutResponse = {
  url?: string;
  error?: string;
  nextPath?: string;
};

export function MembershipCheckoutButton() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function startCheckout() {
    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/membership/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "founding" }),
      });
      const payload = (await response.json()) as CheckoutResponse;

      if (!response.ok) {
        if (payload.nextPath) {
          window.location.assign(payload.nextPath);
          return;
        }
        setError(payload.error || "Secure checkout is unavailable.");
        return;
      }

      if (!payload.url) {
        setError("Stripe did not return a Checkout URL.");
        return;
      }

      window.location.assign(payload.url);
    } catch {
      setError("Secure checkout is temporarily unavailable. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <button className={styles.checkoutButton} type="button" onClick={startCheckout} disabled={submitting}>
        {submitting ? "Opening secure checkout…" : "Continue to secure Stripe checkout"}
      </button>
      {error ? <p className={styles.checkoutError} role="alert">{error}</p> : null}
    </div>
  );
}
