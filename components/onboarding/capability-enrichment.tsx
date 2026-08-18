"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import styles from "./capability-enrichment.module.css";
import {
  CAPABILITY_ENRICHMENT_SESSION_KEY,
  CAPABILITY_ENRICHMENT_STAGES,
  REFERENCE_CAPABILITY_SUGGESTIONS,
  REFERENCE_DISCOVERABILITY_TERMS,
  REFERENCE_ORGANIZATION_CONTEXT,
  calculateCapabilityProfileStrength,
  capabilityGapRecommendations,
  draftFromSuggestion,
  type CapabilityDraft,
  type CapabilityEnrichmentSnapshot,
  type CapabilityEnrichmentStageId,
  type CapabilityEvidenceItem
} from "@/lib/onboarding/capability-enrichment";

const evidenceTemplates: Array<Pick<CapabilityEvidenceItem, "kind" | "label">> = [
  { kind: "certification", label: "Certification" },
  { kind: "license", label: "License" },
  { kind: "past-performance", label: "Past performance" },
  { kind: "case-study", label: "Case study" }
];

function stageIndex(stage: CapabilityEnrichmentStageId) {
  return CAPABILITY_ENRICHMENT_STAGES.findIndex((item) => item.id === stage);
}

export default function CapabilityEnrichment() {
  const [stage, setStage] = useState<CapabilityEnrichmentStageId>("context");
  const [capabilities, setCapabilities] = useState<CapabilityDraft[]>([]);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [manualCapability, setManualCapability] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(CAPABILITY_ENRICHMENT_SESSION_KEY);
      if (raw) {
        const snapshot = JSON.parse(raw) as Partial<CapabilityEnrichmentSnapshot>;
        if (snapshot.stage && CAPABILITY_ENRICHMENT_STAGES.some((item) => item.id === snapshot.stage)) setStage(snapshot.stage);
        if (Array.isArray(snapshot.capabilities)) setCapabilities(snapshot.capabilities);
        if (Array.isArray(snapshot.keywords)) setKeywords(snapshot.keywords);
      }
    } catch {
      window.sessionStorage.removeItem(CAPABILITY_ENRICHMENT_SESSION_KEY);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const snapshot: CapabilityEnrichmentSnapshot = {
      stage,
      capabilities,
      keywords,
      updatedAt: new Date().toISOString()
    };
    window.sessionStorage.setItem(CAPABILITY_ENRICHMENT_SESSION_KEY, JSON.stringify(snapshot));
  }, [capabilities, hydrated, keywords, stage]);

  const currentIndex = stageIndex(stage);
  const strength = useMemo(() => calculateCapabilityProfileStrength(capabilities, keywords), [capabilities, keywords]);
  const gaps = useMemo(() => capabilityGapRecommendations(capabilities, keywords), [capabilities, keywords]);

  function goTo(index: number) {
    const target = CAPABILITY_ENRICHMENT_STAGES[Math.max(0, Math.min(index, CAPABILITY_ENRICHMENT_STAGES.length - 1))];
    setStage(target.id);
    setSaved(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function addSuggestion(id: string) {
    const suggestion = REFERENCE_CAPABILITY_SUGGESTIONS.find((item) => item.id === id);
    if (!suggestion || capabilities.some((item) => item.id === id)) return;
    setCapabilities((current) => [...current, draftFromSuggestion(suggestion)]);
  }

  function addManualCapability() {
    const name = manualCapability.trim();
    if (!name) return;
    const id = `manual-${Date.now()}`;
    setCapabilities((current) => [
      ...current,
      {
        id,
        name,
        description: "User-entered capability awaiting refinement and structured AMACS review.",
        provenance: "entered-by-user",
        mappingStatus: "needs-review",
        evidence: [],
        publicationStatus: "draft"
      }
    ]);
    setManualCapability("");
  }

  function removeCapability(id: string) {
    setCapabilities((current) => current.filter((item) => item.id !== id));
  }

  function updateMapping(id: string, status: CapabilityDraft["mappingStatus"]) {
    setCapabilities((current) => current.map((item) => item.id === id ? { ...item, mappingStatus: status } : item));
  }

  function addEvidence(capabilityId: string, template: Pick<CapabilityEvidenceItem, "kind" | "label">) {
    setCapabilities((current) => current.map((item) => {
      if (item.id !== capabilityId) return item;
      const evidence: CapabilityEvidenceItem = {
        id: `${item.id}-${template.kind}-${Date.now()}`,
        kind: template.kind,
        label: `${template.label} · reference attachment`
      };
      return { ...item, evidence: [...item.evidence, evidence] };
    }));
  }

  function toggleKeyword(keyword: string) {
    setKeywords((current) => current.includes(keyword) ? current.filter((item) => item !== keyword) : [...current, keyword]);
  }

  function setPublicationStatus(status: CapabilityDraft["publicationStatus"]) {
    setCapabilities((current) => current.map((item) => ({ ...item, publicationStatus: status })));
    setSaved(false);
  }

  function renderStage() {
    if (stage === "context") {
      return (
        <section className={styles.stagePanel} aria-labelledby="context-title">
          <p className={styles.kicker}>Reuse before re-entry</p>
          <h2 id="context-title">Start from organization context</h2>
          <p className={styles.lead}>Capability Enrichment should hydrate from the canonical organization profile instead of asking the user to repeat industries, services, and geography.</p>
          <div className={styles.contextCard}>
            <div>
              <span>Organization</span>
              <strong>{REFERENCE_ORGANIZATION_CONTEXT.organizationName}</strong>
            </div>
            <p>{REFERENCE_ORGANIZATION_CONTEXT.description}</p>
            <div className={styles.contextGrid}>
              <div><span>Industries</span><strong>{REFERENCE_ORGANIZATION_CONTEXT.industries.join(" · ")}</strong></div>
              <div><span>Services</span><strong>{REFERENCE_ORGANIZATION_CONTEXT.services.join(" · ")}</strong></div>
              <div><span>Geography</span><strong>{REFERENCE_ORGANIZATION_CONTEXT.geography.join(" · ")}</strong></div>
            </div>
          </div>
          <aside className={styles.boundaryNote}><strong>Production boundary:</strong> this reference context is deterministic. The organization profile service remains the source of truth when connected.</aside>
        </section>
      );
    }

    if (stage === "capabilities") {
      return (
        <section className={styles.stagePanel} aria-labelledby="capability-title">
          <p className={styles.kicker}>Human language first</p>
          <h2 id="capability-title">What can your organization do?</h2>
          <p className={styles.lead}>Users can accept profile-derived suggestions or describe a capability in plain language. They do not need to understand AMACS before entering a claim.</p>
          <div className={styles.suggestionGrid}>
            {REFERENCE_CAPABILITY_SUGGESTIONS.map((suggestion) => {
              const selected = capabilities.some((item) => item.id === suggestion.id);
              return (
                <button className={`${styles.suggestionCard} ${selected ? styles.selectedCard : ""}`} key={suggestion.id} onClick={() => selected ? removeCapability(suggestion.id) : addSuggestion(suggestion.id)} type="button">
                  <span>{selected ? "Selected" : "Suggested"}</span>
                  <strong>{suggestion.name}</strong>
                  <small>{suggestion.description}</small>
                </button>
              );
            })}
          </div>
          <div className={styles.manualEntry}>
            <label htmlFor="manual-capability">Describe another capability</label>
            <div>
              <input id="manual-capability" value={manualCapability} onChange={(event) => setManualCapability(event.target.value)} placeholder="e.g. Commercial HVAC inspection and maintenance" />
              <button type="button" onClick={addManualCapability}>Add</button>
            </div>
          </div>
          <SelectedCapabilities capabilities={capabilities} onRemove={removeCapability} />
        </section>
      );
    }

    if (stage === "amacs") {
      return (
        <section className={styles.stagePanel} aria-labelledby="amacs-title">
          <p className={styles.kicker}>Structured projection</p>
          <h2 id="amacs-title">Review AMACS mapping candidates</h2>
          <p className={styles.lead}>The reference build shows the confirmation pattern without pretending to run production AI. A future mapping service may propose candidates; organization users confirm or flag them for review.</p>
          {capabilities.length === 0 ? <EmptyMessage>There are no capability claims to map yet. You can continue and return later.</EmptyMessage> : (
            <div className={styles.stack}>
              {capabilities.map((capability) => (
                <article className={styles.mappingCard} key={capability.id}>
                  <div>
                    <span className={styles.statusPill}>{capability.provenance === "entered-by-user" ? "User entered" : "Profile suggested"}</span>
                    <h3>{capability.name}</h3>
                    <p>{capability.amacsLabel ?? "No deterministic AMACS candidate is available for this user-entered capability."}</p>
                  </div>
                  <div className={styles.mappingActions}>
                    <button type="button" disabled={!capability.amacsNodeId} aria-pressed={capability.mappingStatus === "accepted"} onClick={() => updateMapping(capability.id, "accepted")}>Accept mapping</button>
                    <button type="button" aria-pressed={capability.mappingStatus === "needs-review"} onClick={() => updateMapping(capability.id, "needs-review")}>Needs review</button>
                  </div>
                </article>
              ))}
            </div>
          )}
          <aside className={styles.boundaryNote}><strong>Truth rule:</strong> inference is not verification. Suggested AMACS alignment stays distinct from user-confirmed mapping and any later governed verification process.</aside>
        </section>
      );
    }

    if (stage === "evidence") {
      return (
        <section className={styles.stagePanel} aria-labelledby="evidence-title">
          <p className={styles.kicker}>Support the claim</p>
          <h2 id="evidence-title">Associate capability evidence</h2>
          <p className={styles.lead}>Evidence belongs to a capability claim. Files will ultimately use the shared object-storage service while the capability domain keeps metadata, relationships, permissions, and audit history.</p>
          {capabilities.length === 0 ? <EmptyMessage>No capability claims are present. Evidence can be added later from the authenticated Capabilities lens.</EmptyMessage> : (
            <div className={styles.stack}>
              {capabilities.map((capability) => (
                <article className={styles.evidenceCard} key={capability.id}>
                  <div className={styles.cardHeader}><div><span>Capability</span><h3>{capability.name}</h3></div><strong>{capability.evidence.length} item{capability.evidence.length === 1 ? "" : "s"}</strong></div>
                  <div className={styles.evidenceActions}>
                    {evidenceTemplates.map((template) => <button type="button" key={template.kind} onClick={() => addEvidence(capability.id, template)}>+ {template.label}</button>)}
                  </div>
                  {capability.evidence.length > 0 && <ul className={styles.evidenceList}>{capability.evidence.map((item) => <li key={item.id}>{item.label}</li>)}</ul>}
                </article>
              ))}
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
          <p className={styles.lead}>Discoverability terms improve search and matching without being promoted to AMACS taxonomy truth.</p>
          <div className={styles.keywordGrid}>
            {REFERENCE_DISCOVERABILITY_TERMS.map((keyword) => <button type="button" key={keyword} className={keywords.includes(keyword) ? styles.keywordSelected : ""} aria-pressed={keywords.includes(keyword)} onClick={() => toggleKeyword(keyword)}>{keyword}</button>)}
          </div>
          <div className={styles.selectedTerms}><span>Selected terms</span><strong>{keywords.length > 0 ? keywords.join(" · ") : "None yet"}</strong></div>
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
            <div><span>Reference profile strength</span><h3>{capabilities.length} capability {capabilities.length === 1 ? "claim" : "claims"}</h3><p>{capabilities.filter((item) => item.mappingStatus === "accepted").length} AMACS confirmed · {capabilities.filter((item) => item.evidence.length > 0).length} evidence-supported</p></div>
          </div>
          <div className={styles.gapList}>
            {gaps.map((gap) => <div key={gap}><span>→</span><p>{gap}</p></div>)}
          </div>
          <aside className={styles.boundaryNote}><strong>Readiness rule:</strong> enrichment quality can improve matching and discoverability, but missing optional enrichment should not become an arbitrary activation wall.</aside>
        </section>
      );
    }

    return (
      <section className={styles.stagePanel} aria-labelledby="publish-title">
        <p className={styles.kicker}>Publication intent</p>
        <h2 id="publish-title">Choose what happens to these claims next</h2>
        <p className={styles.lead}>Capability Enrichment initializes the same capability records the authenticated Capabilities lens will later manage. The next onboarding module owns the actual Exchange-ready gate.</p>
        <div className={styles.publicationOptions}>
          <button type="button" onClick={() => setPublicationStatus("draft")}><span>Keep draft</span><strong>Save enrichment without Exchange visibility</strong></button>
          <button type="button" onClick={() => setPublicationStatus("ready")}><span>Ready</span><strong>Mark claims ready for the Exchange-ready checkpoint</strong></button>
          <button type="button" onClick={() => setPublicationStatus("published")}><span>Reference preview</span><strong>Preview the eventual published state</strong></button>
        </div>
        <div className={styles.handoffCard}>
          <div><span>Canonical handoff</span><strong>Organization capability records → Exchange Capabilities lens</strong></div>
          <p>Onboarding does not become a second capability application. It initializes and enriches records that the same organization will continue managing inside the authenticated Exchange.</p>
          <Link href="/exchange/capabilities">Preview Capabilities lens</Link>
        </div>
        <button className={styles.saveButton} type="button" onClick={() => setSaved(true)}>Save reference enrichment snapshot</button>
        {saved && <p className={styles.savedMessage} role="status">Saved for this browser session. Production persistence remains behind the capability service/repository boundary.</p>}
      </section>
    );
  }

  return (
    <main className={styles.shell}>
      <div className={styles.topBar}>
        <Link href="/onboarding" className={styles.backLink}>← Onboarding</Link>
        <span>RFxchange</span>
        <span className={styles.referenceBadge}>Reference workflow</span>
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
          {renderStage()}
          <nav className={styles.stageNav} aria-label="Capability enrichment steps">
            <button type="button" disabled={currentIndex === 0} onClick={() => goTo(currentIndex - 1)}>Back</button>
            <button type="button" className={styles.skipButton} onClick={() => goTo(Math.min(currentIndex + 1, CAPABILITY_ENRICHMENT_STAGES.length - 1))}>Save &amp; continue later</button>
            {currentIndex < CAPABILITY_ENRICHMENT_STAGES.length - 1 ? <button type="button" className={styles.primaryButton} onClick={() => goTo(currentIndex + 1)}>Continue</button> : <Link className={styles.primaryLink} href="/onboarding">Return to onboarding overview</Link>}
          </nav>
        </div>
      </div>
    </main>
  );
}

function SelectedCapabilities({ capabilities, onRemove }: { capabilities: CapabilityDraft[]; onRemove: (id: string) => void }) {
  if (capabilities.length === 0) return <EmptyMessage>No capabilities selected yet. You can still continue and return later.</EmptyMessage>;
  return (
    <div className={styles.selectedCapabilities}>
      <span>Selected capability claims</span>
      {capabilities.map((capability) => <div key={capability.id}><strong>{capability.name}</strong><button type="button" onClick={() => onRemove(capability.id)}>Remove</button></div>)}
    </div>
  );
}

function EmptyMessage({ children }: { children: React.ReactNode }) {
  return <div className={styles.emptyMessage}>{children}</div>;
}
