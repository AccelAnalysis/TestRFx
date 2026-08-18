"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { getMultiFactorResolver, isSignInWithEmailLink, PhoneAuthProvider, PhoneMultiFactorGenerator, RecaptchaVerifier, signInWithEmailLink, signOut, TotpMultiFactorGenerator, type MultiFactorInfo, type MultiFactorResolver, type UserCredential } from "firebase/auth";
import { useRouter } from "next/navigation";
import { getFirebaseClientAuth } from "@/lib/firebase/client";
import { LOGIN_EMAIL_STORAGE_KEY } from "@/lib/identity/login";
import styles from "./login.module.css";
import workflow from "./login-workflow.module.css";

function firebaseCode(error: unknown) { return typeof error === "object" && error && "code" in error ? String((error as { code?: unknown }).code) : ""; }

export function LoginCompleteClient({ challengeId, rememberDevice, returnTo }: { challengeId: string; rememberDevice: boolean; returnTo: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [emailReady, setEmailReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [resolver, setResolver] = useState<MultiFactorResolver | null>(null);
  const [selectedFactor, setSelectedFactor] = useState<MultiFactorInfo | null>(null);
  const [verificationId, setVerificationId] = useState("");
  const [code, setCode] = useState("");
  useEffect(() => { setEmail(window.localStorage.getItem(LOGIN_EMAIL_STORAGE_KEY) ?? ""); setEmailReady(true); }, []);
  const factors = useMemo(() => resolver?.hints ?? [], [resolver]);

  async function establishSession(credential: UserCredential) {
    const auth = getFirebaseClientAuth();
    const idToken = await credential.user.getIdToken(true);
    const response = await fetch("/api/auth/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken, challengeId, rememberDevice, returnTo }) });
    const payload = (await response.json()) as { destination?: string; error?: string };
    if (!response.ok || !payload.destination) {
      if (response.status === 403) return router.replace(`/login/restricted?returnTo=${encodeURIComponent(returnTo)}`);
      if (response.status === 410) return router.replace(`/login/link-expired?returnTo=${encodeURIComponent(returnTo)}`);
      throw new Error(payload.error ?? "Unable to establish the RFxchange session.");
    }
    await signOut(auth).catch(() => undefined);
    window.localStorage.removeItem(LOGIN_EMAIL_STORAGE_KEY);
    window.localStorage.removeItem("rfx.login.remember");
    window.location.assign(payload.destination);
  }

  async function completeFirstFactor(event?: FormEvent) {
    event?.preventDefault(); setBusy(true); setMessage("");
    try {
      const auth = getFirebaseClientAuth();
      if (!isSignInWithEmailLink(auth, window.location.href)) return router.replace(`/login/link-invalid?returnTo=${encodeURIComponent(returnTo)}`);
      const credential = await signInWithEmailLink(auth, email.trim().toLowerCase(), window.location.href);
      await establishSession(credential);
    } catch (error) {
      const errorCode = firebaseCode(error);
      if (errorCode === "auth/multi-factor-auth-required") { setResolver(getMultiFactorResolver(getFirebaseClientAuth(), error as never)); setBusy(false); return; }
      if (errorCode === "auth/expired-action-code") return router.replace(`/login/link-expired?returnTo=${encodeURIComponent(returnTo)}`);
      if (["auth/invalid-action-code", "auth/invalid-email"].includes(errorCode)) return router.replace(`/login/link-invalid?returnTo=${encodeURIComponent(returnTo)}`);
      if (errorCode === "auth/user-disabled") return router.replace(`/login/restricted?returnTo=${encodeURIComponent(returnTo)}`);
      if (errorCode === "auth/too-many-requests") return router.replace(`/login/rate-limited?returnTo=${encodeURIComponent(returnTo)}`);
      setMessage(error instanceof Error ? error.message : "RFxchange could not verify the sign-in link.");
    } finally { setBusy(false); }
  }

  async function chooseFactor(factor: MultiFactorInfo) {
    setSelectedFactor(factor); setMessage("");
    if (factor.factorId !== PhoneMultiFactorGenerator.FACTOR_ID || !resolver) return;
    setBusy(true);
    try {
      const auth = getFirebaseClientAuth();
      const verifier = new RecaptchaVerifier(auth, "mfa-recaptcha", { size: "invisible" });
      setVerificationId(await new PhoneAuthProvider(auth).verifyPhoneNumber({ multiFactorHint: factor, session: resolver.session }, verifier));
    } catch (error) { setMessage(error instanceof Error ? error.message : "RFxchange could not send the SMS verification code."); }
    finally { setBusy(false); }
  }

  async function verifySecondFactor(event: FormEvent) {
    event.preventDefault(); if (!resolver || !selectedFactor || !code.trim()) return;
    setBusy(true); setMessage("");
    try {
      const assertion = selectedFactor.factorId === TotpMultiFactorGenerator.FACTOR_ID
        ? TotpMultiFactorGenerator.assertionForSignIn(selectedFactor.uid, code.trim())
        : selectedFactor.factorId === PhoneMultiFactorGenerator.FACTOR_ID && verificationId
          ? PhoneMultiFactorGenerator.assertion(PhoneAuthProvider.credential(verificationId, code.trim()))
          : null;
      if (!assertion) throw new Error("The selected second factor is not ready for verification.");
      await establishSession(await resolver.resolveSignIn(assertion));
    } catch (error) {
      if (firebaseCode(error) === "auth/too-many-requests") return router.replace(`/login/rate-limited?returnTo=${encodeURIComponent(returnTo)}`);
      setMessage(error instanceof Error ? error.message : "The verification code could not be verified.");
    } finally { setBusy(false); }
  }

  if (!emailReady) return <p className={workflow.status}>Preparing secure sign-in…</p>;
  if (!email) return <form className={styles.form} onSubmit={completeFirstFactor}><p className={workflow.note}>You opened this link on a different device. Enter the same email address to complete sign-in without placing the address in the link URL.</p><label className={styles.field}><span>Work email</span><input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><button className={styles.primaryButton} type="submit" disabled={busy || !email.trim()}>{busy ? "Verifying…" : "Verify sign-in link"}</button></form>;
  if (!resolver) return <div className={workflow.actions}><p className={workflow.status}>Verify the one-time Firebase sign-in link. RFxchange then resolves the user, organization membership, permissions, and onboarding readiness before creating a server session.</p><button className={styles.primaryButton} type="button" onClick={() => void completeFirstFactor()} disabled={busy}>{busy ? "Verifying…" : "Complete secure sign-in"}</button>{message ? <p className={styles.error} role="alert">{message}</p> : null}</div>;
  return <div className={workflow.actions}><p className={workflow.status}>Additional verification is required. Choose an enrolled second factor.</p><div className={workflow.factorList}>{factors.map((factor) => <button key={factor.uid} className={workflow.factorButton} type="button" onClick={() => void chooseFactor(factor)} disabled={busy}><strong>{factor.factorId === "totp" ? "Authenticator app" : factor.factorId === "phone" ? "SMS" : factor.factorId}</strong>{factor.displayName ? ` — ${factor.displayName}` : ""}</button>)}</div>{selectedFactor ? <form className={workflow.codeRow} onSubmit={verifySecondFactor}><label className={styles.field}><span>Verification code</span><input className={workflow.codeInput} inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value)} required /></label><div id="mfa-recaptcha" /><button className={styles.primaryButton} type="submit" disabled={busy || !code.trim() || (selectedFactor.factorId === "phone" && !verificationId)}>{busy ? "Verifying…" : "Verify code"}</button></form> : null}{message ? <p className={styles.error} role="alert">{message}</p> : null}</div>;
}
