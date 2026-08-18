"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import styles from "./capability-enrichment.module.css";
import {
  CAPABILITY_ENRICHMENT_SESSION_KEY,
  CAPABILITY_ENRICHMENT_STAGES,
  calculateCapabilityProfileStrength,
  capabilityGapRecommendations,
  type CapabilityDraft,
  type CapabilityEnrichmentSnapshot,
  type CapabilityEnrichmentStageId,
  type CapabilityEvidenceItem,
} from "@/lib/onboarding/capability-enrichment";
import type { OnboardingProgressState } from "@/lib/onboarding/progress";

const evidenceKinds: Array<{ id: CapabilityEvidenceItem["kind"]; label: string }> = [
  { id: "certification", label: "Certification" },
  { id: "license", label: "License" },
  { id: "past-performance", label: "Past performance" },
  { id: "case-study", label: "Case study" },
  { id: "document", label: "Document" },
  { id: "link", label: "Link" },
];

type EvidenceDraft = { kind: CapabilityEvidenceItem["kind"]; label: string };

function stageIndex(stage: CapabilityEnrichmentStageId) {
  return CAPABILITY_ENRICHMENT_STAGES.findIndex((item) => item.id === stage);
}

export default function CapabilityEnrichment({
  initialStage = "context",
}: {
  initialStage?: CapabilityEnrichmentStageId;
}) {
  const router = useRouter();
  const [stage, setStage] = useState<CapabilityEnrichmentStageId>(initialStage);
  const [capabilities, setCapabilities] = useState<CapabilityDraft[]>([]);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [capabilityName, setCapabilityName] = useState("");
  const [capabilityDescription, setCapabilityDescription] = useState("");
  const [keywordEntry, setKeywordEntry] = useState("");
  const [evidenceDrafts, setEvidenceDrafts] = useState<Record<string, EvidenceDraft>>({});
  const [progress, setProgress] = useState<OnboardingProgressState | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function hydrate() {
      try {
        const raw = window.sessionStorage.getItem(CAPABILITY_ENRICHMENT_SESSION_KEY);
        if (raw) {
          const snapshot = JSON.parse(raw) as Partial<CapabilityEnrichmentSnapshot>;
          if (!initialStage && snapshot.stage && CAPABILITY_ENRICHMENT_STAGES.some((item) => item.id === snapshot.stage)) {
            setStage(snapshot.stage);
          }
          if (Array.isArray(snapshot.capabilities)) setCapabilities(snapshot.capabilities);
          if (Array.isArray(snapshot.keywords)) setKeywords(snapshot.keywords);
        }
        const response = await fetch("/api/onboarding/progress", { cache: "no-store" });
        if (response.ok) {
          const payload = (await response.json()) as { progress?: OnboardingProgressState };
          if (!cancelled && payload.progress) setProgress(payload.progress);
        }
      } catch {
        window.sessionStorage.removeItem(CAPABILITY_ENRICHMENT_SESSION_KEY);
      } finally {
        if (!cancelled) setHydrated(true);
      }
    }
    void hydrate();
    return () => { cancelled = true; };
  }, [initialStage]);

  useEffect(() => {
    if (!hydrated) return;
    const snapshot: CapabilityEnrichmentSnapshot = {
      stage,
      capabilities,
      keywords,
      updatedAt: new Date().toISOString(),
    };
    window.sessionStorage.setItem(CAPABILITY_ENRICHMENT_SESSION_KEY, JSON.stringify(snapshot));
  }, [capabilities, hydrated, keywords, stage]);

  const currentIndex = stageIndex(stage);
  const strength = useMemo(() => calculateCapabilityProfileStrength(capabilities, keywords), [capabilities, keywords]);
  const gaps = useMemo(() => capabilityGapRecommendations(capabilities, keywords), [capabilities, keywords]);
  const readyCount = capabilities.filter((item) => item.publicationStatus !== "draft").length;

  function goTo(index: number) {
    const target = CAPABILITY_ENRICHMENT_STAGES[Math.max(0, Math.min(index, CAPABILITY_ENRICHMENT_STAGES.length - 1))];
    setStage(target.id);
    setError("");
    router.replace(`/onboarding/capabilities?stage=${target.id}`, { scroll: false });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function addCapability() {
    const name = capabilityName.trim();
    const description = capabilityDescription.trim();
    if (!name || description.length < 10) {
      setError("Enter a capability name and a plain-language description of at least 10 characters.");
      return;
    }
    setCapabilities((current) => [
      ...current,
      {
        id: `capability-${crypto.randomUUID()}`,
        name,
        description,
        provenance: "entered-by-user",
        mappingStatus: "needs-review",
        evidence: [],
        publicationStatus: "draft",
      },
    ]);
    setCapabilityName("");
    setCapabilityDescription("");
    setError("");
  }

  function removeCapability(id: string) {
    setCapabilities((current) => current.filter((item) => item.id !== id));
  }

  function updateCapability(id: string, patch: Partial<CapabilityDraft>) {
    setCapabilities((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  }

  function confirmAmacsMapping(id: string) {
    const capability = capabilities.find((item) => item.id === id);
    if (!capability?.amacsNodeId?.trim() || !capability.amacsLabel?.trim()) {
      setError("Enter both an AMACS node ID and label before confirming the mapping.");
      return;
    }
    updateCapability(id, { mappingStatus: "accepted" });
    setError("");
  }

  function updateEvidenceDraft(capabilityId: string, patch: Partial<EvidenceDraft>) {
    setEvidenceDrafts((current) => ({
      ...current,
      [capabilityId]: {
        kind: current[capabilityId]?.kind ?? "certification",
        label: current[capabilityId]?.label ?? "",
        ...patch,
      },
    }));
  }

  function addEvidence(capabilityId: string) {
    const draft = evidenceDrafts[capabilityId];
    if (!draft?.label.trim()) {
      setError("Describe the evidence before adding it to the capability.");
      return;
    }
    const evidence: CapabilityEvidenceItem = {
      id: `evidence-${crypto.randomUUID()}`,
      kind: draft.kind,
      label: draft.label.trim(),
    };
    setCapabilities((current) => current.map((item) => item.id === capabilityId ? { ...item, evidence: [...item.evidence, evidence] } : item));
    setEvidenceDrafts((current) => ({ ...current, [capabilityId]: { kind: "certification", label: "" } }));
    setError("");
  }

  function addKeyword() {
    const term = keywordEntry.trim();
    if (!term || keywords.includes(term)) return;
    setKeywords((current) => [...current, term]);
    setKeywordEntry("");
  }

  function removeKeyword(term: string) {
    setKeywords((current) => current.filter((item) => item !== term));
  }

  function setPublicationStatus(status: CapabilityDraft["publicationStatus"]) {
    setCapabilities((current) => current.map((item) => ({ ...item, publicationStatus: status })));
    setError("");
  }

  async function continueToCompletion() {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/onboarding/capabilities/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ capabilities, keywords }),
      });
      const payload = (await response.json()) as { error?: string; nextPath?: string };
      if (!response.ok || !payload.nextPath) {
        setError(payload.error ?? "Capability readiness could not be saved.");
        return;
      }
      router.push(payload.nextPath);
    } catch {
      setError("Capability readiness could not be saved. Your in-progress entries remain in this browser session.");
    } finally {
      setSaving(false);
    }
  }

  function renderStage() {
    if (stage === "context") {
      return (
        <section className={styles.stagePanel} aria-labelledby="context-title">
          <p className={styles.kicker}>Reuse before re-entry</p>
          <h2 id="context-title">Start from saved organization context</h2>
          <p className={styles.lead}>Capability Enrichment reads the onboarding progress service instead of inventing an organization profile.</p>
          <div className={styles.contextCard}>
            <div>
              <span>Organization</span>
              <strong>{progress?.context.organizationName ?? "Complete Organization Profile first"}</strong>
            </div>
            <div className={styles.contextGrid}>
              <div><span>Geography</span><strong>{progress?.context.geography ?? "Not yet established"}</strong></div>
              <div><span>Visibility</span><strong>{progress?.context.visibility ?? "Not yet selected"}</strong></div>
              <div><span>Existing capability seed</span><strong>{progress?.context.capabilitySummary?.[0] ?? "None recorded"}</strong></div>
            </div>
          </div>
          {!progress?.context.organizationName ? <aside className={styles.boundaryNote}><strong>Missing upstream context:</strong> <Link href="/onboarding/organization-profile">Complete Organization Profile</Link> before final readiness.</aside> : null}
        </section>
      );
    }

    if (stage === "capabilities") {
      return (
        <section className={styles.stagePanel} aria-labelledby="capability-title">
          <p className={styles.kicker}>Human language first</p>
          <h2 id="capability-title">What can your organization do?</h2>
          <p className={styles.lead}>Enter actual capability claims in your own words. RFxchange does not preselect deterministic example capabilities.</p>
          <div className={styles.manualEntry}>
            <label htmlFor="capability-name">Capability name</label>
            <input id="capability-name" value={capabilityName} onChange={(event) => setCapabilityName(event.target.value)} placeholder="e.g. Commercial HVAC inspection" />
            <label htmlFor="capability-description">Plain-language description</label>
            <textarea id="capability-description" rows={4} value={capabilityDescription} onChange={(event) => setCapabilityDescription(event.target.value)} placeholder="Describe what the organization can perform, provide, make, or support." />
            <button type="button" onClick={addCapability}>Add capability</button>
          </div>
          <SelectedCapabilities capabilities={capabilities} onRemove={removeCapability} />
        </section>
      );
    }

    if (stage === "amacs") {
      return (
        <section className={styles.stagePanel} aria-labelledby="amacs-title">
          <p className={styles.kicker}>Structured projection</p>
          <h2 id="amacs-title">Review AMACS alignment</h2>
          <p className={styles.lead}>No AMACS inference service is simulated here. If you know the authoritative AMACS node, enter it; otherwise leave the claim for later enrichment.</p>
          {capabilities.length === 0 ? <EmptyMessage>There are no capability claims to map yet.</EmptyMessage> : (
            <div className={styles.stack}>
              {capabilities.map((capability) => (
                <article className={styles.mappingCard} key={capability.id}>
                  <div>
                    <span className={styles.statusPill}>{capability.mappingStatus === "accepted" ? "Organization confirmed" : "Needs review"}</span>
                    <h3>{capability.name}</h3>
                    <p>{capability.description}</p>
                    <label>AMACS node ID<input value={capability.amacsNodeId ?? ""} onChange={(event) => updateCapability(capability.id, { amacsNodeId: event.target.value, mappingStatus: "needs-review" })} placeholder="Enter authoritative node ID" /></label>
                    <label>AMACS label<input value={capability.amacsLabel ?? ""} onChange={(event) => updateCapability(capability.id, { amacsLabel: event.target.value, mappingStatus: "needs-review" })} placeholder="Enter taxonomy label" /></label>
                  </div>
                  <div className={styles.mappingActions}>
                    <button type="button" onClick={() => confirmAmacsMapping(capability.id)}>Confirm entered mapping</button>
                    <button type="button" onClick={() => updateCapability(capability.id, { amacsNodeId: undefined, amacsLabel: undefined, mappingStatus: "needs-review" })}>Clear mapping</button>
                  </div>
                </article>
              ))}
            </div>
          )}
          <aside className={styles.boundaryNote}><strong>Truth rule:</strong> a user-entered AMACS ID is an organization-confirmed mapping, not independent RFxchange verification.</aside>
        </section>
      );
    }

    if (stage === "evidence") {
      return (
        <section className={styles.stagePanel} aria-labelledby="evidence-title">
          <p className={styles.kicker}>Support the claim</p>
          <h2 id="evidence-title">Record capability evidence</h2>
          <p className={styles.lead}>This step records evidence metadata only. RFxchange does not fabricate attachments; files remain unavailable until object storage is connected.</p>
          {capabilities.length === 0 ? <EmptyMessage>No capability claims are present. Evidence is optional and can be added later.</EmptyMessage> : (
            <div className={styles.stack}>
              {capabilities.map((capability) => {
                const draft = evidenceDrafts[capability.id] ?? { kind: "certification" as const, label: "" };
                return (
                  <article className={styles.evidenceCard} key={capability.id}>
                    <div className={styles.cardHeader}><div><span>Capability</span><h3>{capability.name}</h3></div><strong>{capability.evidence.length} item{capability.evidence.length === 1 ? "" : "s"}</strong></div>
                    <div className={styles.evidenceActions}>
                      <select value={draft.kind} onChange={(event) => updateEvidenceDraft(capability.id, { kind: event.target.value as CapabilityEvidenceItem["kind"] })}>
                        {evidenceKinds.map((kind) => <option value={kind.id} key={kind.id}>{kind.label}</option>)}
                      </select>
                      <input value={draft.label} onChange={(event) => updateEvidenceDraft(capability.id, { label: event.target.value })} placeholder="Issuer, credential, project, URL, or supporting reference" />
                      <button type="button" onClick={() => addEvidence(capability.id)}>Add evidence metadata</button>
                    </div>
                    {capability.evidence.length > 0 ? <ul className={styles.evidenceList}>{capability.evidence.map((item) => <li key={item.id}>{item.kind}: {item.label}</li>)}</ul> : null}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      );
    }

    if (stage === "discoverability") {
      return (
        <section className={styles.stagePanel} aria-labelledby="discoverability-title">
          <p className={styles.kicker}>Search vocabulary</p>
          <h2 id="discoverability-title">Add specialties and alternate terminology</h2>
          <p className={styles.lead}>Enter terms people actually use to find this organization. They improve discovery without being promoted to AMACS taxonomy truth.</p>
          <div className={styles.manualEntry}>
            <label htmlFor="keyword-entry">Specialty, keyword, or alternate term</label>
            <div>
              <input id="keyword-entry" value={keywordEntry} onChange={(event) => setKeywordEntry(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addKeyword(); } }} placeholder="e.g. field inspection" />
              <button type="button" onClick={addKeyword}>Add</button>
            </div>
          </div>
          <div className={styles.selectedTerms}>
            <span>Selected terms</span>
            {keywords.length ? keywords.map((term) => <button type="button" key={term} onClick={() => removeKeyword(term)}>{term} ×</button>) : <strong>None yet</strong>}
          </div>
        </section>
      );
    }

    if (stage === "review") {
      return (
        <section className={styles.stagePanel} aria-labelledby="review-title">
          <p className={styles.kicker}>Advisory, not punitive</p>
          <h2 id="review-title">Review capability profile strength</h2>
          <div className={styles.scoreCard}>
            <div className={styles.scoreRing} aria-label={`Profile strength ${strength} percent`}><strong>{strength}</strong><span>/100</span></div>
            <div><span>Profile strength</span><h3>{capabilities.length} capability {capabilities.length === 1 ? "claim" : "claims"}</h3><p>{capabilities.filter((item) => item.mappingStatus === "accepted").length} AMACS confirmed · {capabilities.filter((item) => item.evidence.length > 0).length} evidence-supported</p></div>
          </div>
          <div className={styles.gapList}>{gaps.map((gap) => <div key={gap}><span>→</span><p>{gap}</p></div>)}</div>
          <aside className={styles.boundaryNote}><strong>Readiness rule:</strong> one meaningful ready capability is required; deeper mapping, evidence, and terminology remain progressive.</aside>
        </section>
      );
    }

    return (
      <section className={styles.stagePanel} aria-labelledby="publish-title">
        <p className={styles.kicker}>Publication intent</p>
        <h2 id="publish-title">Choose what happens to these claims next</h2>
        <p className={styles.lead}>Mark capability claims ready when they can participate in Exchange discovery. This saves the same readiness state consumed by the final completion checkpoint.</p>
        <div className={styles.publicationOptions}>
          <button type="button" onClick={() => setPublicationStatus("draft")}><span>Keep draft</span><strong>Do not count these claims toward Exchange readiness yet</strong></button>
          <button type="button" onClick={() => setPublicationStatus("ready")}><span>Ready</span><strong>Make these claims eligible for the Exchange-ready checkpoint</strong></button>
        </div>
        <div className={styles.handoffCard}>
          <div><span>Canonical handoff</span><strong>Capability enrichment → Exchange-ready Completion → Capabilities lens</strong></div>
          <p>There is no separate onboarding capability database. The readiness checkpoint records what has actually been entered here and leaves deeper enrichment available after entry.</p>
        </div>
        <button className={styles.saveButton} type="button" onClick={() => void continueToCompletion()} disabled={saving || readyCount === 0 || capabilities.length === 0}>
          {saving ? "Saving readiness…" : "Continue to Exchange-ready review"}
        </button>
        {readyCount === 0 ? <p className={styles.savedMessage}>Mark at least one capability Ready to continue. Draft capability work remains saved in this browser session.</p> : null}
      </section>
    );
  }

  return (
    <main className={styles.shell}>
      <div className={styles.topBar}>
        <Link href="/onboarding" className={styles.backLink}>← Onboarding</Link>
        <span>RFxchange</span>
        <span className={styles.referenceBadge}>Progress-backed workflow</span>
      </div>

      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <p className={styles.eyebrow}>Identity &amp; Onboarding</p>
          <h1>Capability Enrichment</h1>
          <p>Initialize structured capability identity without recreating the authenticated Capabilities product.</p>
          <div className={styles.progressSummary}>
            <span>Profile strength</span>
            <strong>{strength}%</strong>
            <div><i style={{ width: `${strength}%` }} /></div>
          </div>
          <ol className={styles.stepList}>
            {CAPABILITY_ENRICHMENT_STAGES.map((item, index) => (
              <li key={item.id} className={index === currentIndex ? styles.activeStep : index < currentIndex ? styles.completedStep : ""}>
                <button type="button" onClick={() => goTo(index)}>
                  <span>{index < currentIndex ? "✓" : index + 1}</span>
                  <div><strong>{item.label}</strong><small>{item.description}</small></div>
                </button>
              </li>
            ))}
          </ol>
        </aside>

        <div className={styles.mainColumn}>
          <div className={styles.mobileProgress}><span>Step {currentIndex + 1} of {CAPABILITY_ENRICHMENT_STAGES.length}</span><strong>{CAPABILITY_ENRICHMENT_STAGES[currentIndex].label}</strong></div>
          {error ? <p className={styles.savedMessage} role="alert">{error}</p> : null}
          {renderStage()}
          <nav className={styles.stageNav} aria-label="Capability enrichment steps">
            <button type="button" disabled={currentIndex === 0} onClick={() => goTo(currentIndex - 1)}>Back</button>
            <Link className={styles.skipButton} href="/onboarding">Save &amp; continue later</Link>
            {currentIndex < CAPABILITY_ENRICHMENT_STAGES.length - 1 ? <button type="button" className={styles.primaryButton} onClick={() => goTo(currentIndex + 1)}>Continue</button> : <Link className={styles.primaryLink} href="/onboarding/completion">Review readiness</Link>}
          </nav>
        </div>
      </div>
    </main>
  );
}

function SelectedCapabilities({ capabilities, onRemove }: { capabilities: CapabilityDraft[]; onRemove: (id: string) => void }) {
  if (capabilities.length === 0) return <EmptyMessage>No capabilities entered yet.</EmptyMessage>;
  return (
    <div className={styles.selectedCapabilities}>
      <span>Capability claims</span>
      {capabilities.map((capability) => <div key={capability.id}><strong>{capability.name}</strong><button type="button" onClick={() => onRemove(capability.id)}>Remove</button></div>)}
    </div>
  );
}

function EmptyMessage({ children }: { children: React.ReactNode }) {
  return <div className={styles.emptyMessage}>{children}</div>;
}