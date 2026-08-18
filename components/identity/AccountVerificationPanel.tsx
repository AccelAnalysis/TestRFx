"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import {
  buildVerificationContextSearchParams,
  type AccountVerificationState,
  type VerificationStatusResponse,
  verificationContextFromSearchParams,
} from "@/lib/identity/account-verification";
import {
  accountVerificationPath,
  accountVerificationTree,
  getAccountVerificationBreadcrumbs,
  getAccountVerificationNode,
  type AccountVerificationNode,
} from "@/lib/identity/account-verification-navigation";
import styles from "./AccountVerificationPanel.module.css";

type ApiResponse = Partial<VerificationStatusResponse> & {
  state?: string;
  message?: string;
  registrationId?: string;
  maskedEmail?: string;
  expiresInSeconds?: number;
  retryAfterSeconds?: number;
  nextPath?: string;
};

type Props = {
  activePath: string[];
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

function WorkflowTree({
  node,
  path,
  activePath,
  hrefFor,
}: {
  node: AccountVerificationNode;
  path: string[];
  activePath: string[];
  hrefFor: (path: string[]) => string;
}) {
  const current = path.join("/") === activePath.join("/");
  return (
    <li>
      <Link className={current ? styles.navActive : styles.navLink} href={hrefFor(path)} aria-current={current ? "page" : undefined}>
        {node.label}
      </Link>
      {node.children?.length ? (
        <ul>
          {node.children.map((child) => (
            <WorkflowTree
              key={child.id}
              node={child}
              path={[...path, child.id]}
              activePath={activePath}
              hrefFor={hrefFor}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function AccountVerificationPanel({ activePath }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const node = getAccountVerificationNode(activePath) ?? accountVerificationTree;
  const initialRegistrationId = searchParams.get("registration")?.trim() ?? "";
  const token = searchParams.get("token")?.trim() ?? "";
  const [registrationId, setRegistrationId] = useState(initialRegistrationId);
  const [state, setState] = useState<AccountVerificationState>(
    token && node.id === "verification-link" ? "verifying" : initialRegistrationId ? "loading" : "idle",
  );
  const [maskedEmail, setMaskedEmail] = useState("");
  const [message, setMessage] = useState("");
  const [nextPath, setNextPath] = useState("/onboarding/organization");
  const [latestDeliveryState, setLatestDeliveryState] = useState<VerificationStatusResponse["latestDeliveryState"]>();
  const [latestChallengeState, setLatestChallengeState] = useState<VerificationStatusResponse["latestChallengeState"]>();
  const [retryAfterSeconds, setRetryAfterSeconds] = useState<number | undefined>();
  const [newEmail, setNewEmail] = useState("");

  const context = useMemo(
    () => verificationContextFromSearchParams(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );

  const hrefFor = useCallback((path: string[], options: { token?: string } = {}) => {
    const params = buildVerificationContextSearchParams(context);
    if (registrationId) params.set("registration", registrationId);
    if (options.token) params.set("token", options.token);
    const query = params.toString();
    const pathname = accountVerificationPath(path);
    return query ? `${pathname}?${query}` : pathname;
  }, [context, registrationId]);

  const breadcrumbs = getAccountVerificationBreadcrumbs(activePath);

  const applyApiResponse = useCallback((data: ApiResponse, fallbackState: AccountVerificationState = "invalid") => {
    const resolvedState = data.state ? responseState(data.state) : fallbackState;
    setState(resolvedState);
    setMessage(data.message ?? "");
    if (data.registrationId) setRegistrationId(data.registrationId);
    if (data.maskedEmail) setMaskedEmail(data.maskedEmail);
    if (data.nextPath) setNextPath(data.nextPath);
    if (data.latestDeliveryState) setLatestDeliveryState(data.latestDeliveryState);
    if (data.latestChallengeState) setLatestChallengeState(data.latestChallengeState);
    setRetryAfterSeconds(data.retryAfterSeconds);
  }, []);

  useEffect(() => {
    if (!registrationId || (node.id === "verification-link" && token)) return;
    let cancelled = false;

    async function loadStatus() {
      setState("loading");
      try {
        const response = await fetch(`/api/identity/account-verification?registration=${encodeURIComponent(registrationId)}`, {
          cache: "no-store",
        });
        const data = (await response.json()) as ApiResponse;
        if (!cancelled) applyApiResponse(data, response.ok ? "pending" : "invalid");
      } catch {
        if (!cancelled) {
          setState("invalid");
          setMessage("Account verification status could not be loaded. Check your connection and try again.");
        }
      }
    }

    void loadStatus();
    return () => { cancelled = true; };
  }, [applyApiResponse, node.id, registrationId, token]);

  useEffect(() => {
    if (node.id !== "verification-link" || !token) return;
    let cancelled = false;

    async function verifyToken() {
      setState("verifying");
      setMessage("");
      try {
        const response = await fetch("/api/identity/account-verification", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "verify", token }),
        });
        const data = (await response.json()) as ApiResponse;
        if (cancelled) return;
        applyApiResponse(data);
        if (response.ok && data.state === "verified") {
          const params = buildVerificationContextSearchParams(context);
          const resolvedRegistration = data.registrationId ?? registrationId;
          if (resolvedRegistration) params.set("registration", resolvedRegistration);
          const clean = `${accountVerificationPath(["verify-email-access", "verification-link"])}?${params.toString()}`;
          window.history.replaceState(window.history.state, "", clean);
        }
      } catch {
        if (!cancelled) {
          setState("invalid");
          setMessage("We could not verify this link right now. Request a new link if the problem continues.");
        }
      }
    }

    void verifyToken();
    return () => { cancelled = true; };
  }, [applyApiResponse, context, node.id, registrationId, token]);

  async function runAction(action: "send" | "resend" | "change_email", extra: Record<string, unknown> = {}) {
    if (!registrationId) {
      setState("invalid");
      setMessage("Start or resume registration before requesting account verification.");
      return;
    }

    setState("requesting");
    setMessage("");
    setRetryAfterSeconds(undefined);
    try {
      const response = await fetch("/api/identity/account-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, registrationId, ...extra }),
      });
      const data = (await response.json()) as ApiResponse;
      applyApiResponse(data, response.ok ? "pending" : "invalid");
      if (response.ok && data.state === "pending") {
        setLatestDeliveryState("sent");
        setLatestChallengeState("issued");
      }
    } catch {
      setState("invalid");
      setMessage("The verification service could not complete this request. Check your connection and try again.");
    }
  }

  function submitEmailChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runAction("change_email", { newEmail });
  }

  function taskLink(path: string[], title: string, description: string) {
    return (
      <Link className={styles.taskCard} href={hrefFor(path)}>
        <strong>{title}</strong>
        <span>{description}</span>
        <b aria-hidden="true">›</b>
      </Link>
    );
  }

  let content: ReactNode;

  if (node.id === "account-verification") {
    content = (
      <>
        <div className={styles.icon} aria-hidden="true">✓</div>
        <p className="eyebrow">Identity &amp; onboarding</p>
        <h1>Account Verification</h1>
        <p className="muted">Prove control of your RFxchange account email before organization onboarding. Verification does not grant organization authority or Exchange access.</p>
        <div className={styles.taskGrid}>
          {taskLink(["verify-email-access"], "Verify Email / Access", "Send, open, resend, or redirect the verification email.")}
        </div>
      </>
    );
  } else if (node.id === "verify-email-access") {
    content = (
      <>
        <div className={styles.icon} aria-hidden="true">✉</div>
        <p className="eyebrow">Account verification</p>
        <h1>Verify Email / Access</h1>
        <p className="muted">Use the source-defined verification workflow below. Each task has its own addressable state so Back/Forward navigation preserves where you are.</p>
        <div className={styles.taskGrid}>
          {taskLink(["verify-email-access", "send"], "Send Verification Email", "Send a one-time link to the pending account email.")}
          {taskLink(["verify-email-access", "verification-link"], "Verification Link", "Open and consume the one-time link received by email.")}
          {taskLink(["verify-email-access", "resend"], "Resend Verification", "Supersede the previous challenge and send a replacement.")}
          {taskLink(["verify-email-access", "change-email"], "Change Email Address", "Replace the pending email, enforce duplicate detection, and send a new link.")}
        </div>
      </>
    );
  } else if (node.id === "send") {
    const delivered = latestDeliveryState === "sent" && latestChallengeState === "issued";
    content = (
      <>
        <div className={styles.icon} aria-hidden="true">✉</div>
        <p className="eyebrow">Verify Email / Access</p>
        <h1>{delivered ? "Check your email" : "Send Verification Email"}</h1>
        {maskedEmail ? <p className={styles.destination}>{maskedEmail}</p> : null}
        <p className="muted">{delivered
          ? "A one-time verification link has been sent. Open it from your email to continue."
          : "Send a one-time verification link to the email attached to this pending RFxchange account."}</p>
        {!registrationId ? (
          <Link className="button button-primary button-full" href="/register">Start registration</Link>
        ) : delivered ? (
          <div className={styles.actions}>
            <Link className="button button-secondary button-full" href={hrefFor(["verify-email-access", "verification-link"])}>Verification link instructions</Link>
            <Link className={styles.textButtonLink} href={hrefFor(["verify-email-access", "resend"])}>Didn't receive it? Resend verification</Link>
            <Link className={styles.textButtonLink} href={hrefFor(["verify-email-access", "change-email"])}>Wrong email? Change email address</Link>
          </div>
        ) : (
          <button className="button button-primary button-full" type="button" onClick={() => void runAction("send")} disabled={state === "requesting" || state === "loading"}>
            {state === "requesting" ? "Sending…" : state === "loading" ? "Loading…" : "Send verification email"}
          </button>
        )}
      </>
    );
  } else if (node.id === "resend") {
    content = (
      <>
        <div className={styles.icon} aria-hidden="true">↻</div>
        <p className="eyebrow">Verify Email / Access</p>
        <h1>Resend Verification</h1>
        {maskedEmail ? <p className={styles.destination}>{maskedEmail}</p> : null}
        <p className="muted">A replacement request supersedes the previous active challenge. Resend throttling prevents repeated delivery abuse.</p>
        {registrationId ? (
          <button className="button button-primary button-full" type="button" onClick={() => void runAction("resend")} disabled={state === "requesting" || state === "loading"}>
            {state === "requesting" ? "Sending…" : "Send replacement link"}
          </button>
        ) : (
          <Link className="button button-primary button-full" href="/register">Return to registration</Link>
        )}
        {retryAfterSeconds ? <p className={styles.notice}>Try again in about {retryAfterSeconds} seconds.</p> : null}
        {state === "pending" && latestDeliveryState === "sent" ? <p className={styles.successNotice}>A replacement verification email has been sent.</p> : null}
      </>
    );
  } else if (node.id === "change-email") {
    content = (
      <>
        <div className={styles.icon} aria-hidden="true">@</div>
        <p className="eyebrow">Verify Email / Access</p>
        <h1>Change Email Address</h1>
        {maskedEmail ? <p className="muted">Current pending email: <strong>{maskedEmail}</strong></p> : null}
        <p className="muted">Changing the address revokes outstanding verification links. The replacement email must not already belong to another RFxchange account.</p>
        {registrationId ? (
          <form onSubmit={submitEmailChange}>
            <label>
              New email address
              <input type="email" autoComplete="email" required value={newEmail} onChange={(event) => setNewEmail(event.target.value)} placeholder="you@company.com" />
            </label>
            <button className="button button-primary button-full" type="submit" disabled={state === "requesting" || !newEmail.trim()}>
              {state === "requesting" ? "Updating…" : "Update email and send verification"}
            </button>
          </form>
        ) : (
          <Link className="button button-primary button-full" href="/register">Return to registration</Link>
        )}
        {state === "pending" && latestDeliveryState === "sent" ? <p className={styles.successNotice}>The account email was updated and a new verification link was sent.</p> : null}
      </>
    );
  } else {
    if (state === "verifying") {
      content = (
        <>
          <div className={`${styles.icon} ${styles.processing}`} aria-hidden="true">↻</div>
          <p className="eyebrow">Verification Link</p>
          <h1>Verifying your account…</h1>
          <p className="muted">RFxchange is consuming this one-time challenge and establishing your onboarding session.</p>
        </>
      );
    } else if (state === "verified") {
      content = (
        <>
          <div className={`${styles.icon} ${styles.success}`} aria-hidden="true">✓</div>
          <p className="eyebrow">Verification Link</p>
          <h1>Email verified</h1>
          {maskedEmail ? <p className={styles.destination}>{maskedEmail}</p> : null}
          <p className="muted">Your account identity is verified. Continue to Organization Selection / Creation; organization authority is resolved there, not here.</p>
          <button className="button button-primary button-full" type="button" onClick={() => router.push(nextPath)}>Continue setup</button>
        </>
      );
    } else if (state === "expired") {
      content = (
        <>
          <div className={`${styles.icon} ${styles.error}`} aria-hidden="true">!</div>
          <p className="eyebrow">Verification Link</p>
          <h1>Verification link expired</h1>
          <p className="muted">{message || "For your security, this one-time link can no longer be used."}</p>
          {registrationId ? <Link className="button button-primary button-full" href={hrefFor(["verify-email-access", "resend"])}>Resend verification</Link> : <Link className="button button-primary button-full" href="/register">Return to registration</Link>}
        </>
      );
    } else if (state === "invalid" && token) {
      content = (
        <>
          <div className={`${styles.icon} ${styles.error}`} aria-hidden="true">!</div>
          <p className="eyebrow">Verification Link</p>
          <h1>We couldn't verify this link</h1>
          <p className="muted">{message || "The link may be invalid, superseded, or already revoked."}</p>
          {registrationId ? <Link className="button button-primary button-full" href={hrefFor(["verify-email-access", "resend"])}>Request a new link</Link> : <Link className="button button-primary button-full" href="/register">Return to registration</Link>}
        </>
      );
    } else {
      content = (
        <>
          <div className={styles.icon} aria-hidden="true">↗</div>
          <p className="eyebrow">Verify Email / Access</p>
          <h1>Verification Link</h1>
          <p className="muted">Open the one-time link from your RFxchange verification email. The token is validated and consumed only by the server; it is not a reusable login credential.</p>
          {registrationId ? <Link className="button button-secondary button-full" href={hrefFor(["verify-email-access", "resend"])}>Need a new link?</Link> : <Link className="button button-primary button-full" href="/register">Start registration</Link>}
        </>
      );
    }
  }

  return (
    <div className={styles.experience}>
      <aside className={styles.workflowNav} aria-label="Account verification workflow">
        <p className={styles.navEyebrow}>Verification workflow</p>
        <ul className={styles.navTree}>
          <WorkflowTree node={accountVerificationTree} path={[]} activePath={activePath} hrefFor={hrefFor} />
        </ul>
        <p className={styles.navBoundary}>Email communication, duplicate detection, token security, sessions, and audit are supporting services—not additional menu destinations.</p>
      </aside>

      <section className={`identity-card ${styles.card}`} aria-live="polite">
        <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
          {breadcrumbs.map((breadcrumb, index) => (
            <span key={breadcrumb.node.id}>
              {index > 0 ? <b aria-hidden="true">/</b> : null}
              {index === breadcrumbs.length - 1
                ? <strong aria-current="page">{breadcrumb.node.label}</strong>
                : <Link href={hrefFor(breadcrumb.path)}>{breadcrumb.node.label}</Link>}
            </span>
          ))}
        </nav>

        {content}

        {state === "configuration_error" ? <p className={styles.errorNotice}>{message || "Account verification services are not configured for this environment."}</p> : null}
        {message && state !== "configuration_error" && state !== "expired" && !(state === "invalid" && token) ? <p className={styles.notice}>{message}</p> : null}
        <p className={styles.boundary}>Account Verification proves control of the account email only. Organization membership, geography, capabilities, commercial membership, and Exchange readiness remain downstream.</p>
        <p className="identity-footer"><Link href="/login">Return to sign in</Link></p>
      </section>
    </div>
  );
}
