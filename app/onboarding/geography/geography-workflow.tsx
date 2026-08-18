"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import {
  buildOsmEmbedUrl,
  createInitialGeographyDraft,
  geographyNavigation,
  geographyNode,
  type BaseLocationDraft,
  type GeocodeMatch,
  type GeographyContext,
  type GeographyDraft,
  type GeographyMismatch,
  type GeographyOption,
  type GeographyStage,
  type LocationVisibility,
  type ServiceAreaMode,
} from "@/lib/onboarding/geography";
import styles from "./geography.module.css";

const DRAFT_KEY = "rfxchange.onboarding.geography.draft.v2";
const CONTEXT_KEY = "rfxchange.geography-context";
const ORGANIZATION_KEY = "rfxchange.onboarding.organization";
const onboardingStages = ["Account", "Organization", "Geography", "Profile", "Capabilities", "Exchange ready"];

type SetDraft = Dispatch<SetStateAction<GeographyDraft>>;
type Navigate = (stage: GeographyStage, task: string) => void;

interface GeographyWorkflowProps { initialStage: GeographyStage; initialTask: string; }
interface SearchResponse { geographies?: GeographyOption[]; geography?: GeographyOption; error?: string; source?: string; }
interface GeocodeResponse { match?: GeocodeMatch; primaryGeography?: GeographyOption | null; mismatch?: GeographyMismatch | null; error?: string; }
interface CompletionResponse { context?: GeographyContext; errors?: string[]; services?: Record<string, string>; }

function titleCase(value: string) {
  return value.split("_").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

function releaseLabel(state: GeographyOption["releaseState"]) {
  if (state === "released") return "Released";
  if (state === "limited") return "Limited";
  if (state === "restricted") return "Restricted";
  return "Visible · not released";
}

function taskHref(stage: GeographyStage, task: string) { return `/onboarding/geography/${stage}/${task}`; }

function parseStoredDraft(raw: string | null): GeographyDraft | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<GeographyDraft>;
    const initial = createInitialGeographyDraft();
    return {
      ...initial,
      ...parsed,
      baseLocation: { ...initial.baseLocation, ...(parsed.baseLocation ?? {}) },
      serviceGeographies: Array.isArray(parsed.serviceGeographies) ? parsed.serviceGeographies : [],
    };
  } catch { return null; }
}

function profileHandoffHref(context: GeographyContext) {
  const params = new URLSearchParams({ geography: context.primaryGeography.name });
  try {
    const raw = window.localStorage.getItem(ORGANIZATION_KEY) ?? window.sessionStorage.getItem(ORGANIZATION_KEY);
    if (raw) {
      const organization = JSON.parse(raw) as { organizationId?: string; organizationName?: string; mode?: "claim" | "join" | "create" };
      if (organization.organizationId) params.set("organization", organization.organizationId);
      if (organization.organizationName) params.set("name", organization.organizationName);
      if (organization.mode === "create") params.set("claim", "created");
      else if (organization.mode === "claim") params.set("claim", "claimed");
      else if (organization.mode === "join") params.set("claim", "selected");
    }
  } catch {
    // Geography remains valid even when an older organization-session payload is unreadable.
  }
  return `/onboarding/organization-profile?${params.toString()}`;
}

function useGeographySearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeographyOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function search() {
    const value = query.trim();
    if (value.length < 2) { setError("Enter at least two characters to search."); return; }
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/onboarding/geography/search?q=${encodeURIComponent(value)}`, { cache: "no-store" });
      const payload = (await response.json()) as SearchResponse;
      if (!response.ok) throw new Error(payload.error ?? "Locality search is unavailable.");
      setResults(payload.geographies ?? []);
    } catch (caught) {
      setResults([]);
      setError(caught instanceof Error ? caught.message : "Locality search is unavailable.");
    } finally { setLoading(false); }
  }

  return { query, setQuery, results, loading, error, search };
}

export function GeographyWorkflow({ initialStage, initialTask }: GeographyWorkflowProps) {
  const router = useRouter();
  const [draft, setDraft] = useState<GeographyDraft>(() => createInitialGeographyDraft());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = parseStoredDraft(window.localStorage.getItem(DRAFT_KEY));
    if (stored) setDraft(stored);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }, [draft, hydrated]);

  const currentNode = geographyNode(initialStage) ?? geographyNavigation[0];
  const currentIndex = geographyNavigation.findIndex((node) => node.id === currentNode.id);
  const navigate: Navigate = (stage, task) => router.push(taskHref(stage, task));

  function updateBaseLocation(field: keyof BaseLocationDraft, value: string | boolean) {
    setDraft((current) => ({ ...current, baseLocation: { ...current.baseLocation, [field]: value }, geocode: null, mismatch: null, mapConfirmed: false }));
  }

  function saveAndExit() {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    router.push("/onboarding");
  }

  function childVisible(conditional?: "mismatch" | "localities") {
    if (!conditional) return true;
    return conditional === "mismatch" ? draft.mismatch?.status === "mismatch" : draft.serviceMode === "localities";
  }

  return (
    <main className={styles.shell}>
      <section className={styles.frame} aria-labelledby="geography-title">
        <header className={styles.header}>
          <div><Link className={styles.brand} href="/onboarding">RFxchange</Link><p className={styles.eyebrow}>Identity &amp; onboarding</p></div>
          <button className={styles.exitButton} type="button" onClick={saveAndExit}>Save &amp; exit</button>
        </header>

        <ol className={styles.stageRail} aria-label="Onboarding progress">
          {onboardingStages.map((stage, index) => (
            <li key={stage} className={index < 2 ? styles.stageComplete : index === 2 ? styles.stageActive : styles.stageFuture}>
              <span>{index < 2 ? "✓" : index + 1}</span><small>{stage}</small>
            </li>
          ))}
        </ol>

        <div className={styles.headingRow}>
          <div><p className={styles.sectionLabel}>Geography · {currentIndex + 1} of {geographyNavigation.length}</p><h1 id="geography-title">{currentNode.label}</h1></div>
          <div className={styles.progressTrack} aria-hidden="true"><span style={{ width: `${((currentIndex + 1) / geographyNavigation.length) * 100}%` }} /></div>
        </div>

        <div className={styles.workflowLayout}>
          <nav className={styles.treeNav} aria-label="Geography workflow">
            {geographyNavigation.map((node, index) => (
              <div className={styles.treeNode} key={node.id}>
                <Link className={`${styles.treeStage} ${node.id === initialStage ? styles.treeStageActive : ""}`} href={node.href}>
                  <span>{index + 1}</span><strong>{node.label}</strong>
                </Link>
                <div className={styles.treeChildren}>
                  {node.children.filter((child) => childVisible(child.conditional)).map((child) => (
                    <Link key={child.id} className={`${styles.treeLeaf} ${node.id === initialStage && child.id === initialTask ? styles.treeLeafActive : ""}`} href={child.href}>{child.label}</Link>
                  ))}
                </div>
              </div>
            ))}
          </nav>

          <div className={styles.body}>
            {!hydrated ? <div className={styles.notice}><strong>Loading saved Geography progress…</strong></div> : (
              <TaskSurface stage={initialStage} task={initialTask} draft={draft} setDraft={setDraft} navigate={navigate} updateBaseLocation={updateBaseLocation} />
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

function TaskSurface({ stage, task, draft, setDraft, navigate, updateBaseLocation }: {
  stage: GeographyStage; task: string; draft: GeographyDraft; setDraft: SetDraft; navigate: Navigate;
  updateBaseLocation: (field: keyof BaseLocationDraft, value: string | boolean) => void;
}) {
  if (stage === "primary-locality" && task === "search") return <PrimaryLocalitySearch draft={draft} setDraft={setDraft} navigate={navigate} />;
  if (stage === "primary-locality" && task === "availability") return <AvailabilityBoundary draft={draft} setDraft={setDraft} navigate={navigate} />;
  if (stage === "base-location" && task === "address") return <BaseAddress draft={draft} updateBaseLocation={updateBaseLocation} navigate={navigate} />;
  if (stage === "base-location" && task === "geocode") return <GeocodeAddress draft={draft} setDraft={setDraft} navigate={navigate} />;
  if (stage === "base-location" && task === "mismatch") return <MismatchResolution draft={draft} setDraft={setDraft} navigate={navigate} />;
  if (stage === "map-placement" && task === "confirm") return <MapPlacement draft={draft} setDraft={setDraft} navigate={navigate} />;
  if (stage === "privacy" && task === "visibility") return <PrivacyVisibility draft={draft} setDraft={setDraft} navigate={navigate} />;
  if (stage === "service-geography" && task === "coverage") return <ServiceCoverage draft={draft} setDraft={setDraft} navigate={navigate} />;
  if (stage === "service-geography" && task === "localities") return <ServiceLocalities draft={draft} setDraft={setDraft} navigate={navigate} />;
  if (stage === "review" && task === "summary") return <ReviewSummary draft={draft} navigate={navigate} />;
  if (stage === "review" && task === "complete") return <CompleteGeography draft={draft} navigate={navigate} />;
  return <div className={styles.notice}><strong>This Geography workflow route is not available.</strong></div>;
}

function PrimaryLocalitySearch({ draft, setDraft, navigate }: { draft: GeographyDraft; setDraft: SetDraft; navigate: Navigate }) {
  const search = useGeographySearch();
  function select(option: GeographyOption) {
    setDraft((current) => ({
      ...current, primaryGeography: option, geocode: null, mismatch: null, mapConfirmed: false,
      serviceGeographies: current.serviceGeographies.some((item) => item.id === option.id) ? current.serviceGeographies : [option, ...current.serviceGeographies],
    }));
    navigate("primary-locality", "availability");
  }
  return (
    <div className={styles.stepPanel}>
      <div className={styles.copyBlock}><h2>Search the U.S. Census geography registry</h2><p>Select the authoritative county, independent city, incorporated place, or census-designated place that establishes the organization&apos;s primary RFxchange geography.</p></div>
      <div className={styles.searchRow}>
        <input className={styles.input} value={search.query} onChange={(event) => search.setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void search.search(); }} placeholder="County or city, e.g. Isle of Wight" aria-label="Search county or city" />
        <button className={styles.primaryButton} type="button" onClick={() => void search.search()} disabled={search.loading}>{search.loading ? "Searching…" : "Search"}</button>
      </div>
      {search.error ? <div className={styles.errorBox} role="alert">{search.error}</div> : null}
      {draft.primaryGeography ? <div className={styles.notice}><strong>Current primary geography: {draft.primaryGeography.name}, {draft.primaryGeography.stateCode}</strong><span>GEOID {draft.primaryGeography.geoid}</span></div> : null}
      <div className={styles.optionList} aria-live="polite">
        {search.results.map((option) => (
          <button className={styles.optionCard} type="button" key={option.id} onClick={() => select(option)}>
            <span><strong>{option.name}</strong><small>{option.stateCode} · {titleCase(option.type)} · GEOID {option.geoid}</small></span>
            <em className={option.releaseState === "released" ? styles.releasedBadge : styles.visibleBadge}>{releaseLabel(option.releaseState)}</em>
          </button>
        ))}
      </div>
      <p className={styles.sourceNote}>Geography results come server-side from U.S. Census TIGERweb. RFxchange release state is applied by server policy.</p>
    </div>
  );
}

function AvailabilityBoundary({ draft, setDraft, navigate }: { draft: GeographyDraft; setDraft: SetDraft; navigate: Navigate }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const selected = draft.primaryGeography;
  const selectedId = selected?.id;
  const hasBounds = Boolean(selected?.bounds);

  useEffect(() => {
    if (!selectedId || hasBounds) return;
    let cancelled = false;
    setLoading(true); setError("");
    fetch(`/api/onboarding/geography/search?id=${encodeURIComponent(selectedId)}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json()) as SearchResponse;
        if (!response.ok || !payload.geography) throw new Error(payload.error ?? "Geography boundary lookup failed.");
        if (!cancelled) setDraft((current) => ({ ...current, primaryGeography: payload.geography ?? current.primaryGeography }));
      })
      .catch((caught) => { if (!cancelled) setError(caught instanceof Error ? caught.message : "Geography boundary lookup failed."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [selectedId, hasBounds, setDraft]);

  if (!selected) return <Prerequisite title="Select a primary locality first" action="Search locality" onAction={() => navigate("primary-locality", "search")} />;
  const released = selected.releaseState === "released" && selected.primarySelectable;
  return (
    <div className={styles.stepPanel}>
      <div className={styles.copyBlock}><h2>Availability &amp; market boundary</h2><p>RFxchange validates the Census geography, loads its map extent, and applies the current release policy before continuation.</p></div>
      <dl className={styles.reviewGrid}>
        <div><dt>Primary locality</dt><dd>{selected.name}, {selected.stateCode}</dd></div><div><dt>Census GEOID</dt><dd>{selected.geoid}</dd></div>
        <div><dt>Geography type</dt><dd>{titleCase(selected.type)}</dd></div><div><dt>Availability</dt><dd>{releaseLabel(selected.releaseState)}</dd></div>
        <div className={styles.reviewWide}><dt>Boundary extent</dt><dd>{selected.bounds ? `${selected.bounds.west.toFixed(4)}, ${selected.bounds.south.toFixed(4)} → ${selected.bounds.east.toFixed(4)}, ${selected.bounds.north.toFixed(4)}` : loading ? "Loading Census boundary…" : "Boundary unavailable"}</dd></div>
      </dl>
      {error ? <div className={styles.errorBox} role="alert">{error}</div> : null}
      {!released ? <div className={styles.notice}><strong>{selected.name} is represented in the network but is not released for primary activation.</strong><span>Select a released geography to proceed. Service areas may still include unreleased localities later.</span></div> : null}
      <div className={styles.taskActions}><button className={styles.secondaryButton} type="button" onClick={() => navigate("primary-locality", "search")}>Change locality</button><button className={styles.primaryButton} type="button" disabled={!released || loading} onClick={() => navigate("base-location", "address")}>Continue to base location</button></div>
    </div>
  );
}

function BaseAddress({ draft, updateBaseLocation, navigate }: { draft: GeographyDraft; updateBaseLocation: (field: keyof BaseLocationDraft, value: string | boolean) => void; navigate: Navigate }) {
  const location = draft.baseLocation;
  const complete = Boolean(location.address1.trim() && location.city.trim() && location.state.trim() && location.postalCode.trim());
  return (
    <div className={styles.stepPanel}>
      <div className={styles.copyBlock}><h2>Physical base address</h2><p>This is the organization&apos;s canonical operating location. Public map precision is selected separately.</p></div>
      <div className={styles.formGrid}>
        <label className={`${styles.fieldLabel} ${styles.fieldWide}`}>Street address<input className={styles.input} value={location.address1} onChange={(event) => updateBaseLocation("address1", event.target.value)} autoComplete="street-address" /></label>
        <label className={`${styles.fieldLabel} ${styles.fieldWide}`}>Address line 2 <span>Optional</span><input className={styles.input} value={location.address2} onChange={(event) => updateBaseLocation("address2", event.target.value)} /></label>
        <label className={styles.fieldLabel}>City<input className={styles.input} value={location.city} onChange={(event) => updateBaseLocation("city", event.target.value)} autoComplete="address-level2" /></label>
        <label className={styles.fieldLabel}>State<input className={styles.input} value={location.state} maxLength={2} onChange={(event) => updateBaseLocation("state", event.target.value)} autoComplete="address-level1" /></label>
        <label className={styles.fieldLabel}>ZIP code<input className={styles.input} value={location.postalCode} onChange={(event) => updateBaseLocation("postalCode", event.target.value)} autoComplete="postal-code" /></label>
      </div>
      <label className={styles.checkboxRow}><input type="checkbox" checked={location.homeBased} onChange={(event) => updateBaseLocation("homeBased", event.target.checked)} /><span><strong>This is a home-based business</strong><small>The canonical location remains distinct from public map visibility.</small></span></label>
      <div className={styles.taskActions}><button className={styles.secondaryButton} type="button" onClick={() => navigate("primary-locality", "availability")}>Back</button><button className={styles.primaryButton} type="button" disabled={!complete} onClick={() => navigate("base-location", "geocode")}>Geocode address</button></div>
    </div>
  );
}

function GeocodeAddress({ draft, setDraft, navigate }: { draft: GeographyDraft; setDraft: SetDraft; navigate: Navigate }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const hasAddress = Boolean(draft.baseLocation.address1 && draft.baseLocation.city && draft.baseLocation.state && draft.baseLocation.postalCode);
  async function geocode() {
    if (!hasAddress || !draft.primaryGeography) return;
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/onboarding/geography/geocode", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ address: draft.baseLocation, primaryGeographyId: draft.primaryGeography.id }) });
      const payload = (await response.json()) as GeocodeResponse;
      if (!response.ok || !payload.match) throw new Error(payload.error ?? "The address could not be geocoded.");
      setDraft((current) => ({ ...current, primaryGeography: payload.primaryGeography ?? current.primaryGeography, geocode: payload.match ?? null, mismatch: payload.mismatch ?? { status: "unresolved" }, mapConfirmed: false }));
      navigate(payload.mismatch?.status === "mismatch" ? "base-location" : "map-placement", payload.mismatch?.status === "mismatch" ? "mismatch" : "confirm");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "The address could not be geocoded."); }
    finally { setLoading(false); }
  }
  if (!draft.primaryGeography) return <Prerequisite title="Select a primary locality first" action="Search locality" onAction={() => navigate("primary-locality", "search")} />;
  if (!hasAddress) return <Prerequisite title="Enter the base address first" action="Enter address" onAction={() => navigate("base-location", "address")} />;
  return (
    <div className={styles.stepPanel}>
      <div className={styles.copyBlock}><h2>Geocode &amp; normalize the address</h2><p>The server sends the address to the U.S. Census Geocoder, retrieves coordinates and geography, and compares the result with the selected locality.</p></div>
      <div className={styles.locationSummary}><div><small>Entered address</small><strong>{draft.baseLocation.address1}</strong><span>{draft.baseLocation.city}, {draft.baseLocation.state} {draft.baseLocation.postalCode}</span></div><button className={styles.primaryButton} type="button" onClick={() => void geocode()} disabled={loading}>{loading ? "Geocoding…" : draft.geocode ? "Geocode again" : "Geocode address"}</button></div>
      {draft.geocode ? <dl className={styles.reviewGrid}><div className={styles.reviewWide}><dt>Matched address</dt><dd>{draft.geocode.matchedAddress}</dd></div><div><dt>Latitude</dt><dd>{draft.geocode.coordinates.latitude.toFixed(6)}</dd></div><div><dt>Longitude</dt><dd>{draft.geocode.coordinates.longitude.toFixed(6)}</dd></div><div><dt>County</dt><dd>{draft.geocode.county?.name ?? "Not returned"}</dd></div><div><dt>Place</dt><dd>{draft.geocode.place?.name ?? "Not returned"}</dd></div></dl> : null}
      {error ? <div className={styles.errorBox} role="alert">{error}</div> : null}
      <div className={styles.taskActions}><button className={styles.secondaryButton} type="button" onClick={() => navigate("base-location", "address")}>Edit address</button></div>
      <p className={styles.sourceNote}>Geocoding is performed by the U.S. Census Geocoder. Browser-generated coordinates are not accepted as final Geography truth.</p>
    </div>
  );
}

