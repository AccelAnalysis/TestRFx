"use client";

import { useState } from "react";
import styles from "./login.module.css";
import workflow from "./login-workflow.module.css";

export function SignOutPanel() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function signOut() {
    setBusy(true); setMessage("");
    const response = await fetch("/api/auth/session", { method: "DELETE" }).catch(() => null);
    if (!response?.ok) { setMessage("RFxchange could not complete sign out. Try again."); setBusy(false); return; }
    window.location.assign("/login");
  }
  return <div className={workflow.actions}><button className={styles.primaryButton} type="button" onClick={() => void signOut()} disabled={busy}>{busy ? "Signing out…" : "Sign out"}</button>{message ? <p className={styles.error} role="alert">{message}</p> : null}</div>;
}
