"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  registrationHandoffHref,
  registrationLoginHref,
  registrationWorkflowHref,
  type RegistrationAccepted,
  type RegistrationEntryContext,
  type RegistrationFieldErrors,
} from "@/lib/identity/registration";
import {
  findRegistrationWorkflowNode,
  registrationWorkflowTree,
  type RegistrationWorkflowNode,
} from "@/lib/identity/registration-navigation";
import styles from "./registration-workflow.module.css";

type RegistrationWorkflowProps = {
  initialPath: string[];
  initialContext: RegistrationEntryContext;
  initialRegistrationId?: string;
};

type FormState = {
  firstName: string;
  lastName: string;
  email: string;
  acceptedTerms: boolean;
  marketingConsent: boolean;
};

const initialForm: FormState = {
  firstName: "",
  lastName: "",
  email: "",
  acceptedTerms: false,
  marketingConsent: false,
};

const defaultPath = ["create-account", "name"];

function samePath(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && left.every((part, index) => part === right[index]);
}

function pathFromLocation(pathname: string) {
  const marker = "/register/";
  const markerIndex = pathname.indexOf(marker);
  if (markerIndex === -1) return defaultPath;
  const value = pathname.slice(markerIndex + marker.length);
  return value.split("/").filter(Boolean).map(decodeURIComponent);
}

function contextRows(context: RegistrationEntryContext) {
  return [
    ["Entry", context.entryKind.replaceAll("_", " ")],
    ["Source", context.source],
    ["Campaign", context.campaign],
    ["Referral", context.referral ? "Referral context retained" : undefined],
    ["Invitation", context.invitation ? "Invitation context retained" : undefined],
    ["Organization intent", context.organization],
    ["Membership intent", context.membership],
    ["Geography intent", context.geography],
    ["Requested record", context.record],
    ["Return destination", context.returnTo],
  ].filter((row): row is [string, string] => Boolean(row[1]));
}

