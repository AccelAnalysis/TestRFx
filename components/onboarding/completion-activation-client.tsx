"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ExchangeActivation, ExchangeReadinessSnapshot } from "@/lib/onboarding/readiness";
import styles from "./completion-transition.module.css";

export function CompletionActivationClient({ readiness, returnTo }: { readiness: ExchangeReadinessSnapshot; returnTo: string }) {
  const router = useRouter();
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState("");

  async function activate() {
    setActivating(true);
    setError("");
    try {
      const response = await fetch("/api/onboarding/readiness/activate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ returnTo }),
      });
      const payload = (await response.json()) as { error?: string; activation?: ExchangeActivation };
      if (!response.ok || !payload.activation) {
        setError(payload.error ?? "Exchange activation could not be completed.");
        return;
      }
      router.push(payload.activation.successPath);
    } catch {
      setError("Exchange activation could not be completed. Review readiness and try again.");
    } finally {
      setActivating(false);
    }
  }

  return (
    <div className={styles.activationAction}>
      <button type="button" onClick={() => void activate()} disabled={activating || !readiness.exchangeAccessAllowed}>
        {activating ? "Activating Exchange presence…" : "Activate and continue"}
      </button>
      {error ? <p role="alert">{error}</p> : null}
    </div>
  );
}
