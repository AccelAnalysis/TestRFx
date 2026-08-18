"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  createReferenceResolution,
  normalizeDomain,
  organizationTypes,
  resolutionModeFor,
  type OrganizationCandidate,
  type OrganizationResolution,
  type OrganizationType,
} from "@/lib/onboarding/organization";
import styles from "./organization.module.css";

type View = "choice" | "search" | "review-existing" | "create" | "duplicates" | "review-create" | "complete";

interface OrganizationSearchResponse {
  organizations: OrganizationCandidate[];
  referenceOnly: boolean;
}

const progress = ["Account", "Organization", "Geography", "Profile", "Capabilities", "Ready"];

function saveReferenceResolution(resolution: OrganizationResolution) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(
    "rfxchange.onboarding.organization",
    JSON.stringify({ ...resolution, savedAt: new Date().toISOString() }),
  );
}

export default function OrganizationSelectionClient() {
  const [view, setView] = useState<View>("choice");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<OrganizationCandidate[]>([]);
  const [selected, setSelected] = useState<OrganizationCandidate | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resolution, setResolution] = useState<OrganizationResolution | null>(null);
  const [createName, setCreateName] = useState("");
  const [createType, setCreateType] = useState<OrganizationType>("Business");
  const [createWebsite, setCreateWebsite] = useState("");

  const selectedAction = useMemo(() => {
    if (!selected) return null;
    return resolutionModeFor(selected) === "claim" ? "Claim this organization" : "Request access";
  }, [selected]);

  async function runSearch(value = query, domain = "") {
    setError("");
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (value.trim()) params.set("q", value.trim());
      if (domain) params.set("domain", domain);
      const response = await fetch(`/api/onboarding/organizations?${params.toString()}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Organization search is unavailable.");
      const payload = (await response.json()) as OrganizationSearchResponse;
      setResults(payload.organizations);
      return payload.organizations;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Organization search is unavailable.");
      setResults([]);
      return [];
    } finally {
      setLoading(false);
    }
  }

  function chooseExisting(candidate: OrganizationCandidate) {
    setSelected(candidate);
    setView("review-existing");
  }

  function finishExisting() {
    if (!selected) return;
    const next = createReferenceResolution({ mode: resolutionModeFor(selected), candidate: selected });
    saveReferenceResolution(next);
    setResolution(next);
    setView("complete");
  }

  async function checkCreateDuplicates() {
    if (!createName.trim()) {
      setError("Enter the organization name before continuing.");
      return;
    }

    const domain = normalizeDomain(createWebsite);
    const matches = await runSearch(createName, domain);
    if (matches.length) {
      setView("duplicates");
      return;
    }
    setView("review-create");
  }

  function finishCreate() {
    const next = createReferenceResolution({
      mode: "create",
      name: createName,
      type: createType,
      website: createWebsite,
    });
    saveReferenceResolution(next);
    setResolution(next);
    setView("complete");
  }

  function resetToChoice() {
    setView("choice");
    setSelected(null);
    setResults([]);
    setError("");
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
              <span>{index < 1 ? "✓" : index + 1}</span>
              <small>{step}</small>
            </li>
          ))}
        </ol>

        <div className={styles.panel}>
          {view === "choice" && (
            <>
              <p className="eyebrow">Organization</p>
              <h1>Connect your organization</h1>
              <p className={styles.lead}>RFxchange needs one canonical organization identity before geography, profile, and capability enrichment begin.</p>
              <div className={styles.choiceGrid}>
                <button className={styles.choiceCard} onClick={() => setView("search")}>
                  <span className={styles.choiceIcon}>⌕</span>
                  <strong>Find my organization</strong>
                  <small>Search for an existing or seeded organization in the Exchange.</small>
                  <b>Continue →</b>
                </button>
                <button className={styles.choiceCard} onClick={() => setView("create")}>
                  <span className={styles.choiceIcon}>＋</span>
                  <strong>Create a new organization</strong>
                  <small>Use this only when the organization is not already represented.</small>
                  <b>Continue →</b>
                </button>
              </div>
              <p className={styles.boundary}>Organization selection establishes identity and membership context only. Geography, profile details, AMACS capabilities, verification, and commercial entitlements remain later onboarding stages.</p>
            </>
          )}

          {view === "search" && (
            <>
              <button className={styles.back} onClick={resetToChoice}>← Organization options</button>
              <p className="eyebrow">Find an organization</p>
              <h1>Search before creating</h1>
              <p className={styles.lead}>Use the organization name, alias, or website domain. Seeded records should be claimed instead of duplicated.</p>
              <div className={styles.searchRow}>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => { if (event.key === "Enter") void runSearch(); }}
                  placeholder="Organization name or domain"
                  aria-label="Organization name or domain"
                />
                <button onClick={() => void runSearch()} disabled={loading}>{loading ? "Searching…" : "Search"}</button>
              </div>
              {error && <p className={styles.error}>{error}</p>}
              <div className={styles.results} aria-live="polite">
                {!loading && results.length === 0 && query && !error && (
                  <div className={styles.empty}>
                    <strong>No matching organization found.</strong>
                    <p>You can create a new organization without abandoning this onboarding session.</p>
                    <button onClick={() => setView("create")}>Create new organization</button>
                  </div>
                )}
                {results.map((candidate) => (
                  <button key={candidate.id} className={styles.resultCard} onClick={() => chooseExisting(candidate)}>
                    <div>
                      <strong>{candidate.name}</strong>
                      <p>{candidate.type}</p>
                      <small>{[candidate.locality, candidate.region].filter(Boolean).join(", ")} {candidate.domain ? `• ${candidate.domain}` : ""}</small>
                    </div>
                    <span className={`${styles.stateBadge} ${candidate.claimState === "unclaimed" ? styles.unclaimed : ""}`}>
                      {candidate.claimState === "unclaimed" ? "Unclaimed" : candidate.claimState === "verified" ? "Verified" : "Existing"}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}

          {view === "review-existing" && selected && (
            <>
              <button className={styles.back} onClick={() => setView("search")}>← Search results</button>
              <p className="eyebrow">Confirm organization</p>
              <h1>Is this your organization?</h1>
              <div className={styles.reviewCard}>
                <div className={styles.monogram}>{selected.name.slice(0, 2).toUpperCase()}</div>
                <div>
                  <h2>{selected.name}</h2>
                  <p>{selected.type}</p>
                  <p>{[selected.locality, selected.region].filter(Boolean).join(", ")}</p>
                  {selected.website && <small>{selected.website.replace(/^https?:\/\//, "")}</small>}
                </div>
              </div>
              <div className={styles.notice}>
                {selected.claimState === "unclaimed" ? (
                  <><strong>This is a seeded, unclaimed organization.</strong><span>Claiming preserves the canonical organization ID and starts authority resolution instead of creating a duplicate tenant.</span></>
                ) : (
                  <><strong>This organization already has an RFxchange identity.</strong><span>Your access request creates a pending membership boundary; it does not grant administrative authority by itself.</span></>
                )}
              </div>
              <button className={styles.primary} onClick={finishExisting}>{selectedAction}</button>
              <button className={styles.secondary} onClick={() => setView("search")}>This is not my organization</button>
            </>
          )}

          {view === "create" && (
            <>
              <button className={styles.back} onClick={resetToChoice}>← Organization options</button>
              <p className="eyebrow">Create organization</p>
              <h1>Establish the canonical identity</h1>
              <p className={styles.lead}>Keep this step intentionally small. Detailed organization profile, locations, evidence, and capabilities come later.</p>
              <label className={styles.field}>Organization name *
                <input value={createName} onChange={(event) => setCreateName(event.target.value)} placeholder="Legal or commonly used name" />
              </label>
              <label className={styles.field}>Organization type *
                <select value={createType} onChange={(event) => setCreateType(event.target.value as OrganizationType)}>
                  {organizationTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
              </label>
              <label className={styles.field}>Website or domain
                <input value={createWebsite} onChange={(event) => setCreateWebsite(event.target.value)} placeholder="example.com" />
              </label>
              {error && <p className={styles.error}>{error}</p>}
              <button className={styles.primary} onClick={() => void checkCreateDuplicates()} disabled={loading}>{loading ? "Checking…" : "Check for existing organization"}</button>
            </>
          )}

          {view === "duplicates" && (
            <>
              <button className={styles.back} onClick={() => setView("create")}>← Edit organization</button>
              <p className="eyebrow">Possible duplicate</p>
              <h1>We found organizations that may match</h1>
              <p className={styles.lead}>Choose an existing organization when it represents the same entity. Similar names alone do not force a merge.</p>
              <div className={styles.results}>
                {results.map((candidate) => (
                  <button key={candidate.id} className={styles.resultCard} onClick={() => chooseExisting(candidate)}>
                    <div><strong>{candidate.name}</strong><p>{candidate.type}</p><small>{candidate.domain ?? "No domain on reference record"}</small></div>
                    <span>Review →</span>
                  </button>
                ))}
              </div>
              <button className={styles.secondary} onClick={() => setView("review-create")}>None of these are my organization</button>
            </>
          )}

          {view === "review-create" && (
            <>
              <button className={styles.back} onClick={() => setView("create")}>← Edit organization</button>
              <p className="eyebrow">Confirm creation</p>
              <h1>Create this organization?</h1>
              <div className={styles.reviewCard}>
                <div className={styles.monogram}>{createName.slice(0, 2).toUpperCase()}</div>
                <div><h2>{createName}</h2><p>{createType}</p>{createWebsite && <small>{normalizeDomain(createWebsite)}</small>}</div>
              </div>
              <div className={styles.notice}>
                <strong>Authority representation</strong>
                <span>Continuing records that you are authorized to establish or begin establishing this organization on RFxchange. Organization verification remains a separate trust workflow.</span>
              </div>
              <button className={styles.primary} onClick={finishCreate}>Create organization</button>
              <button className={styles.secondary} onClick={() => setView("create")}>Back</button>
            </>
          )}

          {view === "complete" && resolution && (
            <>
              <p className="eyebrow">Organization connected</p>
              <div className={styles.successMark}>✓</div>
              <h1>{resolution.organizationName}</h1>
              <p className={styles.lead}>
                {resolution.mode === "create"
                  ? "A reference organization identity and active creator membership are established for this onboarding session."
                  : resolution.mode === "claim"
                    ? "The seeded organization is selected and its authority state is pending resolution."
                    : "The existing organization is selected and membership access is pending approval."}
              </p>
              <dl className={styles.summary}>
                <div><dt>Organization type</dt><dd>{resolution.organizationType}</dd></div>
                <div><dt>Membership</dt><dd>{resolution.membershipState}</dd></div>
                <div><dt>Authority</dt><dd>{resolution.authorityState}</dd></div>
              </dl>
              <div className={styles.referenceNote}><strong>Reference persistence:</strong> this chassis build saves the resolution in session storage only. Production must persist the canonical organization, membership, claim/authority state, invitation attribution, and audit events server-side.</div>
              <Link className={styles.primaryLink} href={resolution.nextPath}>Continue to Geography →</Link>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
