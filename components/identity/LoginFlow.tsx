"use client";

import { ChangeEvent, FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import type { LoginApiError, MagicLinkChallengeAccepted } from "@/lib/identity/contracts";
import { maskEmail } from "@/lib/identity/login";
import styles from "./login.module.css";

type FlowState = "idle" | "submitting" | "sent" | "error";

interface LoginFlowProps {
  initialReturnTo: string;
}

export function LoginFlow({ initialReturnTo }: LoginFlowProps) {
  const [email, setEmail] = useState("");
  const [flowState, setFlowState] = useState<FlowState>("idle");
  const [message, setMessage] = useState("");
  const [expiresInSeconds, setExpiresInSeconds] = useState(15 * 60);

  const maskedEmail = useMemo(() => maskEmail(email), [email]);

  async function requestMagicLink() {
    setFlowState("submitting");
    setMessage("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, returnTo: initialReturnTo }),
      });

      const payload = (await response.json()) as MagicLinkChallengeAccepted | LoginApiError;
      if (!response.ok || !("status" in payload)) {
        throw new Error("error" in payload ? payload.error : "Unable to start secure sign-in.");
      }

      setExpiresInSeconds(payload.expiresInSeconds);
      setFlowState("sent");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to start secure sign-in.");
      setFlowState("error");
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await requestMagicLink();
  }

  if (flowState === "sent") {
    const minutes = Math.max(1, Math.round(expiresInSeconds / 60));

    return (
      <section className={styles.statusPanel} aria-live="polite">
        <div className={styles.statusIcon} aria-hidden="true">✉</div>
        <h2>Check your email</h2>
        <p>We sent a one-time sign-in link to <strong>{maskedEmail}</strong>.</p>
        <p className={styles.statusNote}>Magic links expire after about {minutes} minutes and are single-use.</p>
        <button className={styles.primaryButton} type="button" onClick={requestMagicLink}>Resend sign-in link</button>
        <button className={styles.textButton} type="button" onClick={() => { setFlowState("idle"); setMessage(""); }}>Use a different email</button>
      </section>
    );
  }

  return (
    <form className={styles.form} onSubmit={onSubmit} noValidate>
      <label className={styles.field} htmlFor="login-email">
        <span>Work email</span>
        <input
          id="login-email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@company.com"
          value={email}
          onChange={(event: ChangeEvent<HTMLInputElement>) => setEmail(event.target.value)}
          disabled={flowState === "submitting"}
          required
          aria-describedby={message ? "login-error" : undefined}
        />
      </label>

      {message ? <p id="login-error" className={styles.error} role="alert">{message}</p> : null}

      <button className={styles.primaryButton} type="submit" disabled={flowState === "submitting" || !email.trim()}>
        {flowState === "submitting" ? "Sending secure link…" : "Continue"}
      </button>

      <div className={styles.formDivider}><span>Passwordless sign-in</span></div>
      <p className={styles.securityNote}>RFxchange uses a single-use sign-in challenge. The authenticated session established by that challenge is the same session used by the Exchange and its server-authorized workflows.</p>
      <p className={styles.registerPrompt}>New to RFxchange? <Link href="/register">Create an account</Link></p>
    </form>
  );
}
