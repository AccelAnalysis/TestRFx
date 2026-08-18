"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  type AccountVerificationContext,
  type AccountVerificationState,
  maskEmail,
  normalizeEmail,
  sanitizeVerificationContext,
} from "@/lib/identity/account-verification";
import styles from "./AccountVerificationPanel.module.css";

type ApiResponse = {
  state?: string;
  message?: string;
  maskedEmail?: string;
  referenceDelivery?: boolean;
  verificationPath?: string;
  email?: string;
  nextPath?: string;
};

function responseState(value: string | undefined): AccountVerificationState {
  if (
    value === "pending" ||
    value === "verified" ||
    value === "expired" ||
    value === "invalid" ||
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
  const initialEmail = normalizeEmail(searchParams.get("email") ?? "");
  const [email, setEmail] = useState(initialEmail);
  const [maskedDestination, setMaskedDestination] = useState(initialEmail ? maskEmail(initialEmail) : "");
  const [state, setState] = useState<AccountVerificationState>(token ? "verifying" : "idle");
  const [message, setMessage] = useState("");
  const [referencePath, setReferencePath] = useState("");
  const [nextPath, setNextPath] = useState("/onboarding?stage=organization");
  const [editingEmail, setEditingEmail] = useState(!initialEmail);

  const context = useMemo<AccountVerificationContext>(
    () =>
      sanitizeVerificationContext({
        source: searchParams.get("source") ?? "registration",
        invitationId: searchParams.get("invitation") ?? undefined,
        referralId: searchParams.get("referral") ?? undefined,
        campaignId: searchParams.get("campaign") ?? undefined,
        returnTo: searchParams.get("returnTo") ?? undefined,
      }),
    [searchParams],
  );

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
          setNextPath(data.nextPath ?? "/onboarding?stage=organization");
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
    const normalized = normalizeEmail(email);
    setState("requesting");
    setMessage("");
    setReferencePath("");

    try {
      const response = await fetch("/api/identity/account-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, email: normalized, context }),
      });
      const data = (await response.json()) as ApiResponse;
      const resolvedState = response.ok ? responseState(data.state) : responseState(data.state);
      setState(resolvedState);
      setMessage(data.message ?? "");

      if (resolvedState === "pending") {
        setEmail(normalized);
        setMaskedDestination(data.maskedEmail ?? maskEmail(normalized));
        setEditingEmail(false);
        setReferencePath(data.referenceDelivery ? data.verificationPath ?? "" : "");
      }
    } catch {
      setState("invalid");
      setMessage("We could not request a verification email right now. Please try again.");
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void requestVerification(editingEmail && maskedDestination ? "change_email" : "request");
  }

  if (state === "verifying") {
    return (
      <section className={`identity-card ${styles.card}`} aria-live="polite">
        <div className={`${styles.icon} ${styles.processing}`} aria-hidden="true">↻</div>
        <p className="eyebrow">Account verification</p>
        <h1>Verifying your account…</h1>
        <p className="muted">We are securely validating this one-time verification link.</p>
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
          <strong>{maskedDestination}</strong> is verified. Your account identity can now continue into organization onboarding.
        </p>
        <button className="button button-primary button-full" type="button" onClick={() => router.push(nextPath)}>
          Continue setup
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
        <p className="muted">
          {message || (expired
            ? "For your security, this verification link can no longer be used."
            : "The link may be invalid, incomplete, or no longer active.")}
        </p>
        {email ? (
          <button className="button button-primary button-full" type="button" onClick={() => void requestVerification("resend")}>
            Send a new verification link
          </button>
        ) : (
          <Link className="button button-primary button-full" href="/register">Return to registration</Link>
        )}
        <p className="identity-footer"><Link href="/login">Return to sign in</Link></p>
      </section>
    );
  }

  if (state === "configuration_error") {
    return (
      <section className={`identity-card ${styles.card}`} aria-live="polite">
        <div className={`${styles.icon} ${styles.error}`} aria-hidden="true">!</div>
        <p className="eyebrow">Account verification</p>
        <h1>Verification is not configured</h1>
        <p className="muted">{message || "Account verification is unavailable in this environment."}</p>
        <Link className="button button-secondary button-full" href="/register">Return to registration</Link>
      </section>
    );
  }

  return (
    <section className={`identity-card ${styles.card}`} aria-live="polite">
      <div className={styles.icon} aria-hidden="true">✉</div>
      <p className="eyebrow">Account verification</p>
      <h1>{state === "pending" ? "Check your email" : "Verify your email"}</h1>

      {state === "pending" && !editingEmail ? (
        <>
          <p className="muted">We sent a verification link to:</p>
          <p className={styles.destination}>{maskedDestination}</p>
          <p className="muted">Open the link to prove control of this account email and continue setup.</p>

          {referencePath ? (
            <div className={styles.referenceBox}>
              <strong>Reference chassis delivery</strong>
              <p>Email delivery is an integration point in this repo. Use this local link to exercise the verification contract.</p>
              <a className="button button-primary button-full" href={referencePath}>Open reference verification link</a>
            </div>
          ) : null}

          <div className={styles.actions}>
            <button className="button button-secondary button-full" type="button" onClick={() => void requestVerification("resend")}>
              Resend verification
            </button>
            <button className={styles.textButton} type="button" onClick={() => setEditingEmail(true)}>
              Wrong email? Change email address
            </button>
          </div>
        </>
      ) : (
        <form onSubmit={handleSubmit}>
          <p className="muted">
            Enter the email address for this RFxchange account. Verification establishes account identity only.
          </p>
          <label>
            Account email
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@company.com"
            />
          </label>
          <button className="button button-primary button-full" type="submit" disabled={state === "requesting"}>
            {state === "requesting" ? "Sending…" : maskedDestination ? "Update and resend" : "Send verification email"}
          </button>
          {maskedDestination ? (
            <button className={styles.textButton} type="button" onClick={() => setEditingEmail(false)}>
              Keep {maskedDestination}
            </button>
          ) : null}
        </form>
      )}

      {message ? <p className={styles.notice}>{message}</p> : null}
      <p className="identity-footer"><Link href="/login">Return to sign in</Link></p>
    </section>
  );
}