function WorkflowTree({ activePath, onNavigate }: { activePath: string[]; onNavigate: (path: readonly string[]) => void }) {
  return (
    <ul className={styles.tree}>
      {registrationWorkflowTree.map((node) => (
        <li key={node.id}>
          <button
            className={`${styles.navButton} ${samePath(activePath, node.path) ? styles.navButtonActive : ""}`}
            type="button"
            onClick={() => onNavigate(node.path)}
          >
            <span className={styles.navLabel}><strong>{node.label}</strong><small>{node.kind}</small></span>
            <span className={styles.navArrow}>›</span>
          </button>
          {node.children ? (
            <ul className={styles.children}>
              {node.children.map((child) => (
                <li key={child.id}>
                  <button
                    className={`${styles.navButton} ${samePath(activePath, child.path) ? styles.navButtonActive : ""}`}
                    type="button"
                    onClick={() => onNavigate(child.path)}
                  >
                    <span className={styles.navLabel}><strong>{child.label}</strong><small>{child.kind}</small></span>
                    <span className={styles.navArrow}>›</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function RegistrationWorkflow({ initialPath, initialContext, initialRegistrationId }: RegistrationWorkflowProps) {
  const safeInitialPath = findRegistrationWorkflowNode(initialPath) ? initialPath : defaultPath;
  const [activePath, setActivePath] = useState<string[]>(safeInitialPath);
  const [form, setForm] = useState<FormState>(initialForm);
  const [errors, setErrors] = useState<RegistrationFieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [outcome, setOutcome] = useState<RegistrationAccepted | null>(null);
  const [registrationId, setRegistrationId] = useState(initialRegistrationId ?? "");

  const currentNode = useMemo(
    () => findRegistrationWorkflowNode(activePath) ?? findRegistrationWorkflowNode(defaultPath)!,
    [activePath],
  );
  const loginHref = registrationLoginHref(initialContext);

  useEffect(() => {
    function onPopState() {
      const nextPath = pathFromLocation(window.location.pathname);
      if (findRegistrationWorkflowNode(nextPath)) setActivePath(nextPath);
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  function navigate(path: readonly string[]) {
    const next = [...path];
    setActivePath(next);
    const href = registrationWorkflowHref(next, initialContext, registrationId || undefined);
    window.history.pushState({}, "", href);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function validateName() {
    const nextErrors: RegistrationFieldErrors = {};
    if (!form.firstName.trim()) nextErrors.firstName = "Enter your first name.";
    if (!form.lastName.trim()) nextErrors.lastName = "Enter your last name.";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function validateEmail() {
    const nextErrors: RegistrationFieldErrors = {};
    const email = form.email.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) nextErrors.email = "Enter a valid email address.";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function submitRegistration(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setErrors({});
    if (!validateName() || !validateEmail()) {
      navigate(!form.firstName.trim() || !form.lastName.trim() ? ["create-account", "name"] : ["create-account", "email"]);
      return;
    }
    if (!form.acceptedTerms) {
      setErrors({ acceptedTerms: "Accept the Terms of Use and Privacy Policy to continue." });
      navigate(["create-account", "security-privacy"]);
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/identity/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, context: initialContext }),
      });
      const payload = (await response.json()) as RegistrationAccepted | { errors?: RegistrationFieldErrors };

      if ("status" in payload) {
        setOutcome(payload);
        if (payload.status === "existing_account") {
          navigate(["identity-resolution", "existing-account"]);
          return;
        }

        setRegistrationId(payload.registrationId);
        if (payload.status === "verification_delivery_failed") {
          navigate(["verify-email", "send"]);
          return;
        }
        navigate([
          "identity-resolution",
          payload.resolution === "pending_verification" ? "pending-verification" : "new-account",
        ]);
        return;
      }

      setErrors(payload.errors ?? { form: "Registration could not be completed." });
    } catch {
      setErrors({ form: "Registration could not be completed. Check your connection and try again." });
    } finally {
      setSubmitting(false);
    }
  }

  function childGrid(node: RegistrationWorkflowNode) {
    if (!node.children?.length) return null;
    return (
      <div className={styles.childGrid}>
        {node.children.map((child) => (
          <button className={styles.childCard} type="button" key={child.id} onClick={() => navigate(child.path)}>
            <strong>{child.label}</strong>
            <span>{child.description}</span>
          </button>
        ))}
      </div>
    );
  }

  function renderEntryContext() {
    const rows = contextRows(initialContext);
    return (
      <>
        <p className={styles.lede}>The Public / Acquisition shell hands Registration bounded attribution and deep-link intent. Registration preserves it without turning it into organization authority.</p>
        {rows.length ? (
          <div className={styles.contextGrid}>
            {rows.map(([label, value]) => <div className={styles.contextCard} key={label}><strong>{label}</strong><span>{value}</span></div>)}
          </div>
        ) : <div className={styles.notice}>No campaign, referral, invitation, organization, membership, geography, record, or return context was supplied.</div>}
        <div className={styles.actions}>
          <button className="button button-primary" type="button" onClick={() => navigate(["create-account", "name"])}>Continue to account creation</button>
        </div>
      </>
    );
  }

  function renderCreateAccountLeaf() {
    const leaf = activePath[1];
    if (leaf === "name") {
      return (
        <form className={styles.form} onSubmit={(event) => { event.preventDefault(); if (validateName()) navigate(["create-account", "email"]); }}>
          <div className={styles.nameGrid}>
            <label>First name<input autoComplete="given-name" value={form.firstName} onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))} />{errors.firstName ? <small className={styles.error}>{errors.firstName}</small> : null}</label>
            <label>Last name<input autoComplete="family-name" value={form.lastName} onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))} />{errors.lastName ? <small className={styles.error}>{errors.lastName}</small> : null}</label>
          </div>
          <div className={styles.actions}><button className="button button-primary" type="submit">Continue to email</button></div>
        </form>
      );
    }
    if (leaf === "email") {
      return (
        <form className={styles.form} onSubmit={(event) => { event.preventDefault(); if (validateEmail()) navigate(["create-account", "auth-method"]); }}>
          <label>Email address<input type="email" inputMode="email" autoComplete="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} placeholder="you@company.com" />{errors.email ? <small className={styles.error}>{errors.email}</small> : null}</label>
          <div className={styles.notice}>This address is normalized and checked against the one-account-per-email rule when the registration is submitted.</div>
          <div className={styles.actions}><button className="button button-secondary" type="button" onClick={() => navigate(["create-account", "name"])}>Back</button><button className="button button-primary" type="submit">Continue to authentication method</button></div>
        </form>
      );
    }
    if (leaf === "auth-method") {
      return (
        <>
          <div className={`${styles.notice} ${styles.statusGood}`}><strong>Passwordless email verification</strong><br />RFxchange uses the secure email-link method defined by the Login flow. No password is collected or stored in this Registration implementation.</div>
          <div className={styles.sourceNote}><strong>Source reconciliation:</strong> the Registration diagram contains “Create password,” while the Login diagram defines passwordless magic-link authentication and the Onboarding diagram allows “Email / Password or Auth Method.” The governed Login architecture therefore supplies the auth-method branch here instead of introducing a contradictory password credential.</div>
          <div className={styles.actions}><button className="button button-secondary" type="button" onClick={() => navigate(["create-account", "email"])}>Back</button><button className="button button-primary" type="button" onClick={() => navigate(["create-account", "security-privacy"])}>Continue to security & privacy</button></div>
        </>
      );
    }
    if (leaf === "security-privacy") {
      return (
        <form className={styles.form} onSubmit={(event) => { event.preventDefault(); if (!form.acceptedTerms) { setErrors({ acceptedTerms: "Accept the Terms of Use and Privacy Policy to continue." }); return; } setErrors({}); navigate(["create-account", "review"]); }}>
          <label className={styles.checkRow}><input type="checkbox" checked={form.acceptedTerms} onChange={(event) => setForm((current) => ({ ...current, acceptedTerms: event.target.checked }))} /><span>I agree to the <Link href="/terms">Terms of Use</Link> and acknowledge the <Link href="/privacy">Privacy Policy</Link>.</span></label>
          {errors.acceptedTerms ? <small className={styles.error}>{errors.acceptedTerms}</small> : null}
          <label className={styles.checkRow}><input type="checkbox" checked={form.marketingConsent} onChange={(event) => setForm((current) => ({ ...current, marketingConsent: event.target.checked }))} /><span>Send me optional RFxchange product and community updates.</span></label>
          <div className={styles.notice}>Policy acceptance is versioned and persisted server-side. Marketing consent is stored separately and is not required to create an account.</div>
          <div className={styles.actions}><button className="button button-secondary" type="button" onClick={() => navigate(["create-account", "auth-method"])}>Back</button><button className="button button-primary" type="submit">Review account</button></div>
        </form>
      );
    }

    return (
      <form className={styles.form} onSubmit={submitRegistration}>
        <div className={styles.summaryGrid}>
          <div className={styles.summaryCard}><strong>Name</strong><span>{form.firstName || "—"} {form.lastName || ""}</span></div>
          <div className={styles.summaryCard}><strong>Email</strong><span>{form.email || "—"}</span></div>
          <div className={styles.summaryCard}><strong>Authentication</strong><span>Passwordless verification link</span></div>
          <div className={styles.summaryCard}><strong>Marketing</strong><span>{form.marketingConsent ? "Opted in" : "Not opted in"}</span></div>
        </div>
        {errors.form ? <div className={`${styles.notice} ${styles.statusWarn}`}>{errors.form}</div> : null}
        <div className={styles.actions}><button className="button button-secondary" type="button" onClick={() => navigate(["create-account", "security-privacy"])}>Back</button><button className="button button-primary" type="submit" disabled={submitting}>{submitting ? "Creating registration…" : "Create account"}</button></div>
      </form>
    );
  }

  function renderIdentityResolution() {
    const leaf = activePath[1];
    if (!leaf) return childGrid(currentNode);
    if (leaf === "existing-account") {
      const href = outcome?.status === "existing_account" ? outcome.loginHref : loginHref;
      return <><div className={`${styles.notice} ${styles.statusGood}`}>RFxchange found an already verified identity for this email. No duplicate account was created.</div><Link className="button button-primary" href={href}>Continue to Login</Link></>;
    }
    if (leaf === "pending-verification") {
      return <><div className={`${styles.notice} ${styles.statusWarn}`}>A pending identity already exists. RFxchange reused that account and preserved the registration context instead of creating a duplicate.</div><button className="button button-primary" type="button" onClick={() => navigate(["verify-email", "resend"])}>Open resend verification</button></>;
    }
    return <><div className={`${styles.notice} ${styles.statusGood}`}>A durable pending RFxchange identity and registration transaction were created. The next required trust step is email verification.</div><button className="button button-primary" type="button" onClick={() => navigate(["verify-email", "send"])}>Continue to verification</button></>;
  }

  function renderVerification() {
    const leaf = activePath[1];
    if (!leaf) return childGrid(currentNode);
    const resolvedRegistrationId = registrationId || initialRegistrationId;
    if (!resolvedRegistrationId) {
      return <><div className={`${styles.notice} ${styles.statusWarn}`}>Create or resume an account first. Verification actions require the durable registration identifier.</div><button className="button button-primary" type="button" onClick={() => navigate(["create-account", "review"])}>Return to account creation</button></>;
    }

    if (leaf === "send") {
      const failed = outcome?.status === "verification_delivery_failed" ? outcome : null;
      const masked = outcome && outcome.status !== "existing_account" ? outcome.maskedEmail : "the registered email";
      return <><div className={`${styles.notice} ${failed ? styles.statusWarn : styles.statusGood}`}>{failed ? failed.message : `Verification is associated with ${masked}. A successful send is recorded only when the configured email transport confirms delivery.`}</div><Link className="button button-primary" href={registrationHandoffHref(resolvedRegistrationId, initialContext, failed ? "resend" : undefined)}>{failed ? "Open resend workflow" : "Open verification status"}</Link></>;
    }
    if (leaf === "resend") {
      return <><div className={styles.notice}>Resend uses the Account Verification service. It applies a cooldown, supersedes the prior live challenge, stores only a token hash, and records real email-delivery success or failure.</div><Link className="button button-primary" href={registrationHandoffHref(resolvedRegistrationId, initialContext, "resend")}>Resend verification</Link></>;
    }
    if (leaf === "change-email") {
      return <><div className={styles.notice}>Changing the pending account email checks the one-account-per-email rule, updates the durable pending identity, revokes/supersedes prior challenges, and sends a fresh verification link.</div><Link className="button button-primary" href={registrationHandoffHref(resolvedRegistrationId, initialContext, "change-email")}>Change email address</Link></>;
    }
    return <><div className={styles.notice}>The email link opens Account Verification, validates the single-use token against the durable challenge record, marks the account email verified, and continues to Organization Selection / Creation.</div><Link className="button button-primary" href={registrationHandoffHref(resolvedRegistrationId, initialContext)}>Open Account Verification</Link></>;
  }

  function renderContent() {
    if (activePath[0] === "entry-context") return activePath.length === 1 ? childGrid(currentNode) : renderEntryContext();
    if (activePath[0] === "create-account") return activePath.length === 1 ? childGrid(currentNode) : renderCreateAccountLeaf();
    if (activePath[0] === "identity-resolution") return renderIdentityResolution();
    if (activePath[0] === "verify-email") return renderVerification();
    return null;
  }

  const crumbs = activePath.map((_, index) => findRegistrationWorkflowNode(activePath.slice(0, index + 1))).filter(Boolean) as RegistrationWorkflowNode[];

  return (
    <div className={styles.shell}>
      <nav className={styles.nav} aria-label="Registration workflow">
        <p className="eyebrow">Identity &amp; onboarding</p>
        <h2>Registration</h2>
        <p className={styles.navIntro}>Source-derived child and grandchild workflows. Later organization, geography, profile, capability, membership, and Exchange-ready work remains in its owning onboarding module.</p>
        <WorkflowTree activePath={activePath} onNavigate={navigate} />
      </nav>

      <section className={styles.panel} aria-live="polite">
        <div className={styles.mobilePath}>{crumbs.map((node) => node.label).join(" › ")}</div>
        <div className={styles.breadcrumbs}>
          <button type="button" onClick={() => navigate(defaultPath)}>Registration</button>
          {crumbs.map((node, index) => <span key={node.id}>/ <button type="button" onClick={() => navigate(activePath.slice(0, index + 1))}>{node.label}</button></span>)}
        </div>
        <p className="eyebrow">{currentNode.kind}</p>
        <h1>{currentNode.label}</h1>
        <p className={styles.lede}>{currentNode.description}</p>
        {renderContent()}
        <p className="identity-footer">Already registered? <Link href={loginHref}>Sign in</Link></p>
      </section>
    </div>
  );
}
