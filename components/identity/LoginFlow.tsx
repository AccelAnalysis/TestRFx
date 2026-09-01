"use client";

import { ChangeEvent, FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import type { LoginApiError, MagicLinkChallengeAccepted } from "@/lib/identity/contracts";
import { maskEmail } from "@/lib/identity/login";
import styles from "./login.module.css";

type FlowState = "idle" | "submitting" | "sent" | "error" | "not_found" | "restricted";

interface LoginFlowProps {
  initialReturnTo: string;
  registrationHref?: string;
}

export function LoginFlow({ initialReturnTo, registrationHref = "/register" }: LoginFlowProps) {
  const [email, setEmail] = useState("");
  const [flowState, setFlowState] = useState<FlowState>("idle");
  const [message, setMessage] = useState("");
  const [expiresInSeconds, setExpiresInSeconds] = useState(15 * 60);

  const maskedEmail = useMemo(() => maskEmail(email), [email]);
  const isPagesPreview = process.env.NEXT_PUBLIC_RFXCHANGE_PAGES_PREVIEW === "1";

  function resetEmail() {
    setFlowState("idle");
    setMessage("");
  }

  if (isPagesPreview) {
    return (
      <section className={styles.statusPanel} aria-live="polite">
        <div className={styles.statusIcon} aria-hidden="true">↗</div>
        <h2>TestRFx preview access</h2>
        <p>
          Open the Exchange directly for testing. This preview does not create an account, establish an authenticated session,
          purchase a membership, or write onboarding progress.
        </p>
        <Link className={styles.primaryButton} href={initialReturnTo || "/exchange/rfx"}>
          Enter TestRFx
        </Link>
        <p className={styles.securityNote}>
          Production sign-in and readiness checks remain unchanged. Use Registration separately when you want to review the onboarding experience itself.
        </p>
        <p className={styles.registerPrompt}>
          <Link href={registrationHref}>View registration and onboarding</Link>
        </p>
      </section>
    );
  }

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
        const errorPayload = "code" in payload ? payload : undefined;
        setMessage("error" in payload ? payload.error : "Unable to start secure sign-in.");
        if (errorPayload?.code === "account_not_found") {
          setFlowState("not_found");
          return;
        }
        if (errorPayload?.code === "account_restricted") {
          setFlowState("restricted");
          return;
        }
        setFlowState("error");
        return;
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

  if (flowState === "not_found") {
    return (
      <section className={styles.statusPanel} aria-live="polite">
        <div className={styles.statusIcon} aria-hidden="true">?</div>
        <h2>Email not found</h2>
        <p>{message || "No RFxchange account was found for that email."}</p>
        <Link className={styles.primaryButton} href={registrationHref}>
          Create an account
        </Link>
        <button className={styles.textButton} type="button" onClick={resetEmail}>
          Try a different email
        </button>
        <p className={styles.registerPrompt}><Link href="/">Return to RFxchange</Link></p>
      </section>
    );
  }

  if (flowState === "restricted") {
    return (
      <section className={styles.statusPanel} aria-live="polite">
        <div className={styles.statusIcon} aria-hidden="true">!</div>
        <h2>Account unavailable</h2>
        <p>{message || "This RFxchange account cannot sign in right now."}</p>
        <button className={styles.primaryButton} type="button" onClick={resetEmail}>
          Use a different email
        </button>
        <p className={styles.registerPrompt}><Link href="/">Return to RFxchange</Link></p>
      </section>
    );
  }

  if (flowState === "sent") {
    const minutes = Math.max(1, Math.round(expiresInSeconds / 60));

    return (
      <section className={styles.statusPanel} aria-live="polite">
        <div className={styles.statusIcon} aria-hidden="true">✉</div>
        <h2>Check your email</h2>
        <p>We sent a one-time sign-in link to <strong>{maskedEmail}</strong>.</p>
        <p className={styles.statusNote}>Magic links expire after about {minutes} minutes and should be single-use.</p>
        <button className={styles.primaryButton} type="button" onClick={requestMagicLink}>
          Resend sign-in link
        </button>
        <button className={styles.textButton} type="button" onClick={resetEmail}>
          Use a different email
        </button>
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

      {message ? (
        <p id="login-error" className={styles.error} role="alert">{message}</p>
      ) : null}

      <button className={styles.primaryButton} type="submit" disabled={flowState === "submitting" || !email.trim()}>
        {flowState === "submitting" ? "Sending secure link…" : "Continue"}
      </button>

      <div className={styles.formDivider}><span>Passwordless sign-in</span></div>
      <p className={styles.securityNote}>
        RFxchange uses a one-time sign-in challenge at this boundary. MFA, device trust, token validation, and session policy remain Identity-service responsibilities and are never simulated by this form.
      </p>
      <p className={styles.registerPrompt}>
        New to RFxchange? <Link href={registrationHref}>Create an account</Link>
      </p>
    </form>
  );
}
