"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type {
  LoginApiError,
  LoginVerifyApiResponse,
} from "@/lib/identity/contracts";
import styles from "./login.module.css";

type VerifyState =
  | "verifying"
  | "mfa"
  | "expired"
  | "invalid"
  | "restricted"
  | "error";

export function LoginVerificationFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token")?.trim() ?? "";
  const started = useRef(false);
  const [state, setState] = useState<VerifyState>(token ? "verifying" : "invalid");
  const [message, setMessage] = useState(token ? "Validating your secure sign-in link…" : "The sign-in link is incomplete.");
  const [challengeId, setChallengeId] = useState("");
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function verify(body: { token: string } | { challengeId: string; code: string }) {
    const response = await fetch("/api/auth/login/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await response.json()) as LoginVerifyApiResponse | LoginApiError;

    if ("state" in payload) {
      if (payload.state === "authenticated") {
        router.replace(payload.nextPath);
        return;
      }
      if (payload.state === "mfa_required") {
        setChallengeId(payload.challengeId);
        setMessage("Enter the verification code required by your Identity policy.");
        setState("mfa");
        return;
      }
      setMessage(payload.message);
      setState(payload.state);
      return;
    }

    setMessage(payload.error);
    setState("error");
  }

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    void verify({ token }).catch(() => {
      setMessage("We could not verify this sign-in link right now.");
      setState("error");
    });
  }, [token]);

  async function submitMfa(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!challengeId || !code.trim()) return;
    setSubmitting(true);
    setMessage("");
    try {
      await verify({ challengeId, code: code.trim() });
    } catch {
      setMessage("We could not verify that code right now.");
      setState("error");
    } finally {
      setSubmitting(false);
    }
  }

  if (state === "verifying") {
    return (
      <section className={styles.statusPanel} aria-live="polite">
        <div className={styles.statusIcon} aria-hidden="true">↻</div>
        <h2>Authenticating</h2>
        <p>{message}</p>
      </section>
    );
  }

  if (state === "mfa") {
    return (
      <form className={styles.form} onSubmit={submitMfa}>
        <div className={styles.statusPanel}>
          <div className={styles.statusIcon} aria-hidden="true">✓</div>
          <h2>Additional verification</h2>
          <p>{message}</p>
        </div>
        <label className={styles.field} htmlFor="mfa-code">
          <span>Verification code</span>
          <input
            id="mfa-code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(event) => setCode(event.target.value.slice(0, 32))}
            required
          />
        </label>
        <button className={styles.primaryButton} type="submit" disabled={submitting || !code.trim()}>
          {submitting ? "Verifying…" : "Verify code"}
        </button>
        {message ? <p className={styles.securityNote}>{message}</p> : null}
      </form>
    );
  }

  if (state === "expired") {
    return (
      <section className={styles.statusPanel} aria-live="polite">
        <div className={styles.statusIcon} aria-hidden="true">!</div>
        <h2>Sign-in link expired</h2>
        <p>{message}</p>
        <Link className={styles.primaryButton} href="/login?reason=expired">Request a new sign-in link</Link>
        <p className={styles.registerPrompt}><Link href="/">Return to RFxchange</Link></p>
      </section>
    );
  }

  if (state === "restricted") {
    return (
      <section className={styles.statusPanel} aria-live="polite">
        <div className={styles.statusIcon} aria-hidden="true">!</div>
        <h2>Account unavailable</h2>
        <p>{message}</p>
        <Link className={styles.primaryButton} href="/login">Return to sign in</Link>
        <p className={styles.registerPrompt}><Link href="/">Return to RFxchange</Link></p>
      </section>
    );
  }

  return (
    <section className={styles.statusPanel} aria-live="polite">
      <div className={styles.statusIcon} aria-hidden="true">!</div>
      <h2>{state === "invalid" ? "Sign-in link invalid" : "Unable to sign in"}</h2>
      <p>{message}</p>
      <Link className={styles.primaryButton} href="/login">Return to sign in</Link>
      <p className={styles.registerPrompt}><Link href="/">Return to RFxchange</Link></p>
    </section>
  );
}