function MismatchResolution({ draft, setDraft, navigate }: { draft: GeographyDraft; setDraft: SetDraft; navigate: Navigate }) {
  const mismatch = draft.mismatch;
  const [explanation, setExplanation] = useState(mismatch?.explanation ?? "");
  if (!mismatch || mismatch.status !== "mismatch") return <Prerequisite title="No unresolved locality mismatch exists" action="Continue to map placement" onAction={() => navigate("map-placement", "confirm")} />;
  const activeMismatch: GeographyMismatch = mismatch;
  const detected = activeMismatch.detectedGeography;

  function useDetected() {
    if (!detected) return;
    setDraft((current) => ({
      ...current,
      primaryGeography: detected,
      mismatch: { ...activeMismatch, status: "mismatch", resolution: "use_detected" },
      serviceGeographies: current.serviceGeographies.some((item) => item.id === detected.id) ? current.serviceGeographies : [detected, ...current.serviceGeographies],
    }));
    navigate("map-placement", "confirm");
  }

  function keepSelected() {
    if (!explanation.trim()) return;
    setDraft((current) => ({ ...current, mismatch: { ...activeMismatch, status: "mismatch", resolution: "keep_selected", explanation: explanation.trim() } }));
    navigate("map-placement", "confirm");
  }

  return (
    <div className={styles.stepPanel}>
      <div className={styles.copyBlock}><h2>Resolve the locality mismatch</h2><p>The geocoded address falls in a different authoritative geography than the selected primary locality. RFxchange will not silently change either value.</p></div>
      <dl className={styles.reviewGrid}><div><dt>Selected geography</dt><dd>{draft.primaryGeography ? `${draft.primaryGeography.name}, ${draft.primaryGeography.stateCode}` : "None"}</dd></div><div><dt>Address geography</dt><dd>{detected ? `${detected.name}, ${detected.stateCode}` : draft.geocode?.county?.name ?? draft.geocode?.place?.name ?? "Detected but not resolved"}</dd></div></dl>
      {detected ? <div className={styles.choiceList}><button className={styles.choiceCard} type="button" onClick={useDetected}><span><strong>Use detected geography</strong><small>Change primary geography to the locality returned for the physical address. Final completion still enforces release policy.</small></span></button></div> : null}
      <label className={styles.fieldLabel}>Keep selected geography and explain why<textarea className={styles.textarea} rows={4} value={explanation} onChange={(event) => setExplanation(event.target.value)} placeholder="Explain why the selected primary geography differs from the physical address." /></label>
      <div className={styles.taskActions}><button className={styles.secondaryButton} type="button" onClick={() => navigate("base-location", "address")}>Edit address</button><button className={styles.primaryButton} type="button" disabled={!explanation.trim()} onClick={keepSelected}>Keep selected geography</button></div>
    </div>
  );
}

