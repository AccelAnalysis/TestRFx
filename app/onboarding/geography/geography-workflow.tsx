"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createInitialGeographyDraft,
  geographyOptions,
  getGeographyOption,
  type GeographyContext,
  type GeographyDraft,
  type LocationVisibility,
  type ServiceAreaMode,
} from "@/lib/onboarding/geography";
import styles from "./geography.module.css";

const DRAFT_KEY = "rfxchange.onboarding.geography.draft";
const STEP_KEY = "rfxchange.onboarding.geography.step";
const CONTEXT_KEY = "rfxchange.geography-context";

const geographySteps = [
  "Primary locality",
  "Base location",
  "Map placement",
  "Privacy",
  "Service geography",
  "Review",
];

const onboardingStages = ["Account", "Organization", "Geography", "Profile", "Capabilities", "Exchange ready"];

function titleCase(value: string) {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function GeographyWorkflow() {
  const router = useRouter();
  const [draft, setDraft] = useState<GeographyDraft>(() => createInitialGeographyDraft());
  const [step, setStep] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const selectedGeography = useMemo(
    () => getGeographyOption(draft.primaryGeographyId),
    [draft.primaryGeographyId],
  );

  const serviceLabels = useMemo(
    () => draft.serviceGeographyIds.map((id) => getGeographyOption(id)?.name).filter(Boolean) as string[],
    [draft.serviceGeographyIds],
  );

  useEffect(() => {
    try {
      const savedDraft = window.sessionStorage.getItem(DRAFT_KEY);
      const savedStep = Number(window.sessionStorage.getItem(STEP_KEY));
      if (savedDraft) setDraft({ ...createInitialGeographyDraft(), ...JSON.parse(savedDraft) });
      if (Number.isInteger(savedStep) && savedStep >= 0 && savedStep < geographySteps.length) setStep(savedStep);
    } catch {
      window.sessionStorage.removeItem(DRAFT_KEY);
      window.sessionStorage.removeItem(STEP_KEY);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    window.sessionStorage.setItem(STEP_KEY, String(step));
  }, [draft, step, hydrated]);

  function selectPrimaryGeography(id: string) {
    setErrors([]);
    setDraft((current) => ({
      ...current,
      primaryGeographyId: id,
      mapConfirmed: false,
      serviceGeographyIds: current.serviceGeographyIds.includes(id)
        ? current.serviceGeographyIds
        : [id, ...current.serviceGeographyIds],
    }));
  }

  function updateBaseLocation(field: keyof GeographyDraft["baseLocation"], value: string | boolean) {
    setErrors([]);
    setDraft((current) => ({
      ...current,
      mapConfirmed: false,
      baseLocation: { ...current.baseLocation, [field]: value },
    }));
  }

  function toggleServiceGeography(id: string) {
    setDraft((current) => ({
      ...current,
      serviceGeographyIds: current.serviceGeographyIds.includes(id)
        ? current.serviceGeographyIds.filter((item) => item !== id)
        : [...current.serviceGeographyIds, id],
    }));
  }

  function chooseServiceMode(mode: ServiceAreaMode) {
    setErrors([]);
    setDraft((current) => ({
      ...current,
      serviceMode: mode,
      serviceGeographyIds:
        mode === "localities" && current.serviceGeographyIds.length === 0 && current.primaryGeographyId
          ? [current.primaryGeographyId]
          : current.serviceGeographyIds,
    }));
  }

  function canAdvance() {
    if (step === 0) return Boolean(selectedGeography?.primarySelectable && selectedGeography.releaseState === "released");
    if (step === 1) {
      return Boolean(
        draft.baseLocation.address1.trim() &&
          draft.baseLocation.city.trim() &&
          draft.baseLocation.state.trim() &&
          draft.baseLocation.postalCode.trim(),
      );
    }
    if (step === 2) return draft.mapConfirmed;
    if (step === 4) return draft.serviceMode !== "localities" || draft.serviceGeographyIds.length > 0;
    return true;
  }

  function goNext() {
    setErrors([]);
    if (!canAdvance()) return;
    setStep((current) => Math.min(current + 1, geographySteps.length - 1));
  }

  function goBack() {
    setErrors([]);
    setStep((current) => Math.max(current - 1, 0));
  }

  function saveAndExit() {
    window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    window.sessionStorage.setItem(STEP_KEY, String(step));
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
      router.push("/onboarding?step=profile");
    } catch {
      setErrors(["The Geography validation service is unavailable. Your draft remains saved in this session."]);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className={styles.shell}>
      <section className={styles.frame} aria-labelledby="geography-title">
        <header className={styles.header}>
          <div>
            <Link className={styles.brand} href="/onboarding">RFxchange</Link>
            <p className={styles.eyebrow}>Identity &amp; onboarding</p>
          </div>
          <button className={styles.exitButton} type="button" onClick={saveAndExit}>Save &amp; exit</button>
        </header>

        <ol className={styles.stageRail} aria-label="Onboarding progress">
          {onboardingStages.map((stage, index) => (
            <li key={stage} className={index < 2 ? styles.stageComplete : index === 2 ? styles.stageActive : styles.stageFuture}>
              <span>{index < 2 ? "✓" : index + 1}</span>
              <small>{stage}</small>
            </li>
          ))}
        </ol>

        <div className={styles.headingRow}>
          <div>
            <p className={styles.sectionLabel}>Geography · {step + 1} of {geographySteps.length}</p>
            <h1 id="geography-title">{geographySteps[step]}</h1>
          </div>
          <div className={styles.progressTrack} aria-hidden="true">
            <span style={{ width: `${((step + 1) / geographySteps.length) * 100}%` }} />
          </div>
        </div>

        <div className={styles.body}>
          {step === 0 && (
            <PrimaryGeographyStep selectedId={draft.primaryGeographyId} onSelect={selectPrimaryGeography} />
          )}

          {step === 1 && (
            <BaseLocationStep draft={draft} onChange={updateBaseLocation} primaryName={selectedGeography?.name} />
          )}

          {step === 2 && (
            <MapConfirmationStep
              draft={draft}
              geography={selectedGeography}
              onConfirm={() => setDraft((current) => ({ ...current, mapConfirmed: true }))}
            />
          )}

          {step === 3 && (
            <PrivacyStep
              value={draft.visibility}
              homeBased={draft.baseLocation.homeBased}
              onChange={(visibility) => setDraft((current) => ({ ...current, visibility }))}
            />
          )}

          {step === 4 && (
            <ServiceGeographyStep draft={draft} onMode={chooseServiceMode} onToggle={toggleServiceGeography} />
          )}

          {step === 5 && (
            <ReviewStep draft={draft} primaryName={selectedGeography?.name} serviceLabels={serviceLabels} />
          )}
        </div>

        {errors.length > 0 && (
          <div className={styles.errorBox} role="alert">
            <strong>Geography needs attention</strong>
            <ul>{errors.map((error) => <li key={error}>{error}</li>)}</ul>
          </div>
        )}

        <footer className={styles.actions}>
          <button className={styles.secondaryButton} type="button" onClick={goBack} disabled={step === 0}>Back</button>
          {step < geographySteps.length - 1 ? (
            <button className={styles.primaryButton} type="button" onClick={goNext} disabled={!canAdvance()}>Continue</button>
          ) : (
            <button className={styles.primaryButton} type="button" onClick={completeGeography} disabled={submitting}>
              {submitting ? "Validating…" : "Complete geography"}
            </button>
          )}
        </footer>
      </section>
    </main>
  );
}

function PrimaryGeographyStep({ selectedId, onSelect }: { selectedId: string; onSelect: (id: string) => void }) {
  const [query, setQuery] = useState("");
  const options = geographyOptions.filter((option) =>
    `${option.name} ${option.stateCode}`.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const selected = getGeographyOption(selectedId);

  return (
    <div className={styles.stepPanel}>
      <div className={styles.copyBlock}>
        <h2>Where should your organization enter the Exchange?</h2>
        <p>Choose the authoritative city or county that establishes your primary RFxchange geography. Physical location and service territory are captured separately.</p>
      </div>
      <label className={styles.fieldLabel}>
        Search city or county
        <input className={styles.input} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search geography" />
      </label>
      <div className={styles.optionList}>
        {options.map((option) => (
          <button
            type="button"
            key={option.id}
            className={`${styles.optionCard} ${selectedId === option.id ? styles.optionSelected : ""}`}
            onClick={() => onSelect(option.id)}
          >
            <span>
              <strong>{option.name}</strong>
              <small>{option.stateCode} · {titleCase(option.type)}</small>
            </span>
            <em className={option.releaseState === "released" ? styles.releasedBadge : styles.visibleBadge}>
              {option.releaseState === "released" ? "Released" : "Visible · not released"}
            </em>
          </button>
        ))}
      </div>
      {selected && !selected.primarySelectable && (
        <div className={styles.notice}>
          <strong>{selected.name} is visible but not released for primary activation in this reference registry.</strong>
          <span>Select a released locality to continue. Production policy will come from the server geography service.</span>
        </div>
      )}
    </div>
  );
}

function BaseLocationStep({
  draft,
  onChange,
  primaryName,
}: {
  draft: GeographyDraft;
  onChange: (field: keyof GeographyDraft["baseLocation"], value: string | boolean) => void;
  primaryName?: string;
}) {
  const location = draft.baseLocation;
  return (
    <div className={styles.stepPanel}>
      <div className={styles.copyBlock}>
        <h2>Where is the organization actually based?</h2>
        <p>This creates the canonical base location for {primaryName ?? "the selected geography"}. Entering an address does not automatically make the exact point public.</p>
      </div>
      <div className={styles.formGrid}>
        <label className={`${styles.fieldLabel} ${styles.fieldWide}`}>Street address<input className={styles.input} value={location.address1} onChange={(event) => onChange("address1", event.target.value)} autoComplete="street-address" /></label>
        <label className={`${styles.fieldLabel} ${styles.fieldWide}`}>Address line 2 <span>Optional</span><input className={styles.input} value={location.address2} onChange={(event) => onChange("address2", event.target.value)} /></label>
        <label className={styles.fieldLabel}>City<input className={styles.input} value={location.city} onChange={(event) => onChange("city", event.target.value)} autoComplete="address-level2" /></label>
        <label className={styles.fieldLabel}>State<input className={styles.input} value={location.state} maxLength={2} onChange={(event) => onChange("state", event.target.value)} autoComplete="address-level1" /></label>
        <label className={styles.fieldLabel}>ZIP code<input className={styles.input} value={location.postalCode} onChange={(event) => onChange("postalCode", event.target.value)} autoComplete="postal-code" /></label>
      </div>
      <label className={styles.checkboxRow}>
        <input type="checkbox" checked={location.homeBased} onChange={(event) => onChange("homeBased", event.target.checked)} />
        <span><strong>This is a home-based business</strong><small>RFxchange can protect the precise public location independently of the stored base location.</small></span>
      </label>
    </div>
  );
}

function MapConfirmationStep({
  draft,
  geography,
  onConfirm,
}: {
  draft: GeographyDraft;
  geography: ReturnType<typeof getGeographyOption>;
  onConfirm: () => void;
}) {
  const marker = geography?.previewPosition ?? { x: 50, y: 50 };
  return (
    <div className={styles.stepPanel}>
      <div className={styles.copyBlock}>
        <h2>Confirm the organization's map context</h2>
        <p>The reference chassis centers the selected locality and previews a marker. A production geocoder will replace this preview and resolve the submitted street address before persistence.</p>
      </div>
      <div className={styles.mapPreview} aria-label={`Reference map preview for ${geography?.name ?? "selected geography"}`}>
        <div className={styles.mapWater} />
        <div className={styles.mapRoadOne} />
        <div className={styles.mapRoadTwo} />
        <div className={styles.localityBoundary} />
        <span className={styles.localityLabel}>{geography?.name ?? "Primary geography"}</span>
        <span className={styles.previewMarker} style={{ left: `${marker.x}%`, top: `${marker.y}%` }}>●</span>
        <span className={styles.mapNote}>Reference placement preview · map provider plugs in later</span>
      </div>
      <div className={styles.locationSummary}>
        <div>
          <small>Base address</small>
          <strong>{draft.baseLocation.address1}</strong>
          <span>{draft.baseLocation.city}, {draft.baseLocation.state} {draft.baseLocation.postalCode}</span>
        </div>
        <button className={draft.mapConfirmed ? styles.confirmedButton : styles.confirmButton} type="button" onClick={onConfirm}>
          {draft.mapConfirmed ? "✓ Placement confirmed" : "Confirm placement"}
        </button>
      </div>
    </div>
  );
}

function PrivacyStep({
  value,
  homeBased,
  onChange,
}: {
  value: LocationVisibility;
  homeBased: boolean;
  onChange: (visibility: LocationVisibility) => void;
}) {
  const options: Array<{ id: LocationVisibility; title: string; copy: string }> = [
    { id: "exact", title: "Exact location", copy: "Show the confirmed organization point to other authorized Exchange users." },
    { id: "approximate", title: "Approximate location", copy: "Keep the canonical point private and display a nearby safe projection." },
    { id: "locality_only", title: "Locality only", copy: "Show the organization in its locality without exposing street-level placement." },
  ];
  return (
    <div className={styles.stepPanel}>
      <div className={styles.copyBlock}>
        <h2>How should this location appear in RFxchange?</h2>
        <p>Public presentation is separate from the canonical location used for geography validation and matching.</p>
      </div>
      {homeBased && <div className={styles.notice}><strong>Home-based organization</strong><span>Approximate or locality-only presentation is recommended in this reference flow.</span></div>}
      <div className={styles.choiceList}>
        {options.map((option) => (
          <label key={option.id} className={`${styles.choiceCard} ${value === option.id ? styles.choiceSelected : ""}`}>
            <input type="radio" name="visibility" value={option.id} checked={value === option.id} onChange={() => onChange(option.id)} />
            <span><strong>{option.title}</strong><small>{option.copy}</small></span>
          </label>
        ))}
      </div>
    </div>
  );
}

function ServiceGeographyStep({
  draft,
  onMode,
  onToggle,
}: {
  draft: GeographyDraft;
  onMode: (mode: ServiceAreaMode) => void;
  onToggle: (id: string) => void;
}) {
  const modes: Array<{ id: ServiceAreaMode; title: string; copy: string }> = [
    { id: "localities", title: "Selected localities", copy: "Choose the cities and counties where this organization can perform work." },
    { id: "statewide", title: "Statewide", copy: "The organization serves the entire state represented by its primary geography." },
    { id: "nationwide", title: "Nationwide", copy: "The organization can serve customers across the United States." },
    { id: "remote", title: "Remote / virtual", copy: "Service delivery is not constrained to a physical operating territory." },
  ];

  return (
    <div className={styles.stepPanel}>
      <div className={styles.copyBlock}>
        <h2>Where can the organization provide products or services?</h2>
        <p>Service geography is intentionally independent from the organization's base location and primary Exchange locality.</p>
      </div>
      <div className={styles.modeGrid}>
        {modes.map((mode) => (
          <button type="button" key={mode.id} className={`${styles.modeCard} ${draft.serviceMode === mode.id ? styles.modeSelected : ""}`} onClick={() => onMode(mode.id)}>
            <strong>{mode.title}</strong>
            <small>{mode.copy}</small>
          </button>
        ))}
      </div>
      {draft.serviceMode === "localities" && (
        <div className={styles.serviceList}>
          {geographyOptions.map((option) => (
            <label className={styles.checkboxRow} key={option.id}>
              <input type="checkbox" checked={draft.serviceGeographyIds.includes(option.id)} onChange={() => onToggle(option.id)} />
              <span><strong>{option.name}</strong><small>{option.stateCode} · service-area selection is independent of launch state</small></span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function ReviewStep({
  draft,
  primaryName,
  serviceLabels,
}: {
  draft: GeographyDraft;
  primaryName?: string;
  serviceLabels: string[];
}) {
  const serviceSummary =
    draft.serviceMode === "localities" ? serviceLabels.join(", ") : titleCase(draft.serviceMode);
  return (
    <div className={styles.stepPanel}>
      <div className={styles.copyBlock}>
        <h2>Geography is ready for validation</h2>
        <p>Completing this step creates the Geography Context used by Organization Profile, Capability enrichment, and the first authenticated Exchange camera.</p>
      </div>
      <dl className={styles.reviewGrid}>
        <div><dt>Primary geography</dt><dd>{primaryName ?? "Not selected"}</dd></div>
        <div><dt>Base location</dt><dd>{draft.baseLocation.city}, {draft.baseLocation.state} {draft.baseLocation.postalCode}</dd></div>
        <div><dt>Map placement</dt><dd>{draft.mapConfirmed ? "Confirmed" : "Not confirmed"}</dd></div>
        <div><dt>Public location</dt><dd>{titleCase(draft.visibility)}</dd></div>
        <div className={styles.reviewWide}><dt>Service geography</dt><dd>{serviceSummary || "Not selected"}</dd></div>
      </dl>
      <div className={styles.integrationNote}>
        <strong>Operating-chassis handoff</strong>
        <span>The validated context is session-backed in this reference implementation. Production persistence, authoritative FIPS/boundaries, address geocoding, organization permissions, and policy enforcement plug into the server seam without changing the Identity-shell composition.</span>
      </div>
    </div>
  );
}
