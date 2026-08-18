"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  createInitialGeographyDraft,
  geographyOptions,
  getGeographyOption,
  type GeographyContext,
  type GeographyDraft,
  type LocationVisibility,
  type ServiceAreaMode,
} from "@/lib/onboarding/geography";
import styles from "./geography-live.module.css";

const steps = ["Primary locality", "Base location", "Map treatment", "Privacy", "Service geography", "Review"] as const;
const DRAFT_KEY = "rfxchange.geography-draft.v2";
const STEP_KEY = "rfxchange.geography-step.v2";
const CONTEXT_KEY = "rfxchange.geography-context";

function titleCase(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function GeographyWorkflowLive() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<GeographyDraft>(createInitialGeographyDraft);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    try {
      const storedDraft = window.sessionStorage.getItem(DRAFT_KEY);
      const storedStep = Number(window.sessionStorage.getItem(STEP_KEY));
      if (storedDraft) setDraft(JSON.parse(storedDraft) as GeographyDraft);
      if (Number.isInteger(storedStep) && storedStep >= 0 && storedStep < steps.length) setStep(storedStep);
    } catch {
      window.sessionStorage.removeItem(DRAFT_KEY);
      window.sessionStorage.removeItem(STEP_KEY);
    }
  }, []);

  useEffect(() => {
    window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    window.sessionStorage.setItem(STEP_KEY, String(step));
  }, [draft, step]);

  const selected = getGeographyOption(draft.primaryGeographyId);
  const serviceLabels = useMemo(
    () => draft.serviceGeographyIds.map((id) => getGeographyOption(id)?.name).filter((value): value is string => Boolean(value)),
    [draft.serviceGeographyIds],
  );

  function updateBase(field: keyof GeographyDraft["baseLocation"], value: string | boolean) {
    setDraft((current) => ({ ...current, baseLocation: { ...current.baseLocation, [field]: value } }));
  }

  function toggleServiceGeography(id: string) {
    setDraft((current) => ({
      ...current,
      serviceGeographyIds: current.serviceGeographyIds.includes(id)
        ? current.serviceGeographyIds.filter((item) => item !== id)
        : [...current.serviceGeographyIds, id],
    }));
  }

  function canAdvance() {
    if (step === 0) return Boolean(selected?.primarySelectable && selected.releaseState === "released");
    if (step === 1) return Boolean(draft.baseLocation.address1.trim() && draft.baseLocation.city.trim() && draft.baseLocation.state.trim() && draft.baseLocation.postalCode.trim());
    if (step === 2) return draft.mapConfirmed;
    if (step === 4) return draft.serviceMode !== "localities" || draft.serviceGeographyIds.length > 0;
    return true;
  }

  function goNext() {
    if (!canAdvance()) return;
    setErrors([]);
    setStep((current) => Math.min(current + 1, steps.length - 1));
  }

  function goBack() {
    setErrors([]);
    setStep((current) => Math.max(current - 1, 0));
  }

  function saveAndExit() {
    router.push("/onboarding");
  }

  async function completeGeography() {
    setSubmitting(true);
    setErrors([]);
    try {
      const response = await fetch("/api/onboarding/geography", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(draft),
      });
      const result = (await response.json()) as { errors?: string[]; context?: GeographyContext };
      if (!response.ok || !result.context) {
        setErrors(result.errors ?? ["Geography could not be completed."]);
        return;
      }
      window.sessionStorage.setItem(CONTEXT_KEY, JSON.stringify(result.context));
      window.sessionStorage.removeItem(DRAFT_KEY);
      window.sessionStorage.removeItem(STEP_KEY);
      router.push("/onboarding/organization-profile");
    } catch {
      setErrors(["Geography could not be saved. Your draft remains in this browser session."]);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className={styles.shell}>
      <section className={styles.frame}>
        <header className={styles.header}>
          <Link className={styles.brand} href="/onboarding">RFxchange</Link>
          <button className={styles.exit} type="button" onClick={saveAndExit}>Save &amp; exit</button>
        </header>

        <ol className={styles.progress} aria-label="Geography workflow progress">
          {steps.map((label, index) => (
            <li className={index === step ? styles.active : index < step ? styles.done : ""} key={label}>
              <span>{index < step ? "✓" : index + 1}</span>
              <small>{label}</small>
            </li>
          ))}
        </ol>

        <section className={styles.card}>
          <p className="eyebrow">Geography · {step + 1} of {steps.length}</p>
          {step === 0 ? (
            <>
              <h1>Choose the primary Exchange locality</h1>
              <p className={styles.lead}>This is the authoritative city or county used for RFxchange rollout and initial Exchange context. It is separate from the street address and service area.</p>
              <div className={styles.options}>
                {geographyOptions.map((option) => (
                  <button
                    type="button"
                    key={option.id}
                    disabled={!option.primarySelectable || option.releaseState !== "released"}
                    className={`${styles.option} ${draft.primaryGeographyId === option.id ? styles.selected : ""} ${!option.primarySelectable ? styles.unavailable : ""}`}
                    onClick={() => setDraft((current) => ({ ...current, primaryGeographyId: option.id }))}
                  >
                    <span><strong>{option.name}</strong><small>{option.stateCode} · {titleCase(option.type)}</small></span>
                    <span>{option.releaseState === "released" ? "Released" : "Visible · not released"}</span>
                  </button>
                ))}
              </div>
            </>
          ) : null}

          {step === 1 ? (
            <>
              <h1>Enter the organization&apos;s base location</h1>
              <p className={styles.lead}>This address is administrative onboarding data. Entering it does not create a public map marker or make the exact address visible.</p>
              <div className={styles.fields}>
                <label className={styles.wide}>Street address<input value={draft.baseLocation.address1} onChange={(event) => updateBase("address1", event.target.value)} /></label>
                <label className={styles.wide}>Address line 2<input value={draft.baseLocation.address2} onChange={(event) => updateBase("address2", event.target.value)} /></label>
                <label>City<input value={draft.baseLocation.city} onChange={(event) => updateBase("city", event.target.value)} /></label>
                <label>State<input maxLength={2} value={draft.baseLocation.state} onChange={(event) => updateBase("state", event.target.value.toUpperCase())} /></label>
                <label>ZIP code<input value={draft.baseLocation.postalCode} onChange={(event) => updateBase("postalCode", event.target.value)} /></label>
                <label>Country<input value="US" disabled /></label>
              </div>
              <label className={styles.confirm}><input type="checkbox" checked={draft.baseLocation.homeBased} onChange={(event) => updateBase("homeBased", event.target.checked)} /><span><strong>Home-based organization</strong><br /><small>Use privacy controls before any future precise map publication.</small></span></label>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <h1>Confirm map treatment</h1>
              <p className={styles.lead}>RFxchange does not have a real geocoded point for this onboarding flow. No simulated marker is shown. The organization will remain discoverable as an off-map result until an actual geocoder produces a coordinate.</p>
              <div className={styles.notice}>
                <strong>Current presence: off-map.</strong><br />
                Primary locality: {selected ? `${selected.name}, ${selected.stateCode}` : "not selected"}. Base address remains available to future authorized geocoding infrastructure.
              </div>
              <label className={styles.confirm}><input type="checkbox" checked={draft.mapConfirmed} onChange={(event) => setDraft((current) => ({ ...current, mapConfirmed: event.target.checked }))} /><span><strong>I understand the current off-map state.</strong><br /><small>Completing Geography will not create a marker until a real coordinate exists.</small></span></label>
            </>
          ) : null}

          {step === 3 ? (
            <>
              <h1>Choose the public location preference</h1>
              <p className={styles.lead}>This preference governs future map publication after geocoding. It does not expose a coordinate now.</p>
              <div className={styles.options}>
                {([
                  ["exact", "Exact location", "Publish the confirmed point when a real geocoder and authorization policy support it."],
                  ["approximate", "Approximate location", "Keep the canonical point private and publish a safe nearby representation."],
                  ["locality_only", "Locality only", "Show the organization within its locality without street-level placement."],
                ] as Array<[LocationVisibility, string, string]>).map(([id, title, copy]) => (
                  <button type="button" key={id} className={`${styles.option} ${draft.visibility === id ? styles.selected : ""}`} onClick={() => setDraft((current) => ({ ...current, visibility: id }))}>
                    <span><strong>{title}</strong><small>{copy}</small></span>
                  </button>
                ))}
              </div>
            </>
          ) : null}

          {step === 4 ? (
            <>
              <h1>Set service geography</h1>
              <p className={styles.lead}>Where the organization can perform work is independent from its base location.</p>
              <div className={styles.options}>
                {([
                  ["localities", "Selected localities"],
                  ["statewide", "Statewide"],
                  ["nationwide", "Nationwide"],
                  ["remote", "Remote / virtual"],
                ] as Array<[ServiceAreaMode, string]>).map(([id, label]) => (
                  <button type="button" key={id} className={`${styles.option} ${draft.serviceMode === id ? styles.selected : ""}`} onClick={() => setDraft((current) => ({ ...current, serviceMode: id }))}>
                    <span><strong>{label}</strong></span>
                  </button>
                ))}
              </div>
              {draft.serviceMode === "localities" ? (
                <div className={styles.options}>
                  {geographyOptions.map((option) => (
                    <label className={styles.confirm} key={option.id}>
                      <input type="checkbox" checked={draft.serviceGeographyIds.includes(option.id)} onChange={() => toggleServiceGeography(option.id)} />
                      <span><strong>{option.name}</strong><br /><small>{option.stateCode}</small></span>
                    </label>
                  ))}
                </div>
              ) : null}
            </>
          ) : null}

          {step === 5 ? (
            <>
              <h1>Review geography</h1>
              <p className={styles.lead}>Completing this step saves the Geography readiness checkpoint used by Organization Profile and Exchange-ready Completion.</p>
              <dl className={styles.review}>
                <div><dt>Primary geography</dt><dd>{selected ? `${selected.name}, ${selected.stateCode}` : "Not selected"}</dd></div>
                <div><dt>Base location</dt><dd>{draft.baseLocation.city}, {draft.baseLocation.state} {draft.baseLocation.postalCode}</dd></div>
                <div><dt>Map state</dt><dd>Off-map · no geocoded point</dd></div>
                <div><dt>Future public preference</dt><dd>{titleCase(draft.visibility)}</dd></div>
                <div><dt>Service geography</dt><dd>{draft.serviceMode === "localities" ? serviceLabels.join(", ") : titleCase(draft.serviceMode)}</dd></div>
              </dl>
            </>
          ) : null}

          {errors.length ? <div className={styles.error} role="alert">{errors.join(" ")}</div> : null}

          <footer className={styles.actions}>
            <button type="button" onClick={goBack} disabled={step === 0}>Back</button>
            {step < steps.length - 1 ? (
              <button className={styles.primary} type="button" onClick={goNext} disabled={!canAdvance()}>Continue</button>
            ) : (
              <button className={styles.primary} type="button" onClick={() => void completeGeography()} disabled={submitting}>{submitting ? "Saving…" : "Complete geography"}</button>
            )}
          </footer>
        </section>
      </section>
    </main>
  );
}