function MapPlacement({ draft, setDraft, navigate }: { draft: GeographyDraft; setDraft: SetDraft; navigate: Navigate }) {
  if (!draft.geocode) return <Prerequisite title="Geocode the address before map placement" action="Geocode address" onAction={() => navigate("base-location", "geocode")} />;
  if (draft.mismatch?.status === "mismatch" && !draft.mismatch.resolution) return <Prerequisite title="Resolve the locality mismatch first" action="Resolve mismatch" onAction={() => navigate("base-location", "mismatch")} />;
  const mapUrl = buildOsmEmbedUrl(draft.geocode.coordinates);
  return (
    <div className={styles.stepPanel}>
      <div className={styles.copyBlock}><h2>Confirm the geocoded marker</h2><p>The marker uses Census Geocoder coordinates on an OpenStreetMap base map. Confirm that the resolved placement represents the organization&apos;s base location.</p></div>
      <div className={styles.mapFrame}><iframe src={mapUrl} title={`Map placement for ${draft.geocode.matchedAddress}`} loading="lazy" /></div>
      <div className={styles.locationSummary}><div><small>Matched address</small><strong>{draft.geocode.matchedAddress}</strong><span>{draft.geocode.coordinates.latitude.toFixed(6)}, {draft.geocode.coordinates.longitude.toFixed(6)}</span></div><button className={draft.mapConfirmed ? styles.confirmedButton : styles.confirmButton} type="button" onClick={() => setDraft((current) => ({ ...current, mapConfirmed: true }))}>{draft.mapConfirmed ? "✓ Placement confirmed" : "Confirm placement"}</button></div>
      <div className={styles.taskActions}><button className={styles.secondaryButton} type="button" onClick={() => navigate("base-location", "address")}>Edit address</button><button className={styles.primaryButton} type="button" disabled={!draft.mapConfirmed} onClick={() => navigate("privacy", "visibility")}>Continue to privacy</button></div>
      <p className={styles.sourceNote}>Map tiles © OpenStreetMap contributors. Address coordinates come from the U.S. Census Geocoder.</p>
    </div>
  );
}

