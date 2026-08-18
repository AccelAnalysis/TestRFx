"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ORGANIZATION_WORKFLOW_TREE,
  buildOrganizationHref,
  normalizeDomain,
  organizationTypes,
  organizationUserRoles,
  resolutionModeFor,
  type OrganizationAccessReview,
  type OrganizationCandidate,
  type OrganizationClaimReview,
  type OrganizationEntryContext,
  type OrganizationInvitation,
  type OrganizationResolution,
  type OrganizationStep,
  type OrganizationType,
  type OrganizationUserRole,
  type OrganizationWorkflowNode,
} from "@/lib/onboarding/organization";
import styles from "./organization.module.css";

type Props = {
  initialContext: OrganizationEntryContext;
  initialStep: OrganizationStep;
};

type ApiErrorPayload = {
  error?: string;
  code?: string;
  details?: unknown;
};

type WorkflowError = Error & {
  code?: string;
  status?: number;
  details?: unknown;
};

const progress = ["Account", "Organization", "Geography", "Profile", "Capabilities", "Ready"];

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  const payload = (await response.json().catch(() => ({}))) as T & ApiErrorPayload;
  if (!response.ok) {
    const error = new Error(payload.error || "Organization workflow request failed.") as WorkflowError;
    error.code = payload.code;
    error.status = response.status;
    error.details = payload.details;
    throw error;
  }
  return payload;
}

function locationLabel(candidate: OrganizationCandidate) {
  return [candidate.locality, candidate.region].filter(Boolean).join(", ");
}

function roleLabel(role: string | undefined) {
  return organizationUserRoles.find((item) => item.id === role)?.label ?? role?.replaceAll("_", " ") ?? "Not assigned";
}

function sourceLabel(context: OrganizationEntryContext) {
  if (context.invitation) return "Organization invitation";
  if (context.referral) return "Referral";
  if (context.campaign) return `Campaign: ${context.campaign}`;
  if (context.source) return context.source.replaceAll("_", " ");
  return "Direct onboarding";
}

