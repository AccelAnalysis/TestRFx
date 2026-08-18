"use client";

import { ChangeEvent, FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AuthEntryContext } from "@/lib/acquisition/auth-entry";
import { buildIdentityHref, withAuthEntryContext } from "@/lib/acquisition/auth-entry";
import type { LoginApiError, MagicLinkChallengeAccepted } from "@/lib/identity/contracts";
import { LOGIN_EMAIL_STORAGE_KEY } from "@/lib/identity/login";
import styles from "./login.module.css";

type LoginFlowProps =
  | { initialContext: AuthEntryContext; initialReturnTo?: never }
  | { initialContext?: never; initialReturnTo: string };

export function LoginFlow(props: LoginFlowProps) {
  const router = useRouter();
  const previewOnly = "initialReturnTo" in props;
  const initialContext: AuthEntryContext = previewOnly ? { returnTo: props.initialReturnTo } : props.initialContext;
  const [email, setEmail] = useState("");
  const [rememberDevice, setRememberDevice] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  if (previewOnly) {
    return (
      <div className={styles.statusPanel}>
        <p>The GitHub Pages projection is static and does not submit authentication requests. Production Firebase Authentication and Microsoft email delivery run only in the server-hosted RFxchange application.</p>
        <p className={styles.registerPrompt}><Link href="/register">Open registration preview</Link></p>
      </div>
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, context: initialContext, rememberDevice }) });
      const payload = (await response.json()) as MagicLinkChallengeAccepted | LoginApiError;
      if (!response.ok || !("status" in payload)) {
        const error = payload as LoginApiError;
        if (error.code === "account_not_found") return router.push(withAuthEntryContext("/login/not-found", initialContext));
        if (error.code === "account_restricted") return router.push(withAuthEntryContext("/login/restricted", initialContext));
        if (error.code === "rate_limited") return router.push(withAuthEntryContext("/login/rate-limited", initialContext));
        throw new Error(error.error || "Unable to start secure sign-in.");
      }
      window.localStorage.setItem(LOGIN_EMAIL_STORAGE_KEY, email.trim().toLowerCase());
      window.localStorage.setItem("rfx.login.remember", rememberDevice ? "1" : "0");
      router.push(withAuthEntryContext("/login/check-email", initialContext));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to start secure sign-in.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={onSubmit} noValidate>
      <label className={styles.field} htmlFor="login-email"><span>Work email</span><input id="login-email" name="email" type="email" autoComplete="email" inputMode="email" placeholder="you@company.com" value={email} onChange={(event: ChangeEvent<HTMLInputElement>) => setEmail(event.target.value)} disabled={submitting} required aria-describedby={message ? "login-error" : undefined} /></label>
      <label className={styles.securityNote}><input type="checkbox" checked={rememberDevice} onChange={(event) => setRememberDevice(event.target.checked)} disabled={submitting} />{" "}Remember this device for a longer authenticated session</label>
      {message ? <p id="login-error" className={styles.error} role="alert">{message} <Link href={withAuthEntryContext("/login/support", initialContext)}>Contact support</Link>.</p> : null}
      <button className={styles.primaryButton} type="submit" disabled={submitting || !email.trim()}>{submitting ? "Sending secure link…" : "Continue"}</button>
      <div className={styles.formDivider}><span>Passwordless sign-in</span></div>
      <p className={styles.securityNote}>RFxchange uses a one-time email-link challenge. If your account requires MFA, the enrolled Firebase second factor is verified before a server session is created.</p>
      <p className={styles.registerPrompt}>New to RFxchange? <Link href={buildIdentityHref("register", initialContext)}>Create an account</Link></p>
    </form>
  );
}
