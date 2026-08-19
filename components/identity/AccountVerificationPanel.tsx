"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import {
  type AccountVerificationState,
  maskEmail,
  normalizeEmail,
} from "@/lib/identity/account-verification";
import type { RegistrationStatus } from "@/lib/identity/registration";
import styles from "./AccountVerificationPanel.module.css";

type ApiResponse = {
  state?: string;
  message?: string;
  maskedEmail?: string;
  email?: string;
  nextPath?: string;
  retryAfterSeconds?: number;
};

function responseState(value: string | undefined): AccountVerificationState {
  if (
    value === "pending" ||
    value === "verified" ||
    value === "expired" ||
    value === "invalid" ||
    value === "rate_limited" ||
    value === "delivery_error" ||
    value === "configuration_error"
  ) {
    return value;
  }
  return "invalid";
}

export function AccountVerificationPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const registrationId = searchParams.get("registration") ?? "";
  const mode = searchParams.get("mode") ?? "";
  const [email, setEmail] = useState("");
  const [maskedDestination, setMaskedDestination] = useState("");
  const [state, setState] = useState<AccountVerificationState>(token ? "verifying" : registrationId ? "requesting" : "idle");
  const [message, setMessage] = useState("");
  const [nextPath, setNextPath] = useState("/onboarding/organization");
  const [editingEmail, setEditingEmail] = useState(mode === "change-email");
  const statusLoaded = useRef(false);

  useEffect(() => {
    if (!registrationId || token || statusLoaded.current) return;
    statusLoaded.current = true;
    let cancelled = false;

    async function loadRegistration() {
      try {
        const response = await fetch(`/api/identity/registration/${encodeURIComponent(registrationId)}`, {
          cache: "no-store",
        });
        const data = (await response.json()) as RegistrationStatus | { error?: string };
        if (cancelled) return;
        if (!response.ok || !("state" in data)) {
          setState(response.status === 503 ? "configuration_error" : "invalid");
          setMessage("error" in data ? data.error ?? "Registration could not be loaded." : "Registration could not be loaded.");
          return;
        }

        setMaskedDestination(data.maskedEmail);
        if (data.state === "verified") {
          setState("verified");
          setNextPath("/onboarding/organization");
          return;
        }
        if (data.state !== "pending_verification") {
          setState("invalid");
          setMessage("This registration is not available for email verification.");
          return;
        }
        setState("pending");
        setEditingEmail(mode === "change-email");
      } catch {
        if (!cancelled) {
          setState("invalid");
          setMessage("We could not load this registration right now.");
        }
      }
    }

    void loadRegistration();
    return () => {
      cancelled = true;
    };
  }, [mode, registrationId, token]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    async function verifyToken() {
      setState("verifying");
      try {
        const response = await fetch("/api/identity/account-verification", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "verify", token }),
        });
        const data = (await response.json()) as ApiResponse;
        if (cancelled) return;

        const resolvedState = responseState(data.state);
        setState(resolvedState);
        setMessage(data.message ?? "");
        if (resolvedState === "verified" && data.email) {
          setEmail(data.email);
          setMaskedDestination(maskEmail(data.email));
          setNextPath(data.nextPath ?? "/onboarding/organization");
        }
      } catch {
        if (!cancelled) {
          setState("invalid");
          setMessage("We could not verify this link right now. Try again or request a new link.");
        }
      }
    }

    void verifyToken();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function requestVerification(action: "request" | "resend" | "change_email") {
    if (!registrationId) {
      setState("invalid");
      setMessage("Return to Registration to establish an account before requesting verification.");
      return;
    }

    const normalized = normalizeEmail(email);
    setState("requesting");
    setMessage("");

    try {
      const response = await fetch("/api/identity/account-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          registrationId,
          ...(action === "change_email" ? { email: normalized } : {}),
        }),
      });
      const data = (await response.json()) as ApiResponse;
      const resolvedState = responseState(data.state);
      setState(resolvedState);
      setMessage(data.message ?? "");

      if (resolvedState === "pending") {
        if (action === "change_email") setEmail(normalized);
        setMaskedDestination(data.maskedEmail ?? (normalized ? maskEmail(normalized) : maskedDestination));
        setEditingEmail(false);
      } else if (resolvedState === "rate_limited" && data.maskedEmail) {
        setMaskedDestination(data.maskedEmail);
      }
    } catch {
      setState("delivery_error");
      setMessage("We could not request a verification email right now. Please try again.");
    }
  }

  function handleEmailChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void requestVerification("change_email");
  }

  if (state === "verifying" || state === "requesting") {
    return (
      <section className={`identity-card ${styles.card}`} aria-live="polite">
        <div className={`${styles.icon} ${styles.processing}`} aria-hidden="true">↻</div>
        <p className="eyebrow">Account verification</p>
        <h1>{state === "verifying" ? "Verifying your account…" : "Sending verification…"}</h1>
        <p className="muted">RFxchange is processing this identity request through the configured server service.</p>
      </section>
    );
  }

  if (state === "verified") {
    return (
      <section className={`identity-card ${styles.card}`} aria-live="polite">
        <div className={`${styles.icon} ${styles.success}`} aria-hidden="true">✓</div>
        <p className="eyebrow">Account verification</p>
        <h1>Email verified</h1>
        <p className="muted">
          {maskedDestination ? <><strong>{maskedDestination}</strong> is verified. </> : null}
          Your account identity can now continue into organization onboarding.
        </p>
        <button className="button button-primary button-full" type="button" onClick={() => router.push(nextPath)}>
          Continue to organization setup
        </button>
        <p className={styles.boundary}>Organization membership, geography, capabilities, and Exchange access are resolved in later onboarding stages.</p>
      </section>
    );
  }

  if (state === "expired" || (state === "invalid" && token)) {
    const expired = state === "expired";
    return (
      <section className={`identity-card ${styles.card}`} aria-live="polite">
        <div className={`${styles.icon} ${styles.error}`} aria-hidden="true">!</div>
        <p className="eyebrow">Account verification</p>
        <h1>{expired ? "Verification link expired" : "We couldn't verify this link"}</h1>
        <p className="muted">{message || "Request a new link from the pending registration."}</p>
        {registrationId ? (
          <button className="button button-primary button-full" type="button" onClick={() => void requestVerification("resend")}>
            Send a new verification link
          </button>
        ) : (
          <Link className="button button-primary button-full" href="/register">Return to registration</Link>
        )}
      </section>
    );
  }

  if (state === "configuration_error" || state === "delivery_error") {
    return (
      <section className={`identity-card ${styles.card}`} aria-live="polite">
        <div className={`${styles.icon} ${styles.error}`} aria-hidden="true">!</div>
        <p className="eyebrow">Account verification</p>
        <h1>{state === "configuration_error" ? "Verification service unavailable" : "Email delivery failed"}</h1>
        <p className="muted">{message || "Account verification is unavailable in this environment."}</p>
        {registrationId ? (
          <button className="button button-secondary button-full" type="button" onClick={() => void requestVerification("resend")}>
            Try delivery again
          </button>
        ) : null}
        <p className="identity-footer"><Link href="/register">Return to registration</Link></p>
      </section>
    );
  }

  if (editingEmail) {
    return (
      <section className={`identity-card ${styles.card}`} aria-live="polite">
        <div className={styles.icon} aria-hidden="true">✉</div>
        <p className="eyebrow">Account verification</p>
        <h1>Change email address</h1>
        <p className="muted">The replacement address is checked against RFxchange's one-account-per-email rule before a new challenge is sent.</p>
        <form onSubmit={handleEmailChange}>
          <label>
            New account email
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@company.com"
            />
          </label>
          <button className="button button-primary button-full" type="submit">Update and send verification</button>
          <button className={styles.textButton} type="button" onClick={() => setEditingEmail(false)}>Cancel</button>
        </form>
        {message ? <p className={styles.notice}>{message}</p> : null}
      </section>
    );
  }

  if (!registrationId) {
    return (
      <section className={`identity-card ${styles.card}`} aria-live="polite">
        <div className={`${styles.icon} ${styles.error}`} aria-hidden="true">!</div>
        <p className="eyebrow">Account verification</p>
        <h1>Registration required</h1>
        <p className="muted">Create or resume an RFxchange registration before requesting email verification.</p>
        <Link className="button button-primary button-full" href="/register">Go to registration</Link>
      </section>
    );
  }

  return (
    <section className={`identity-card ${styles.card}`} aria-live="polite">
      <div className={styles.icon} aria-hidden="true">✉</div>
      <p className="eyebrow">Account verification</p>
      <h1>{state === "rate_limited" ? "Check your email" : mode === "resend" ? "Resend verification" : "Check your email"}</h1>
      <p className="muted">A secure verification link is associated with this pending registration.</p>
      {maskedDestination ? <p className={styles.destination}>{maskedDestination}</p> : null}
      <p className="muted">Open the link in the delivered email. It is single-use and is validated against the durable server challenge record.</p>

      {message ? <p className={styles.notice}>{message}</p> : null}

      <div className={styles.actions}>
        <button className="button button-secondary button-full" type="button" onClick={() => void requestVerification("resend")}>
          Resend verification
        </button>
        <button className={styles.textButton} type="button" onClick={() => setEditingEmail(true)}>
          Wrong email? Change email address
        </button>
      </div>
      <p className="identity-footer"><Link href="/login">Return to sign in</Link></p>
    </section>
  );
}