export default function OrganizationSelectionClient({ initialContext, initialStep }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<OrganizationCandidate[]>([]);
  const [selected, setSelected] = useState<OrganizationCandidate | null>(null);
  const [invitation, setInvitation] = useState<OrganizationInvitation | null>(null);
  const [accessReview, setAccessReview] = useState<OrganizationAccessReview | null>(null);
  const [claimReview, setClaimReview] = useState<OrganizationClaimReview | null>(null);
  const [resolution, setResolution] = useState<OrganizationResolution | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const [createName, setCreateName] = useState("");
  const [createType, setCreateType] = useState<OrganizationType>("Business");
  const [createWebsite, setCreateWebsite] = useState("");
  const [authorityConfirmed, setAuthorityConfirmed] = useState(false);
  const [evidenceNote, setEvidenceNote] = useState("");
  const [requestedRole, setRequestedRole] = useState<OrganizationUserRole>("viewer");
  const [reviewOutcome, setReviewOutcome] = useState("");

  const selectedMode = useMemo(() => selected ? resolutionModeFor(selected) : null, [selected]);

  function clearError() {
    setError("");
    setErrorCode("");
  }

  function captureError(caught: unknown) {
    const workflowError = caught as WorkflowError;
    setError(workflowError instanceof Error ? workflowError.message : "Organization workflow request failed.");
    setErrorCode(workflowError.code ?? "request_failed");
  }

  function navigate(step: OrganizationStep, overrides: Partial<OrganizationEntryContext> = {}) {
    clearError();
    router.push(buildOrganizationHref(step, initialContext, overrides));
  }

  function resolutionOverrides(next: OrganizationResolution): Partial<OrganizationEntryContext> {
    return {
      organizationId: next.organizationId,
      requestId: next.requestId,
      claimId: next.claimId,
      invitation: undefined,
    };
  }

  async function loadResolution(redirectFromWelcome = false) {
    setLoading(true);
    clearError();
    try {
      const payload = await requestJson<{ resolution: OrganizationResolution | null }>("/api/onboarding/organizations?state=1");
      setResolution(payload.resolution);
      if (redirectFromWelcome && payload.resolution) {
        router.replace(
          buildOrganizationHref(
            payload.resolution.status === "connected" ? "status.connected" : "status.pending",
            initialContext,
            resolutionOverrides(payload.resolution),
          ),
        );
      }
    } catch (caught) {
      captureError(caught);
    } finally {
      setLoading(false);
    }
  }

  async function loadOrganization(organizationId: string) {
    setLoading(true);
    clearError();
    try {
      const payload = await requestJson<{ organization: OrganizationCandidate }>(
        `/api/onboarding/organizations?id=${encodeURIComponent(organizationId)}`,
      );
      setSelected(payload.organization);
    } catch (caught) {
      captureError(caught);
    } finally {
      setLoading(false);
    }
  }

  async function loadInvitation(token: string) {
    setLoading(true);
    clearError();
    try {
      const payload = await requestJson<{ invitation: OrganizationInvitation }>(
        `/api/onboarding/organizations?invitation=${encodeURIComponent(token)}`,
      );
      setInvitation(payload.invitation);
      setSelected(payload.invitation.organization);
    } catch (caught) {
      captureError(caught);
    } finally {
      setLoading(false);
    }
  }

  async function loadAccessReview(requestId: string) {
    setLoading(true);
    clearError();
    try {
      const payload = await requestJson<{ review: OrganizationAccessReview }>(
        `/api/onboarding/organizations?request=${encodeURIComponent(requestId)}`,
      );
      setAccessReview(payload.review);
    } catch (caught) {
      captureError(caught);
    } finally {
      setLoading(false);
    }
  }

  async function loadClaimReview(claimId: string) {
    setLoading(true);
    clearError();
    try {
      const payload = await requestJson<{ review: OrganizationClaimReview }>(
        `/api/onboarding/organizations?claim=${encodeURIComponent(claimId)}`,
      );
      setClaimReview(payload.review);
    } catch (caught) {
      captureError(caught);
    } finally {
      setLoading(false);
    }
  }

  async function runSearch(value = query, domain = "") {
    setLoading(true);
    clearError();
    try {
      const params = new URLSearchParams();
      if (value.trim()) params.set("q", value.trim());
      if (domain) params.set("domain", domain);
      const payload = await requestJson<{ organizations: OrganizationCandidate[] }>(
        `/api/onboarding/organizations?${params.toString()}`,
      );
      setResults(payload.organizations);
      return payload.organizations;
    } catch (caught) {
      captureError(caught);
      setResults([]);
      return [];
    } finally {
      setLoading(false);
    }
  }

  async function postWorkflow<T>(body: Record<string, unknown>) {
    setLoading(true);
    clearError();
    try {
      return await requestJson<T>("/api/onboarding/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, context: initialContext }),
      });
    } catch (caught) {
      captureError(caught);
      throw caught;
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (initialStep === "welcome") {
      void loadResolution(true);
      return;
    }
    if ((initialStep === "status.pending" || initialStep === "status.connected") && !resolution) {
      void loadResolution(false);
      return;
    }
    if (initialStep === "invitation.review" && initialContext.invitation) {
      void loadInvitation(initialContext.invitation);
      return;
    }
    if (initialStep === "access.review" && initialContext.requestId) {
      void loadAccessReview(initialContext.requestId);
      return;
    }
    if (initialStep === "claim.review" && initialContext.claimId) {
      void loadClaimReview(initialContext.claimId);
      return;
    }
    if (
      (initialStep === "existing.review" || initialStep === "existing.claim" || initialStep === "existing.join") &&
      initialContext.organizationId &&
      selected?.id !== initialContext.organizationId
    ) {
      void loadOrganization(initialContext.organizationId);
    }
  // The route props are the navigation state; these loaders intentionally run when that state changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialStep, initialContext.organizationId, initialContext.invitation, initialContext.requestId, initialContext.claimId]);

  function chooseExisting(candidate: OrganizationCandidate) {
    setSelected(candidate);
    navigate("existing.review", { organizationId: candidate.id });
  }

  async function beginCreateDuplicateCheck() {
    if (!createName.trim()) {
      setError("Enter the organization name before continuing.");
      return;
    }
    const matches = await runSearch(createName, normalizeDomain(createWebsite));
    if (matches.length) {
      navigate("create.duplicates");
    } else {
      navigate("create.authority");
    }
  }

  async function acceptCurrentInvitation() {
    if (!initialContext.invitation) return;
    try {
      const payload = await postWorkflow<{ resolution: OrganizationResolution }>({
        action: "accept_invitation",
        invitationToken: initialContext.invitation,
      });
      setResolution(payload.resolution);
      navigate("status.connected", resolutionOverrides(payload.resolution));
    } catch {
      // postWorkflow has already surfaced the actionable error.
    }
  }

  async function submitAccessRequest() {
    if (!selected) return;
    try {
      const payload = await postWorkflow<{ resolution: OrganizationResolution }>({
        action: "request_access",
        organizationId: selected.id,
        requestedRole,
      });
      setResolution(payload.resolution);
      navigate("status.pending", resolutionOverrides(payload.resolution));
    } catch {
      // postWorkflow has already surfaced the actionable error.
    }
  }

  async function submitClaim(authorityMethod: "domain_email" | "manual_review") {
    if (!selected) return;
    try {
      const payload = await postWorkflow<{ resolution: OrganizationResolution }>({
        action: "claim",
        organizationId: selected.id,
        authorityMethod,
        evidenceNote,
      });
      setResolution(payload.resolution);
      navigate(payload.resolution.status === "connected" ? "status.connected" : "status.pending", resolutionOverrides(payload.resolution));
    } catch {
      // postWorkflow has already surfaced the actionable error.
    }
  }

  async function createCurrentOrganization() {
    try {
      const payload = await postWorkflow<{ resolution: OrganizationResolution }>({
        action: "create",
        name: createName,
        type: createType,
        website: createWebsite,
      });
      setResolution(payload.resolution);
      navigate("status.connected", resolutionOverrides(payload.resolution));
    } catch (caught) {
      const workflowError = caught as WorkflowError;
      if (workflowError.code === "duplicate_organization" && workflowError.details && typeof workflowError.details === "object") {
        const duplicateDetails = workflowError.details as { organizations?: OrganizationCandidate[] };
        if (duplicateDetails.organizations?.length) setResults(duplicateDetails.organizations);
        navigate("create.duplicates");
      }
    }
  }

  async function decideAccess(decision: "approve" | "deny") {
    if (!initialContext.requestId) return;
    try {
      const payload = await postWorkflow<{ review: { status: string } }>({
        action: "review_access",
        requestId: initialContext.requestId,
        decision,
      });
      setReviewOutcome(payload.review.status);
    } catch {
      // postWorkflow has already surfaced the actionable error.
    }
  }

  async function decideClaim(decision: "approve" | "deny") {
    if (!initialContext.claimId) return;
    try {
      const payload = await postWorkflow<{ review: { status: string } }>({
        action: "review_claim",
        claimId: initialContext.claimId,
        decision,
      });
      setReviewOutcome(payload.review.status);
    } catch {
      // postWorkflow has already surfaced the actionable error.
    }
  }

  function canNavigate(step: OrganizationStep | undefined) {
    if (!step) return false;
    if (["welcome", "affiliation", "existing.search", "create.identity", "status.pending", "status.connected"].includes(step)) return true;
    if (step === "invitation.review") return Boolean(initialContext.invitation);
    if (step === "access.review") return Boolean(initialContext.requestId);
    if (step === "claim.review") return Boolean(initialContext.claimId);
    if (["existing.review", "existing.claim", "existing.join"].includes(step)) return Boolean(selected || initialContext.organizationId);
    if (["create.duplicates", "create.authority", "create.confirm"].includes(step)) return Boolean(createName.trim());
    return false;
  }

  function renderTree(nodes: readonly OrganizationWorkflowNode[], depth = 0) {
    return (
      <ul className={depth === 0 ? styles.treeRoot : styles.treeChildren}>
        {nodes.map((node) => {
          const active = node.step === initialStep;
          const available = canNavigate(node.step);
          return (
            <li key={node.id}>
              {node.step ? (
                <button
                  type="button"
                  className={`${styles.treeItem} ${active ? styles.treeActive : ""}`}
                  style={{ paddingLeft: `${12 + depth * 14}px` }}
                  disabled={!available}
                  onClick={() => available && navigate(node.step!)}
                  aria-current={active ? "step" : undefined}
                >
                  <span>{active ? "●" : available ? "○" : "·"}</span>
                  <strong>{node.label}</strong>
                </button>
              ) : (
                <div className={styles.treeGroup} style={{ paddingLeft: `${12 + depth * 14}px` }}>{node.label}</div>
              )}
              {node.children ? renderTree(node.children, depth + 1) : null}
            </li>
          );
        })}
      </ul>
    );
  }

  function serviceError() {
    if (!error) return null;
    return (
      <div className={styles.error} role="alert">
        <strong>{errorCode === "database_not_configured" ? "Database configuration required" : "This step needs attention"}</strong>
        <span>{error}</span>
        {errorCode === "verification_required" ? <Link href="/onboarding/account-verification">Verify account</Link> : null}
      </div>
    );
  }

  function candidateCard(candidate: OrganizationCandidate, action = "Review") {
    return (
      <button key={candidate.id} className={styles.resultCard} type="button" onClick={() => chooseExisting(candidate)}>
        <div>
          <strong>{candidate.name}</strong>
          <p>{candidate.type}</p>
          <small>{locationLabel(candidate) || "Location completed in Geography"}{candidate.domain ? ` • ${candidate.domain}` : ""}</small>
        </div>
        <span className={`${styles.stateBadge} ${candidate.claimState === "unclaimed" ? styles.unclaimed : ""}`}>
          {candidate.claimState === "unclaimed" ? "Unclaimed" : candidate.claimState === "verified" ? "Verified" : action}
        </span>
      </button>
    );
  }

  function currentContent() {
    if (initialStep === "welcome") {
      return (
        <>
          <p className="eyebrow">Organization setup</p>
          <h1>Welcome. Establish your organization role.</h1>
          <p className={styles.lead}>Your verified RFxchange identity participates through an organization. The role is established by the path you take, not by an unverified client-side flag.</p>
          <div className={styles.contextStrip}>
            <span>Entry context</span>
            <strong>{sourceLabel(initialContext)}</strong>
          </div>
          <div className={styles.roleGrid}>
            <div><strong>Create an organization</strong><span>You become Primary Administrator when the canonical organization is created.</span></div>
            <div><strong>Join an existing organization</strong><span>You request an organization role; an existing administrator approves access.</span></div>
            <div><strong>Accept an invitation</strong><span>The invitation carries the organization and assigned role, then RFxchange validates both.</span></div>
          </div>
          {initialContext.invitation ? (
            <button className={styles.primary} type="button" onClick={() => navigate("invitation.review")}>Review organization invitation</button>
          ) : (
            <button className={styles.primary} type="button" onClick={() => navigate("affiliation")}>Continue to organization affiliation</button>
          )}
          {loading ? <p className={styles.inlineStatus}>Checking saved organization state…</p> : null}
          {serviceError()}
        </>
      );
    }

    if (initialStep === "affiliation") {
      return (
        <>
          <button className={styles.back} type="button" onClick={() => navigate("welcome")}>← Welcome / role selection</button>
          <p className="eyebrow">Organization affiliation</p>
          <h1>Which organization are you joining RFxchange with?</h1>
          <p className={styles.lead}>Resolve an existing canonical organization before creating a new one. This prevents duplicate tenants and preserves seeded organization identities.</p>
          <div className={styles.choiceGrid}>
            <button className={styles.choiceCard} type="button" onClick={() => navigate("existing.search")}>
              <span className={styles.choiceIcon}>⌕</span><strong>Find my organization</strong><small>Search, claim an unclaimed record, or request access to an existing organization.</small><b>Open workflow →</b>
            </button>
            <button className={styles.choiceCard} type="button" onClick={() => navigate("create.identity")}>
              <span className={styles.choiceIcon}>＋</span><strong>Create a new organization</strong><small>Use only after duplicate/entity resolution confirms the organization is not already represented.</small><b>Open workflow →</b>
            </button>
          </div>
          {initialContext.invitation ? <button className={styles.secondary} type="button" onClick={() => navigate("invitation.review")}>Use my organization invitation</button> : null}
          {serviceError()}
        </>
      );
    }

    if (initialStep === "existing.search") {
      return (
        <>
          <button className={styles.back} type="button" onClick={() => navigate("affiliation")}>← Organization affiliation</button>
          <p className="eyebrow">Find / join existing</p>
          <h1>Search canonical organizations</h1>
          <p className={styles.lead}>Search by organization name, alias, or website domain. Results come from the RFxchange organization repository rather than seeded browser data.</p>
          <div className={styles.searchRow}>
            <input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void runSearch(); }} placeholder="Organization name or domain" aria-label="Organization name or domain" />
            <button type="button" onClick={() => void runSearch()} disabled={loading}>{loading ? "Searching…" : "Search"}</button>
          </div>
          <div className={styles.results} aria-live="polite">
            {results.map((candidate) => candidateCard(candidate))}
            {!loading && query && results.length === 0 && !error ? (
              <div className={styles.empty}><strong>No matching organization found.</strong><p>Continue into the create workflow; the server rechecks duplicates again before it commits a new organization.</p><button type="button" onClick={() => navigate("create.identity")}>Create new organization</button></div>
            ) : null}
          </div>
          {serviceError()}
        </>
      );
    }

    if (initialStep === "existing.review") {
      return (
        <>
          <button className={styles.back} type="button" onClick={() => navigate("existing.search")}>← Search organizations</button>
          <p className="eyebrow">Existing organization / Review</p>
          <h1>Is this your organization?</h1>
          {selected ? (
            <>
              <div className={styles.reviewCard}><div className={styles.monogram}>{selected.name.slice(0, 2).toUpperCase()}</div><div><h2>{selected.name}</h2><p>{selected.type}</p><p>{locationLabel(selected)}</p>{selected.website ? <small>{selected.website.replace(/^https?:\/\//, "")}</small> : null}</div></div>
              <div className={styles.notice}>
                <strong>{selectedMode === "claim" ? "Unclaimed canonical organization" : "Existing organization account"}</strong>
                <span>{selectedMode === "claim" ? "Continue to authority validation. RFxchange keeps this organization ID instead of creating a duplicate." : "Continue to request a role. Existing administrators retain control until they approve your membership."}</span>
              </div>
              <button className={styles.primary} type="button" onClick={() => navigate(selectedMode === "claim" ? "existing.claim" : "existing.join", { organizationId: selected.id })}>{selectedMode === "claim" ? "Continue to claim & authority" : "Continue to access request"}</button>
              <button className={styles.secondary} type="button" onClick={() => navigate("existing.search")}>This is not my organization</button>
            </>
          ) : <p className={styles.inlineStatus}>{loading ? "Loading organization…" : "Select an organization from search first."}</p>}
          {serviceError()}
        </>
      );
    }

    if (initialStep === "existing.claim") {
      return (
        <>
          <button className={styles.back} type="button" onClick={() => navigate("existing.review")}>← Organization review</button>
          <p className="eyebrow">Existing organization / Claim & authority</p>
          <h1>Establish authority to claim this organization</h1>
          {selected ? (
            <>
              <div className={styles.contextStrip}><span>Organization</span><strong>{selected.name}</strong>{selected.domain ? <small>Primary domain: {selected.domain}</small> : null}</div>
              <div className={styles.methodGrid}>
                <div className={styles.methodCard}><strong>Verified organization-domain email</strong><span>If your verified account email matches the organization's stored domain, RFxchange can approve the claim immediately.</span><button type="button" onClick={() => void submitClaim("domain_email")} disabled={loading}>Verify domain authority</button></div>
                <div className={styles.methodCard}><strong>Administrative review</strong><span>Submit a concise authority note when domain verification is unavailable. Competing claims remain separate records for platform review.</span><textarea rows={4} value={evidenceNote} onChange={(event) => setEvidenceNote(event.target.value)} placeholder="Your relationship to the organization and basis for authority" /><button type="button" onClick={() => void submitClaim("manual_review")} disabled={loading || evidenceNote.trim().length < 10}>Submit for review</button></div>
              </div>
            </>
          ) : <p className={styles.inlineStatus}>{loading ? "Loading organization…" : "Return to organization search and select the organization to claim."}</p>}
          {serviceError()}
        </>
      );
    }

    if (initialStep === "existing.join") {
      return (
        <>
          <button className={styles.back} type="button" onClick={() => navigate("existing.review")}>← Organization review</button>
          <p className="eyebrow">Existing organization / Request access</p>
          <h1>Request your organization role</h1>
          {selected ? (
            <>
              <div className={styles.contextStrip}><span>Organization</span><strong>{selected.name}</strong></div>
              <label className={styles.field}>Requested role
                <select value={requestedRole} onChange={(event) => setRequestedRole(event.target.value as OrganizationUserRole)}>
                  {organizationUserRoles.map((role) => <option key={role.id} value={role.id}>{role.label}</option>)}
                </select>
              </label>
              <div className={styles.roleDescription}>{organizationUserRoles.find((role) => role.id === requestedRole)?.description}</div>
              <div className={styles.notice}><strong>Existing-admin approval required</strong><span>Submitting does not grant access. RFxchange creates a durable request that an authorized member of this organization can approve or deny.</span></div>
              <button className={styles.primary} type="button" onClick={() => void submitAccessRequest()} disabled={loading}>{loading ? "Submitting…" : "Request organization access"}</button>
            </>
          ) : <p className={styles.inlineStatus}>{loading ? "Loading organization…" : "Return to organization search and select the organization to join."}</p>}
          {serviceError()}
        </>
      );
    }

    if (initialStep === "invitation.review") {
      return (
        <>
          <button className={styles.back} type="button" onClick={() => navigate("affiliation", { invitation: undefined })}>← Organization affiliation</button>
          <p className="eyebrow">Referral / invitation</p>
          <h1>Validate invitation and confirm access</h1>
          {invitation ? (
            <>
              <div className={styles.reviewCard}><div className={styles.monogram}>{invitation.organization.name.slice(0, 2).toUpperCase()}</div><div><h2>{invitation.organization.name}</h2><p>{invitation.organization.type}</p><small>Invitation expires {new Date(invitation.expiresAt).toLocaleString()}</small></div></div>
              <dl className={styles.summary}><div><dt>Invited account</dt><dd>{invitation.invitedEmail}</dd></div><div><dt>Assigned role</dt><dd>{roleLabel(invitation.role)}</dd></div><div><dt>Validation</dt><dd>Verified email + one-time invitation</dd></div></dl>
              <div className={styles.notice}><strong>Accept and join organization</strong><span>Acceptance consumes this invitation, creates the real organization membership, applies the assigned role, and records the event.</span></div>
              <button className={styles.primary} type="button" onClick={() => void acceptCurrentInvitation()} disabled={loading}>{loading ? "Accepting…" : `Accept invitation as ${roleLabel(invitation.role)}`}</button>
            </>
          ) : <p className={styles.inlineStatus}>{loading ? "Validating invitation…" : "A valid organization invitation is required for this route."}</p>}
          {serviceError()}
        </>
      );
    }

    if (initialStep === "create.identity") {
      return (
        <>
          <button className={styles.back} type="button" onClick={() => navigate("affiliation")}>← Organization affiliation</button>
          <p className="eyebrow">Create new organization / Identity</p>
          <h1>Establish the minimum canonical identity</h1>
          <p className={styles.lead}>This step intentionally collects only the fields needed to resolve duplicates and establish tenancy. Description, industry/NAICS, contact details, Geography, and visibility already have concrete downstream onboarding workflows.</p>
          <label className={styles.field}>Organization name *<input value={createName} onChange={(event) => setCreateName(event.target.value)} placeholder="Legal or commonly used name" /></label>
          <label className={styles.field}>Organization type *<select value={createType} onChange={(event) => setCreateType(event.target.value as OrganizationType)}>{organizationTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
          <label className={styles.field}>Website or domain<input value={createWebsite} onChange={(event) => setCreateWebsite(event.target.value)} placeholder="example.com" /></label>
          <button className={styles.primary} type="button" onClick={() => void beginCreateDuplicateCheck()} disabled={loading}>{loading ? "Checking canonical organizations…" : "Check duplicates and continue"}</button>
          {serviceError()}
        </>
      );
    }

    if (initialStep === "create.duplicates") {
      return (
        <>
          <button className={styles.back} type="button" onClick={() => navigate("create.identity")}>← Organization identity</button>
          <p className="eyebrow">Create new organization / Duplicate resolution</p>
          <h1>Resolve possible existing organizations</h1>
          {createName ? <p className={styles.lead}>RFxchange found candidates for <strong>{createName}</strong>. Select the canonical organization when it represents the same entity.</p> : <p className={styles.lead}>Return to Organization identity and run the duplicate check to populate this branch.</p>}
          <div className={styles.results}>{results.map((candidate) => candidateCard(candidate, "Review"))}</div>
          {createName ? <button className={styles.secondary} type="button" onClick={() => navigate("create.authority")}>None of these represent my organization</button> : <button className={styles.primary} type="button" onClick={() => navigate("create.identity")}>Return to identity</button>}
          {serviceError()}
        </>
      );
    }

    if (initialStep === "create.authority") {
      return (
        <>
          <button className={styles.back} type="button" onClick={() => navigate("create.identity")}>← Organization identity</button>
          <p className="eyebrow">Create new organization / Authority</p>
          <h1>Confirm your authority to establish the account</h1>
          {createName ? (
            <>
              <div className={styles.contextStrip}><span>Organization</span><strong>{createName}</strong><small>{createType}{createWebsite ? ` • ${normalizeDomain(createWebsite)}` : ""}</small></div>
              <label className={styles.confirmRow}><input type="checkbox" checked={authorityConfirmed} onChange={(event) => setAuthorityConfirmed(event.target.checked)} /><span><strong>I am authorized to establish or begin establishing this organization on RFxchange.</strong><small>This is an administrative authority representation. It does not create a public RFxchange “Verified” trust status.</small></span></label>
              <button className={styles.primary} type="button" disabled={!authorityConfirmed} onClick={() => navigate("create.confirm")}>Review organization creation</button>
            </>
          ) : <div className={styles.empty}><strong>Organization identity is required.</strong><p>Return to the first child step so RFxchange can perform duplicate resolution before authority confirmation.</p><button type="button" onClick={() => navigate("create.identity")}>Return to identity</button></div>}
        </>
      );
    }

    if (initialStep === "create.confirm") {
      return (
        <>
          <button className={styles.back} type="button" onClick={() => navigate("create.authority")}>← Authority confirmation</button>
          <p className="eyebrow">Create new organization / Confirm</p>
          <h1>Create and establish membership?</h1>
          {createName && authorityConfirmed ? (
            <>
              <div className={styles.reviewCard}><div className={styles.monogram}>{createName.slice(0, 2).toUpperCase()}</div><div><h2>{createName}</h2><p>{createType}</p>{createWebsite ? <small>{normalizeDomain(createWebsite)}</small> : null}</div></div>
              <dl className={styles.summary}><div><dt>Initial role</dt><dd>Primary Administrator</dd></div><div><dt>Duplicate guard</dt><dd>Server recheck on commit</dd></div><div><dt>Next workflow</dt><dd>Geography</dd></div></dl>
              <button className={styles.primary} type="button" onClick={() => void createCurrentOrganization()} disabled={loading}>{loading ? "Creating organization…" : "Create organization"}</button>
            </>
          ) : <div className={styles.empty}><strong>Complete the earlier create steps first.</strong><p>Organization creation cannot bypass duplicate resolution or the authority representation.</p><button type="button" onClick={() => navigate("create.identity")}>Start create workflow</button></div>}
          {serviceError()}
        </>
      );
    }

    if (initialStep === "status.pending") {
      return (
        <>
          <p className="eyebrow">Organization status</p>
          <h1>{resolution?.organizationName ?? "Organization resolution pending"}</h1>
          {resolution ? (
            <>
              <p className={styles.lead}>{resolution.mode === "join" ? "Your organization access request is waiting for an existing administrator to approve the requested role." : "Your organization claim is waiting for authority review. Competing claims remain separate until an authorized reviewer resolves them."}</p>
              <dl className={styles.summary}><div><dt>Membership</dt><dd>{resolution.membershipState}</dd></div><div><dt>Authority</dt><dd>{resolution.authorityState}</dd></div><div><dt>Requested role</dt><dd>{roleLabel(resolution.role)}</dd></div></dl>
              {resolution.requestId ? <div className={styles.idBox}>Access request: <code>{resolution.requestId}</code></div> : null}
              {resolution.claimId ? <div className={styles.idBox}>Claim: <code>{resolution.claimId}</code></div> : null}
              <button className={styles.primary} type="button" onClick={() => void loadResolution(false)} disabled={loading}>{loading ? "Refreshing…" : "Refresh status"}</button>
              <button className={styles.secondary} type="button" onClick={() => navigate("affiliation")}>Choose a different organization</button>
            </>
          ) : <p className={styles.inlineStatus}>{loading ? "Loading saved organization state…" : "No pending organization resolution was found for this verified account."}</p>}
          {serviceError()}
        </>
      );
    }

    if (initialStep === "status.connected") {
      return (
        <>
          <p className="eyebrow">Organization connected</p>
          <div className={styles.successMark}>✓</div>
          <h1>{resolution?.organizationName ?? "Organization connection"}</h1>
          {resolution ? (
            <>
              <p className={styles.lead}>The canonical organization and your organization-membership context are established. Continue into the existing Geography child of the Identity & Onboarding Shell.</p>
              <dl className={styles.summary}><div><dt>Organization type</dt><dd>{resolution.organizationType}</dd></div><div><dt>Role</dt><dd>{roleLabel(resolution.role)}</dd></div><div><dt>Authority</dt><dd>{resolution.authorityState}</dd></div></dl>
              <div className={styles.handoffChain}><strong>Concrete downstream handoff</strong><span>Geography → Organization Profile → Capability Enrichment → Exchange-ready completion</span><small>Location, description, industry/NAICS, contact information, visibility preferences, and AMACS enrichment are not duplicated in this module because those routes already exist downstream.</small></div>
              <Link className={styles.primaryLink} href={resolution.nextPath}>Continue to Geography →</Link>
            </>
          ) : <p className={styles.inlineStatus}>{loading ? "Loading saved organization state…" : "No connected organization was found for this verified account."}</p>}
          {serviceError()}
        </>
      );
    }

    if (initialStep === "access.review") {
      return (
        <>
          <p className="eyebrow">Existing-admin approval</p>
          <h1>Review organization access request</h1>
          {accessReview ? (
            <>
              <div className={styles.reviewCard}><div className={styles.monogram}>{accessReview.requesterName.slice(0, 2).toUpperCase()}</div><div><h2>{accessReview.requesterName}</h2><p>{accessReview.requesterEmail}</p><small>Requested {roleLabel(accessReview.requestedRole)} • {new Date(accessReview.createdAt).toLocaleString()}</small></div></div>
              <div className={styles.contextStrip}><span>Organization</span><strong>{accessReview.organization.name}</strong></div>
              {reviewOutcome ? <div className={styles.outcome}>Request {reviewOutcome}. The requester's durable onboarding state was updated.</div> : <div className={styles.reviewActions}><button type="button" className={styles.primary} onClick={() => void decideAccess("approve")} disabled={loading}>Approve access</button><button type="button" className={styles.danger} onClick={() => void decideAccess("deny")} disabled={loading}>Deny request</button></div>}
            </>
          ) : <p className={styles.inlineStatus}>{loading ? "Loading access request…" : "A valid access request and authorized organization administrator are required for this route."}</p>}
          {serviceError()}
        </>
      );
    }

    if (initialStep === "claim.review") {
      return (
        <>
          <p className="eyebrow">Platform claim review</p>
          <h1>Resolve organization authority claim</h1>
          {claimReview ? (
            <>
              <div className={styles.contextStrip}><span>Canonical organization</span><strong>{claimReview.organization.name}</strong><small>{claimReview.claims.length > 1 ? `${claimReview.claims.length} competing active claims` : "One active claim"}</small></div>
              <div className={styles.claimList}>
                {claimReview.claims.map((claim) => (
                  <div className={`${styles.claimCard} ${claim.claimId === claimReview.selectedClaimId ? styles.claimSelected : ""}`} key={claim.claimId}>
                    <div><strong>{claim.claimantName}</strong><span>{claim.claimantEmail}</span><small>{claim.authorityMethod.replaceAll("_", " ")} • {claim.status} • {new Date(claim.createdAt).toLocaleString()}</small>{claim.evidenceNote ? <p>{claim.evidenceNote}</p> : null}</div>
                    {claim.claimId !== claimReview.selectedClaimId ? <button type="button" onClick={() => navigate("claim.review", { claimId: claim.claimId })}>Review this claim</button> : <b>Selected</b>}
                  </div>
                ))}
              </div>
              {reviewOutcome ? <div className={styles.outcome}>Claim {reviewOutcome}. Canonical membership and competing-claim state were updated transactionally.</div> : <div className={styles.reviewActions}><button type="button" className={styles.primary} onClick={() => void decideClaim("approve")} disabled={loading}>Approve selected claim</button><button type="button" className={styles.danger} onClick={() => void decideClaim("deny")} disabled={loading}>Deny selected claim</button></div>}
            </>
          ) : <p className={styles.inlineStatus}>{loading ? "Loading claim review…" : "A valid claim and platform administrator authorization are required for this route."}</p>}
          {serviceError()}
        </>
      );
    }

    return <div className={styles.empty}><strong>Unknown organization workflow step.</strong><button type="button" onClick={() => navigate("welcome")}>Return to welcome</button></div>;
  }

  return (
    <main className={styles.shell}>
      <section className={styles.frame}>
        <header className={styles.header}>
          <Link href="/" className={styles.brand}>RFxchange</Link>
          <Link href="/onboarding" className={styles.help}>Onboarding overview</Link>
        </header>

        <ol className={styles.progress} aria-label="Onboarding progress">
          {progress.map((step, index) => (
            <li key={step} className={index < 1 ? styles.done : index === 1 ? styles.current : ""}>
              <span>{index < 1 ? "✓" : index + 1}</span><small>{step}</small>
            </li>
          ))}
        </ol>

        <div className={styles.workspace}>
          <aside className={styles.workflowNav} aria-label="Organization onboarding workflow">
            <div className={styles.workflowTitle}><span>Organization</span><strong>Workflow tree</strong></div>
            {renderTree(ORGANIZATION_WORKFLOW_TREE)}
            <div className={styles.navBoundary}><strong>Shell boundary</strong><span>Geography and later enrichment are separate Identity & Onboarding modules.</span></div>
          </aside>
          <section className={styles.panel}>{currentContent()}</section>
        </div>
      </section>
    </main>
  );
}
