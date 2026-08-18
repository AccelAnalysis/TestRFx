"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { AuthEntryContext } from "@/lib/acquisition/auth-entry";
import { withAuthEntryContext } from "@/lib/acquisition/auth-entry";
import type { LoginApiError, MagicLinkChallengeAccepted } from "@/lib/identity/contracts";
import { LOGIN_EMAIL_STORAGE_KEY, maskEmail } from "@/lib/identity/login";
import styles from "./login.module.css";
import workflow from "./login-workflow.module.css";

export function CheckEmailPanel({ context }: { context: AuthEntryContext }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => setEmail(window.localStorage.getItem(LOGIN_EMAIL_STORAGE_KEY) ?? ""), []);

  async function resend() {
    if (!email) return;
    setBusy(true); setStatus("");
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, context, rememberDevice: window.localStorage.getItem("rfx.login.remember") === "1" }) });
      const payload = (await response.json()) as MagicLinkChallengeAccepted | LoginApiError;
      if (!response.ok || !("status" in payload)) throw new Error((payload as LoginApiError).error || "Unable to resend the link.");
      setStatus("A new sign-in link was sent. Use the most recent message to continue.");
    } catch (error) { setStatus(error instanceof Error ? error.message : "Unable to resend the link."); }
    finally { setBusy(false); }
  }

  if (!email) return <div className={workflow.actions}><p className={workflow.note}>This device does not have the email from the original sign-in request. Return to Login and enter it again.</p><Link className={workflow.primary} href={withAuthEntryContext("/login", context)}>Return to Login</Link></div>;
  return <div className={workflow.actions}><p className={workflow.status}>We sent a one-time sign-in link to <strong>{maskEmail(email)}</strong>. RFxchange accepts the application challenge for 15 minutes.</p><button className={styles.primaryButton} type="button" onClick={resend} disabled={busy}>{busy ? "Sending…" : "Resend sign-in link"}</button><Link className={workflow.secondary} href={withAuthEntryContext("/login", context)}>Use a different email</Link>{status ? <p className={workflow.note} role="status">{status}</p> : null}</div>;
}