function PrivacyVisibility({ draft, setDraft, navigate }: { draft: GeographyDraft; setDraft: SetDraft; navigate: Navigate }) {
  const options: Array<{ id: LocationVisibility; title: string; copy: string }> = [
    { id: "exact", title: "Exact location", copy: "Use the confirmed geocoded point for Exchange presentation." },
    { id: "approximate", title: "Approximate location", copy: "Keep the canonical point private and use the primary locality centroid when available." },
    { id: "locality_only", title: "Locality only", copy: "Expose the locality name without a public organization coordinate." },
  ];
  return (
    <div className={styles.stepPanel}>
      <div className={styles.copyBlock}><h2>Choose location visibility</h2><p>The canonical geocoded point remains available to authorized platform workflows; this setting controls the public Exchange projection.</p></div>
      {draft.baseLocation.homeBased ? <div className={styles.notice}><strong>Home-based organization</strong><span>Approximate or locality-only presentation avoids exposing the residential point.</span></div> : null}
      <div className={styles.choiceList}>{options.map((option) => <label className={`${styles.choiceCard} ${draft.visibility === option.id ? styles.choiceSelected : ""}`} key={option.id}><input type="radio" name="visibility" checked={draft.visibility === option.id} onChange={() => setDraft((current) => ({ ...current, visibility: option.id }))} /><span><strong>{option.title}</strong><small>{option.copy}</small></span></label>)}</div>
      <div className={styles.taskActions}><button className={styles.secondaryButton} type="button" onClick={() => navigate("map-placement", "confirm")}>Back to placement</button><button className={styles.primaryButton} type="button" onClick={() => navigate("service-geography", "coverage")}>Continue to service geography</button></div>
    </div>
  );
}

