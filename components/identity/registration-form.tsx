"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import {
  registrationLoginHref,
  type RegistrationAccepted,
  type RegistrationEntryContext,
  type RegistrationFieldErrors,
} from "@/lib/identity/registration";
import styles from "./registration-form.module.css";

type RegistrationFormProps = {
  initialContext: RegistrationEntryContext;
};

type FormState = {
  firstName: string;
  lastName: string;
  email: string;
  acceptedTerms: boolean;
  marketingConsent: boolean;
};

const emptyForm: FormState = {
  firstName: "",
  lastName: "",
  email: "",
  acceptedTerms: false,
  marketingConsent: false,
};

function contextMessage(context: RegistrationEntryContext) {
  if (context.invitation) return "You arrived through an organization invitation. We’ll preserve that invitation while your identity is verified.";
  if (context.referral) return "You arrived through a referral. We’ll preserve that relationship through onboarding.";
  if (context.campaign) return `You’re joining through the ${context.campaign} campaign.`;
  return null;
}

export function RegistrationForm({ initialContext }: RegistrationFormProps) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<RegistrationFieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [accepted, setAccepted] = useState<RegistrationAccepted | null>(null);
  const entryMessage = contextMessage(initialContext);
  const loginHref = registrationLoginHref(initialContext);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setErrors({});

    try {
      const response = await fetch("/api/identity/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, context: initialContext }),
      });
      const payload = (await response.json()) as RegistrationAccepted | { errors?: RegistrationFieldErrors; error?: string };

      if (!response.ok) {
        setErrors("errors" in payload && payload.errors ? payload.errors : { form: "Registration could not be completed." });
        return;
      }

      setAccepted(payload as RegistrationAccepted);
    } catch {
      setErrors({ form: "Registration could not be completed. Check your connection and try again." });
    } finally {
      setSubmitting(false);
    }
  }

  if (accepted) {
    return (
      <section className={`identity-card ${styles.card}`} aria-live="polite">
        <div className={styles.progress} aria-label="Onboarding progress">
          <span className={styles.progressActive}>Account</span>
          <span>Verify</span>
          <span>Organization</span>
          <span>Exchange ready</span>
        </div>
        <p className="eyebrow">RFxchange registration</p>
        <h1>{accepted.resumed ? "Continue account verification" : "Account created"}</h1>
        <p className="muted">
          <strong>{accepted.email}</strong> {accepted.resumed
            ? "already has a pending RFxchange registration. Continue the verification workflow below."
            : "is now attached to a pending RFxchange account. Verify the email before organization onboarding."}
        </p>
        <div className={styles.statusPanel}>
          <strong>Next: verify your email</strong>
          <p>Verification uses a one-time email challenge. Organization membership, geography, profile, capabilities, and Exchange readiness remain downstream onboarding steps.</p>
        </div>
        <Link className="button button-primary button-full" href={accepted.handoffHref}>
          Continue to account verification
        </Link>
        <p className="identity-footer"><Link href={loginHref}>Return to sign in</Link></p>
      </section>
    );
  }

  return (
    <section className={`identity-card ${styles.card}`}>
      <div className={styles.progress} aria-label="Onboarding progress">
        <span className={styles.progressActive}>Account</span>
        <span>Verify</span>
        <span>Organization</span>
        <span>Exchange ready</span>
      </div>
      <p className="eyebrow">RFxchange registration</p>
      <h1>Create your account</h1>
      <p className="muted">Start with your identity. We’ll verify your email before organization, geography, profile, and capability setup.</p>

      {entryMessage ? <div className={styles.contextBanner}>{entryMessage}</div> : null}

      <form onSubmit={submit} noValidate>
        <div className={styles.nameGrid}>
          <label>
            First name
            <input
              autoComplete="given-name"
              value={form.firstName}
              onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))}
              aria-invalid={Boolean(errors.firstName)}
              aria-describedby={errors.firstName ? "first-name-error" : undefined}
              required
            />
            {errors.firstName ? <small id="first-name-error" className={styles.error}>{errors.firstName}</small> : null}
          </label>
          <label>
            Last name
            <input
              autoComplete="family-name"
              value={form.lastName}
              onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))}
              aria-invalid={Boolean(errors.lastName)}
              aria-describedby={errors.lastName ? "last-name-error" : undefined}
              required
            />
            {errors.lastName ? <small id="last-name-error" className={styles.error}>{errors.lastName}</small> : null}
          </label>
        </div>

        <label>
          Email
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@company.com"
            value={form.email}
            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "email-error" : "email-help"}
            required
          />
          <small id="email-help" className={styles.help}>This becomes your RFxchange account email after successful verification.</small>
          {errors.email ? <small id="email-error" className={styles.error}>{errors.email}</small> : null}
        </label>

        <label className={styles.checkRow}>
          <input
            type="checkbox"
            checked={form.acceptedTerms}
            onChange={(event) => setForm((current) => ({ ...current, acceptedTerms: event.target.checked }))}
          />
          <span>I agree to the <Link href="/terms">Terms of Use</Link> and acknowledge the <Link href="/privacy">Privacy Policy</Link>.</span>
        </label>
        {errors.acceptedTerms ? <small className={styles.error}>{errors.acceptedTerms}</small> : null}

        <label className={styles.checkRow}>
          <input
            type="checkbox"
            checked={form.marketingConsent}
            onChange={(event) => setForm((current) => ({ ...current, marketingConsent: event.target.checked }))}
          />
          <span>Send me optional RFxchange product and community updates.</span>
        </label>

        {errors.form ? <div className={styles.formError} role="alert">{errors.form}</div> : null}

        <button className="button button-primary button-full" type="submit" disabled={submitting}>
          {submitting ? "Creating account…" : "Continue"}
        </button>
      </form>

      <p className="identity-footer">Already registered? <Link href={loginHref}>Sign in</Link></p>
    </section>
  );
}
