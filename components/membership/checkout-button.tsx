"use client";

import { useState } from "react";
import type { MembershipPlanCode } from "@/lib/membership/contracts";
import styles from "@/app/onboarding/membership/membership.module.css";

export function CheckoutButton({ planCode, disabled = false }: { planCode: MembershipPlanCode; disabled?: boolean }) {
  const [state, setState] = useState<"idle" | "working" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function startCheckout() {
    setState("working");
    setMessage(null);
    try {
      const response = await fetch("/api/membership/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planCode }),
      });
      const body = (await response.json()) as { url?: string; message?: string };
      if (!response.ok || !body.url) {
        throw new Error(body.message ?? "Secure checkout could not be started.");
      }
      window.location.assign(body.url);
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Secure checkout could not be started.");
    }
  }

  return (
    <div className={styles.checkoutAction}>
      <button
        className={styles.checkoutButton}
        type="button"
        onClick={startCheckout}
        disabled={disabled || state === "working"}
      >
        {state === "working" ? "Opening secure checkout…" : "Continue to secure checkout"}
      </button>
      {message ? <p className={styles.checkoutError} role="alert">{message}</p> : null}
    </div>
  );
}