function ServiceCoverage({ draft, setDraft, navigate }: { draft: GeographyDraft; setDraft: SetDraft; navigate: Navigate }) {
  const modes: Array<{ id: ServiceAreaMode; title: string; copy: string }> = [
    { id: "localities", title: "Selected localities", copy: "Choose named Census geographies where the organization can perform work." },
    { id: "statewide", title: "Statewide", copy: "The organization serves the entire state of its primary geography." },
    { id: "nationwide", title: "Nationwide", copy: "The organization can serve customers across the United States." },
    { id: "remote", title: "Remote / virtual", copy: "Service delivery is not constrained to a physical operating territory." },
  ];
  return (
    <div className={styles.stepPanel}>
      <div className={styles.copyBlock}><h2>Choose service coverage</h2><p>Service geography is separate from both the base address and the primary RFxchange locality.</p></div>
      <div className={styles.modeGrid}>{modes.map((mode) => <button className={`${styles.modeCard} ${draft.serviceMode === mode.id ? styles.modeSelected : ""}`} type="button" key={mode.id} onClick={() => setDraft((current) => ({ ...current, serviceMode: mode.id }))}><strong>{mode.title}</strong><small>{mode.copy}</small></button>)}</div>
      <div className={styles.taskActions}><button className={styles.secondaryButton} type="button" onClick={() => navigate("privacy", "visibility")}>Back</button><button className={styles.primaryButton} type="button" onClick={() => navigate(draft.serviceMode === "localities" ? "service-geography" : "review", draft.serviceMode === "localities" ? "localities" : "summary")}>Continue</button></div>
    </div>
  );
}

