"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type {
  OnboardingDetailDefinition,
  OnboardingDetailField,
  OnboardingDetailStatus,
  OnboardingDetailValue,
} from "@/lib/onboarding/detail-surface";
import styles from "./onboarding-detail-surface.module.css";

type SaveState = "idle" | "dirty" | "saved";

function collectValues(definition: OnboardingDetailDefinition): Record<string, OnboardingDetailValue> {
  return Object.fromEntries(
    definition.sections.flatMap((section) => section.fields.map((field) => [field.id, field.value])),
  ) as Record<string, OnboardingDetailValue>;
}

function statusClass(status: OnboardingDetailStatus): string {
  switch (status) {
    case "complete": return styles.complete;
    case "blocked": return styles.blocked;
    case "needs-action":
    case "needs-confirmation": return styles.attention;
    case "pending": return styles.pending;
    default: return styles.optional;
  }
}

function fieldIsMissing(field: OnboardingDetailField, value: OnboardingDetailValue | undefined): boolean {
  if (!field.required || field.kind === "status") return false;
  if (field.kind === "toggle") return value !== true;
  return typeof value !== "string" || value.trim().length === 0;
}

export function OnboardingDetailSurface({ definition }: { definition: OnboardingDetailDefinition }) {
  const storageKey = `rfxchange:onboarding-detail:${definition.subject}`;
  const [values, setValues] = useState<Record<string, OnboardingDetailValue>>(() => collectValues(definition));
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [showValidation, setShowValidation] = useState(false);
  const [guidanceOpen, setGuidanceOpen] = useState(true);

  useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem(storageKey);
      if (!stored) return;
      const parsed = JSON.parse(stored) as Record<string, OnboardingDetailValue>;
      setValues((current) => ({ ...current, ...parsed }));
      setSaveState("saved");
    } catch {
      // Reference drafts are disposable; malformed browser state must never block onboarding.
    }
  }, [storageKey]);

  const requiredFields = useMemo(
    () => definition.sections.flatMap((section) => section.fields).filter((field) => field.required),
    [definition.sections],
  );
  const missingRequired = useMemo(
    () => requiredFields.filter((field) => fieldIsMissing(field, values[field.id])),
    [requiredFields, values],
  );

  function updateValue(fieldId: string, value: OnboardingDetailValue) {
    setValues((current) => ({ ...current, [fieldId]: value }));
    setSaveState("dirty");
  }

  function saveReferenceDraft(): boolean {
    setShowValidation(true);
    if (missingRequired.length > 0 && definition.required) return false;
    try {
      window.sessionStorage.setItem(storageKey, JSON.stringify(values));
      setSaveState("saved");
    } catch {
      setSaveState("idle");
    }
    return true;
  }

  function continueToNext() {
    if (!saveReferenceDraft()) return;
    window.location.assign(definition.nextHref);
  }

  return (
    <main className={styles.shell}>
      <div className={styles.workspace}>
        <aside className={styles.progressRail} aria-label="Onboarding progress">
          <Link className={styles.brand} href="/onboarding">RFxchange</Link>
          <p className={styles.railEyebrow}>Identity & onboarding</p>
          <ol>
            {Array.from({ length: definition.totalSteps }, (_, index) => {
              const step = index + 1;
              const current = step === definition.step;
              const complete = step < definition.step;
              return (
                <li className={current ? styles.currentStep : complete ? styles.completeStep : ""} key={step}>
                  <span>{complete ? "✓" : step}</span>
                  <div>
                    <strong>{step === definition.step ? definition.title : `Stage ${step}`}</strong>
                    <small>{current ? definition.statusLabel : complete ? "Established" : "Upcoming"}</small>
                  </div>
                </li>
              );
            })}
          </ol>
          <p className={styles.referenceNote}>
            Reference chassis: browser-session drafts demonstrate continuity only. Canonical persistence and domain validation remain owned by the connected onboarding service.
          </p>
        </aside>

        <section className={styles.surface} aria-labelledby="detail-title">
          <header className={styles.topbar}>
            <Link className={styles.backLink} href={definition.returnHref}>← Back</Link>
            <div className={styles.saveIndicator} aria-live="polite">
              {saveState === "saved" ? "Saved in this session ✓" : saveState === "dirty" ? "Unsaved changes" : "Reference detail"}
            </div>
          </header>

          <div className={styles.content}>
            <div className={styles.contextHeader}>
              <div>
                <p className={styles.eyebrow}>{definition.eyebrow}</p>
                <h1 id="detail-title">{definition.title}</h1>
                <p className={styles.subject}>{definition.subjectLabel}</p>
              </div>
              <span className={`${styles.statusPill} ${statusClass(definition.status)}`}>{definition.statusLabel}</span>
            </div>

            <div className={styles.progressBar} aria-label={`Step ${definition.step} of ${definition.totalSteps}`}>
              <span style={{ width: `${(definition.step / definition.totalSteps) * 100}%` }} />
            </div>
            <p className={styles.stepCaption}>Step {definition.step} of {definition.totalSteps} · {definition.required ? "Required readiness" : "Optional enrichment"}</p>

            <section className={styles.summaryCard}>
              <strong>{missingRequired.length > 0 ? `${missingRequired.length} required item${missingRequired.length === 1 ? "" : "s"} need attention` : "Detail is structurally complete"}</strong>
              <p>{definition.completionSummary}</p>
            </section>

            <section className={styles.guidance}>
              <button type="button" onClick={() => setGuidanceOpen((open) => !open)} aria-expanded={guidanceOpen}>
                <span>Why this matters</span><span>{guidanceOpen ? "−" : "+"}</span>
              </button>
              {guidanceOpen ? (
                <div className={styles.guidanceGrid}>
                  <div><strong>What is this?</strong><p>{definition.guidance.what}</p></div>
                  <div><strong>Why RFxchange needs it</strong><p>{definition.guidance.why}</p></div>
                  <div><strong>Who can see it?</strong><p>{definition.guidance.visibility}</p></div>
                  <div><strong>What happens next?</strong><p>{definition.guidance.next}</p></div>
                </div>
              ) : null}
            </section>

            <div className={styles.sections}>
              {definition.sections.map((section) => (
                <section className={styles.formSection} key={section.id}>
                  <div className={styles.sectionHeading}>
                    <h2>{section.title}</h2>
                    {section.description ? <p>{section.description}</p> : null}
                  </div>
                  <div className={styles.fieldList}>
                    {section.fields.map((field) => {
                      const value = values[field.id] ?? field.value;
                      const invalid = showValidation && fieldIsMissing(field, value);
                      return (
                        <div className={`${styles.field} ${invalid ? styles.invalidField : ""}`} key={field.id}>
                          <div className={styles.fieldLabel}>
                            <label htmlFor={`detail-${field.id}`}>{field.label}{field.required ? <span> Required</span> : null}</label>
                            {field.description ? <small>{field.description}</small> : null}
                          </div>
                          {field.kind === "textarea" ? (
                            <textarea id={`detail-${field.id}`} value={String(value)} onChange={(event) => updateValue(field.id, event.target.value)} rows={4} />
                          ) : field.kind === "select" ? (
                            <select id={`detail-${field.id}`} value={String(value)} onChange={(event) => updateValue(field.id, event.target.value)}>
                              {field.options?.map((option) => <option key={option}>{option}</option>)}
                            </select>
                          ) : field.kind === "toggle" ? (
                            <label className={styles.toggle} htmlFor={`detail-${field.id}`}>
                              <input id={`detail-${field.id}`} type="checkbox" checked={Boolean(value)} onChange={(event) => updateValue(field.id, event.target.checked)} />
                              <span aria-hidden="true" />
                              <em>{Boolean(value) ? "Yes" : "No"}</em>
                            </label>
                          ) : field.kind === "status" ? (
                            <div className={styles.readOnlyStatus} id={`detail-${field.id}`}>{String(value)}</div>
                          ) : (
                            <input id={`detail-${field.id}`} value={String(value)} onChange={(event) => updateValue(field.id, event.target.value)} />
                          )}
                          {invalid ? <p className={styles.errorText}>Complete this required item before continuing.</p> : null}
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          </div>

          <footer className={styles.actionBar}>
            <Link className={styles.secondaryAction} href={definition.returnHref}>Back</Link>
            <button className={styles.secondaryAction} type="button" onClick={saveReferenceDraft}>Save & exit later</button>
            <button className={styles.primaryAction} type="button" onClick={continueToNext}>{definition.nextLabel}</button>
          </footer>
        </section>
      </div>
    </main>
  );
}