function ServiceLocalities({ draft, setDraft, navigate }: { draft: GeographyDraft; setDraft: SetDraft; navigate: Navigate }) {
  const search = useGeographySearch();
  function toggle(option: GeographyOption) {
    setDraft((current) => ({ ...current, serviceGeographies: current.serviceGeographies.some((item) => item.id === option.id) ? current.serviceGeographies.filter((item) => item.id !== option.id) : [...current.serviceGeographies, option] }));
  }
  return (
    <div className={styles.stepPanel}>
      <div className={styles.copyBlock}><h2>Select service localities</h2><p>Add counties or places where the organization can provide products or services. Service-area selection is independent of RFxchange launch state.</p></div>
      <div className={styles.serviceList}>{draft.serviceGeographies.map((option) => <label className={styles.checkboxRow} key={option.id}><input type="checkbox" checked onChange={() => toggle(option)} /><span><strong>{option.name}, {option.stateCode}</strong><small>GEOID {option.geoid} · {releaseLabel(option.releaseState)}</small></span></label>)}</div>
      <div className={styles.searchRow}><input className={styles.input} value={search.query} onChange={(event) => search.setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void search.search(); }} placeholder="Add another county or city" /><button className={styles.primaryButton} type="button" onClick={() => void search.search()} disabled={search.loading}>{search.loading ? "Searching…" : "Search"}</button></div>
      {search.error ? <div className={styles.errorBox} role="alert">{search.error}</div> : null}
      <div className={styles.optionList}>{search.results.filter((option) => !draft.serviceGeographies.some((item) => item.id === option.id)).map((option) => <button className={styles.optionCard} type="button" key={option.id} onClick={() => toggle(option)}><span><strong>{option.name}</strong><small>{option.stateCode} · GEOID {option.geoid}</small></span><em className={styles.visibleBadge}>Add</em></button>)}</div>
      <div className={styles.taskActions}><button className={styles.secondaryButton} type="button" onClick={() => navigate("service-geography", "coverage")}>Coverage mode</button><button className={styles.primaryButton} type="button" disabled={draft.serviceGeographies.length === 0} onClick={() => navigate("review", "summary")}>Review geography</button></div>
    </div>
  );
}

function ReviewSummary({ draft, navigate }: { draft: GeographyDraft; navigate: Navigate }) {
  const serviceSummary = draft.serviceMode === "localities" ? draft.serviceGeographies.map((item) => `${item.name}, ${item.stateCode}`).join(", ") : titleCase(draft.serviceMode);
  return (
    <div className={styles.stepPanel}>
      <div className={styles.copyBlock}><h2>Review Geography</h2><p>Each section links back to the exact child workflow that owns the value.</p></div>
      <div className={styles.summaryCards}>
        <ReviewCard label="Primary geography" value={draft.primaryGeography ? `${draft.primaryGeography.name}, ${draft.primaryGeography.stateCode}` : "Not selected"} onEdit={() => navigate("primary-locality", "search")} />
        <ReviewCard label="Base location" value={draft.geocode?.matchedAddress ?? `${draft.baseLocation.address1}, ${draft.baseLocation.city}`} onEdit={() => navigate("base-location", "address")} />
        <ReviewCard label="Map placement" value={draft.mapConfirmed ? "Confirmed" : "Not confirmed"} onEdit={() => navigate("map-placement", "confirm")} />
        <ReviewCard label="Public location" value={titleCase(draft.visibility)} onEdit={() => navigate("privacy", "visibility")} />
        <ReviewCard label="Service geography" value={serviceSummary || "Not selected"} onEdit={() => navigate("service-geography", "coverage")} />
      </div>
      <div className={styles.taskActions}><button className={styles.secondaryButton} type="button" onClick={() => navigate("service-geography", draft.serviceMode === "localities" ? "localities" : "coverage")}>Back</button><button className={styles.primaryButton} type="button" onClick={() => navigate("review", "complete")}>Validate &amp; complete</button></div>
    </div>
  );
}

function CompleteGeography({ draft, navigate }: { draft: GeographyDraft; navigate: Navigate }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [context, setContext] = useState<GeographyContext | null>(null);
  const [services, setServices] = useState<Record<string, string>>({});
  async function complete() {
    setSubmitting(true); setErrors([]);
    try {
      const response = await fetch("/api/onboarding/geography", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
      const payload = (await response.json()) as CompletionResponse;
      if (!response.ok || !payload.context) { setErrors(payload.errors ?? ["Geography could not be completed."]); return; }
      setContext(payload.context); setServices(payload.services ?? {});
      window.localStorage.setItem(CONTEXT_KEY, JSON.stringify(payload.context));
      window.localStorage.removeItem(DRAFT_KEY);
    } catch { setErrors(["Geography validation services are unavailable. Your draft remains saved locally."]); }
    finally { setSubmitting(false); }
  }
  if (context) {
    const handoff = profileHandoffHref(context);
    return (
      <div className={styles.stepPanel}>
        <div className={styles.successMark}>✓</div><div className={styles.copyBlock}><h2>Geography complete</h2><p>{context.primaryGeography.name}, {context.primaryGeography.stateCode} is now the normalized Geography Context for downstream onboarding.</p></div>
        <dl className={styles.reviewGrid}><div><dt>Primary geography</dt><dd>{context.primaryGeography.name}</dd></div><div><dt>Matched location</dt><dd>{context.primaryLocation.matchedAddress}</dd></div><div><dt>Visibility</dt><dd>{titleCase(context.publicLocation.visibility)}</dd></div><div><dt>Service coverage</dt><dd>{titleCase(context.serviceArea.mode)}</dd></div></dl>
        <div className={styles.integrationNote}><strong>Validated services</strong><span>{Object.values(services).join(" · ")}</span></div>
        <button className={styles.primaryButton} type="button" onClick={() => router.push(handoff)}>Continue to Organization Profile</button>
      </div>
    );
  }
  return (
    <div className={styles.stepPanel}>
      <div className={styles.copyBlock}><h2>Complete &amp; hand off</h2><p>The server re-resolves the Census geography, re-geocodes the address, reapplies release policy, validates mismatch handling, and canonicalizes service localities before producing Geography Context.</p></div>
      {errors.length ? <div className={styles.errorBox} role="alert"><strong>Geography needs attention</strong><ul>{errors.map((error) => <li key={error}>{error}</li>)}</ul></div> : null}
      <div className={styles.taskActions}><button className={styles.secondaryButton} type="button" onClick={() => navigate("review", "summary")}>Back to review</button><button className={styles.primaryButton} type="button" onClick={() => void complete()} disabled={submitting}>{submitting ? "Validating…" : "Complete geography"}</button></div>
    </div>
  );
}

function ReviewCard({ label, value, onEdit }: { label: string; value: string; onEdit: () => void }) {
  return <div className={styles.reviewCard}><div><small>{label}</small><strong>{value || "Not set"}</strong></div><button className={styles.secondaryButton} type="button" onClick={onEdit}>Edit</button></div>;
}

function Prerequisite({ title, action, onAction }: { title: string; action: string; onAction: () => void }) {
  return <div className={styles.stepPanel}><div className={styles.notice}><strong>{title}</strong><span>This route is deep-linkable, so RFxchange preserves the prerequisite instead of fabricating missing state.</span></div><button className={styles.primaryButton} type="button" onClick={onAction}>{action}</button></div>;
}
