"use client";

import { useEffect, useMemo, useState } from "react";
import type { Coordinates, DrawerQueryState, DrawerState, ExchangeFilters, ExchangeLens, ExchangeRecord, ExchangeSearchState, ExchangeViewerContext, GeolocationStatus, LensAction, MapGeographyOption, MapViewState, RecentSearch, SavedSearch } from "@/lib/exchange/contracts";
import { exchangeSeed } from "@/lib/exchange/seed";
import { deriveReferenceViewerContext } from "@/lib/exchange/action-registry";
import { applyExchangeFilters, createExchangeFilters } from "@/lib/exchange/filter";
import { applyDrawerQuery, createDefaultDrawerQuery } from "@/lib/exchange/drawer";
import { intelligenceSeed, type IntelligenceWorkflow } from "@/lib/exchange/intelligence";
import { isCapabilityWorkflowMode, type CapabilityWorkflowMode } from "@/lib/capabilities/actions";
import { capabilityExchangeRecords, getCapabilityProfileByExchangeRecordId } from "@/lib/capabilities/reference";
import { lensDefinitions, lensOrder } from "@/lib/exchange/lenses";
import { createDefaultMapView } from "@/lib/exchange/map-model";
import { deriveMapGeographies, mapBoundsEqual, scopeMapRecordsToBounds, viewForCurrentLocation, viewForGeography } from "@/lib/exchange/map-service";
import { resourceMetadata, type ResourceDraft, type ResourceRequestDraft } from "@/lib/exchange/resources";
import { activeFilterCount, defaultSearchState, getSearchSuggestions, searchExchangeRecords, searchStateFromParams, searchStateToParams, typeByLens } from "@/lib/exchange/search";
import type { RfxWorkflowEntry } from "@/lib/rfx/contracts";
import { loadRfxWorkspace, saveRfxWorkspace } from "@/lib/rfx/workspace-client";
import { setPursuitState, setWorkspaceValues } from "@/lib/rfx/workspace";
import { CapabilityWorkflowSurface } from "@/components/capabilities/capability-workflow-surface";
import { RfxWorkflowSurface } from "@/components/rfx/rfx-workflow-surface";
import { PersistentMap } from "./persistent-map";
import { SearchControls } from "./search-controls";
import { FloatingControls } from "./floating-controls";
import { ResultsDrawer } from "./results-drawer";
import { BottomNav } from "./bottom-nav";
import { DetailSurface } from "./detail-surface";
import { MenuSurface } from "./menu-surface";
import { IntelligenceWorkflowSurface } from "./intelligence-workflow-surface";
import { ResourceNotice } from "./resource-notice";
import { ResourceWorkflowSurface, type ResourceWorkflow } from "./resource-workflow-surface";
import styles from "./exchange-shell.module.css";

const recentStorageKey = "rfxchange:recent-searches";
const savedStorageKey = "rfxchange:saved-searches";
const rfxDraftStorageKey = "rfxchange:rfx-local-drafts";
const initialRecords = [...exchangeSeed.filter((record) => record.type !== "intelligence" && record.type !== "capability"), ...intelligenceSeed, ...capabilityExchangeRecords];
const initialSavedRecordIds = initialRecords.filter((record) => record.saved).map((record) => record.id);
const initialSearchStates = () => Object.fromEntries(lensOrder.map((lens) => [lens, defaultSearchState()])) as Record<ExchangeLens, ExchangeSearchState>;
const initialFloatingFilters = () => Object.fromEntries(lensOrder.map((lens) => [lens, createExchangeFilters()])) as Record<ExchangeLens, ExchangeFilters>;
const initialDrawerQueries = () => Object.fromEntries(lensOrder.map((lens) => [lens, createDefaultDrawerQuery()])) as Record<ExchangeLens, DrawerQueryState>;
type IntelligenceFlow = { mode: IntelligenceWorkflow; recordId?: string };
type CapabilityFlow = { mode: CapabilityWorkflowMode; recordId: string };
type RfxFlow = { entry: RfxWorkflowEntry; recordId: string };

export function ExchangeShell({ initialLens = "rfx", initialRecordId, viewerContext }: { initialLens?: ExchangeLens; initialRecordId?: string; viewerContext?: Partial<ExchangeViewerContext>; }) {
  const [lens, setLens] = useState<ExchangeLens>(initialLens);
  const [recordsState, setRecordsState] = useState<ExchangeRecord[]>(initialRecords);
  const [searchByLens, setSearchByLens] = useState<Record<ExchangeLens, ExchangeSearchState>>(initialSearchStates);
  const [filtersByLens, setFiltersByLens] = useState<Record<ExchangeLens, ExchangeFilters>>(initialFloatingFilters);
  const [drawerQueries, setDrawerQueries] = useState<Record<ExchangeLens, DrawerQueryState>>(initialDrawerQueries);
  const [drawer, setDrawer] = useState<DrawerState>("mid"); const [mapView, setMapView] = useState<MapViewState>(createDefaultMapView);
  const [selectedRecordId, setSelectedRecordId] = useState<string | undefined>(initialRecordId); const [detailRecordId, setDetailRecordId] = useState<string | undefined>(initialRecordId); const [menuOpen, setMenuOpen] = useState(false);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]); const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]); const [savedRecordIds, setSavedRecordIds] = useState<Set<string>>(() => new Set(initialSavedRecordIds));
  const [actionNotice, setActionNotice] = useState("");
  const [rfxWorkflow, setRfxWorkflow] = useState<RfxFlow>();
  const [resourceWorkflow, setResourceWorkflow] = useState<ResourceWorkflow | undefined>(); const [resourceNotice, setResourceNotice] = useState<string>();
  const [intelligenceWorkflow, setIntelligenceWorkflow] = useState<IntelligenceFlow>(); const [intelligenceNotes, setIntelligenceNotes] = useState<Record<string, string[]>>({});
  const [capabilityWorkflow, setCapabilityWorkflow] = useState<CapabilityFlow>();
  const [geolocationStatus, setGeolocationStatus] = useState<GeolocationStatus>("idle"); const [viewerLocation, setViewerLocation] = useState<Coordinates | undefined>(); const [viewportDirty, setViewportDirty] = useState(false);

  const allRecords = useMemo(() => recordsState.map((record) => ({ ...record, saved: savedRecordIds.has(record.id) })), [recordsState, savedRecordIds]);
  const referenceViewerContext = useMemo(() => deriveReferenceViewerContext(allRecords), [allRecords]);
  const resolvedViewerContext = useMemo<ExchangeViewerContext>(() => ({ ...referenceViewerContext, ...viewerContext }), [referenceViewerContext, viewerContext]);
  const organizationName = resolvedViewerContext.organization?.name ?? "Accel Analysis";
  const definition = lensDefinitions[lens]; const searchState = searchByLens[lens]; const floatingFilters = filtersByLens[lens]; const drawerQuery = drawerQueries[lens];
  const searchResponse = useMemo(() => searchExchangeRecords(allRecords, lens, searchState), [allRecords, lens, searchState]); const searchRecords = useMemo(() => searchResponse.results.map((result) => result.record), [searchResponse]);
  const filteredRecords = useMemo(() => applyExchangeFilters(searchRecords, floatingFilters), [searchRecords, floatingFilters]);
  const viewportRecords = useMemo(() => scopeMapRecordsToBounds(filteredRecords, mapView.queriedBounds), [filteredRecords, mapView.queriedBounds]);
  const records = useMemo(() => applyDrawerQuery(viewportRecords, drawerQuery), [viewportRecords, drawerQuery]);
  const lensRecords = useMemo(() => allRecords.filter((record) => record.type === typeByLens[lens]), [allRecords, lens]); const suggestions = useMemo(() => getSearchSuggestions(allRecords, lens, searchState.query), [allRecords, lens, searchState.query]);
  const mapGeographies = useMemo(() => deriveMapGeographies(lensRecords.filter((record) => record.resource?.status !== "archived")), [lensRecords]);
  const detailRecord = allRecords.find((record) => record.id === detailRecordId); const actions = definition.actions(resolvedViewerContext);
  const rfxWorkflowRecord = rfxWorkflow ? allRecords.find((record) => record.id === rfxWorkflow.recordId) : undefined;
  const resourceWorkflowRecord = resourceWorkflow && "recordId" in resourceWorkflow ? allRecords.find((record) => record.id === resourceWorkflow.recordId) : undefined;
  const intelligenceWorkflowRecord = intelligenceWorkflow?.recordId ? allRecords.find((record) => record.id === intelligenceWorkflow.recordId) : undefined;
  const rawCapabilityWorkflowProfile = capabilityWorkflow ? getCapabilityProfileByExchangeRecordId(capabilityWorkflow.recordId) : undefined;
  const capabilityWorkflowProfile = rawCapabilityWorkflowProfile?.ownedByViewer ? { ...rawCapabilityWorkflowProfile, organizationName } : rawCapabilityWorkflowProfile;

  useEffect(() => {
    try {
      const recent = localStorage.getItem(recentStorageKey); const saved = localStorage.getItem(savedStorageKey); const localDrafts = localStorage.getItem(rfxDraftStorageKey);
      if (recent) setRecentSearches(JSON.parse(recent));
      if (saved) setSavedSearches(JSON.parse(saved));
      if (localDrafts) {
        const drafts = JSON.parse(localDrafts) as ExchangeRecord[];
        setRecordsState((current) => [...drafts, ...current.filter((record) => !drafts.some((draft) => draft.id === record.id))]);
      }
    } catch {}
  }, []);
  useEffect(() => {
    let active = true;
    const candidates = initialRecords.filter((record) => record.type === "rfx");
    void Promise.all(candidates.map(async (record) => {
      const entry: RfxWorkflowEntry = record.ownedByViewer ? "manage-rfx" : "view";
      const loaded = await loadRfxWorkspace(record.id, entry);
      return loaded.workspace.values["watch.active"] ? record.id : undefined;
    })).then((ids) => { if (!active) return; setSavedRecordIds((current) => { const next = new Set(current); ids.filter(Boolean).forEach((id) => next.add(id!)); return next; }); });
    return () => { active = false; };
  }, []);
  useEffect(() => { function syncFromUrl() { const parts = location.pathname.split("/").filter(Boolean); const urlLens = parts[1]; if (urlLens === "rfx" || urlLens === "resources" || urlLens === "intelligence" || urlLens === "capabilities") { const urlState = searchStateFromParams(new URLSearchParams(location.search)); setLens(urlLens); setSearchByLens((current) => ({ ...current, [urlLens]: urlState })); const recordId = parts[2]; setSelectedRecordId(recordId); setDetailRecordId(recordId); } } syncFromUrl(); addEventListener("popstate", syncFromUrl); return () => removeEventListener("popstate", syncFromUrl); }, []);
  useEffect(() => { if (selectedRecordId && !records.some((record) => record.id === selectedRecordId)) setSelectedRecordId(undefined); }, [records, selectedRecordId]);
  useEffect(() => { if (!actionNotice) return; const timeout = setTimeout(() => setActionNotice(""), 2200); return () => clearTimeout(timeout); }, [actionNotice]);
  useEffect(() => { if (!resourceNotice) return; const timeout = setTimeout(() => setResourceNotice(undefined), 3600); return () => clearTimeout(timeout); }, [resourceNotice]);

  function persistRecent(next: RecentSearch[]) { setRecentSearches(next); try { localStorage.setItem(recentStorageKey, JSON.stringify(next)); } catch {} }
  function persistSaved(next: SavedSearch[]) { setSavedSearches(next); try { localStorage.setItem(savedStorageKey, JSON.stringify(next)); } catch {} }
  function persistLocalRfxDraft(record: ExchangeRecord) { try { const raw = localStorage.getItem(rfxDraftStorageKey); const current = raw ? JSON.parse(raw) as ExchangeRecord[] : []; const next = [record, ...current.filter((item) => item.id !== record.id)]; localStorage.setItem(rfxDraftStorageKey, JSON.stringify(next)); } catch {} }
  function setUrl(nextLens: ExchangeLens, recordId?: string, mode: "push" | "replace" = "replace", state = searchByLens[nextLens]) { const path = recordId ? `/exchange/${nextLens}/${recordId}` : `/exchange/${nextLens}`; const params = searchStateToParams(state).toString(); const next = params ? `${path}?${params}` : path; history[mode === "push" ? "pushState" : "replaceState"]({}, "", next); }
  function updateSearchState(next: ExchangeSearchState) { setSearchByLens((current) => ({ ...current, [lens]: next })); setUrl(lens, detailRecordId, "replace", next); }
  function commitSearch(next: ExchangeSearchState) { updateSearchState(next); if (!next.query.trim() && activeFilterCount(next) === 0) return; const recent: RecentSearch = { id: `${lens}-${Date.now()}`, lens, state: next, createdAt: new Date().toISOString() }; persistRecent([recent, ...recentSearches.filter((item) => item.lens !== lens || JSON.stringify(item.state) !== JSON.stringify(next))].slice(0, 12)); }
  function saveCurrentSearch() { if (!searchState.query.trim() && activeFilterCount(searchState) === 0) return; const descriptor = searchState.query.trim() || searchState.filters.geography.trim() || "Discovery"; const saved: SavedSearch = { id: `${lens}-${Date.now()}`, name: `${definition.label}: ${descriptor}`, lens, state: searchState, createdAt: new Date().toISOString() }; persistSaved([saved, ...savedSearches.filter((item) => item.lens !== lens || JSON.stringify(item.state) !== JSON.stringify(searchState))].slice(0, 20)); }
  function changeLens(next: ExchangeLens) { const prior = searchByLens[next]; const carried = prior.query.trim() ? prior : { ...prior, query: searchState.query }; setLens(next); setSearchByLens((current) => ({ ...current, [next]: carried })); setSelectedRecordId(undefined); setDetailRecordId(undefined); setRfxWorkflow(undefined); setResourceWorkflow(undefined); setIntelligenceWorkflow(undefined); setCapabilityWorkflow(undefined); setActionNotice(""); setMapView((current) => ({ ...current, queriedBounds: undefined })); setViewportDirty(false); setUrl(next, undefined, "replace", carried); }
  function selectRecord(id: string) { setSelectedRecordId(id); if (drawer === "peek") setDrawer("mid"); }
  function openDetail(id: string) { setSelectedRecordId(id); setDetailRecordId(id); setUrl(lens, id, "push", searchState); }
  function closeDetail() { setDetailRecordId(undefined); setUrl(lens, undefined, "replace", searchState); }
  function toggleSaved(id: string) { setSavedRecordIds((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; }); }

  function beginCreateRfx() {
    const id = `rfx-local-${typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Date.now()}`;
    const contextualGeography = floatingFilters.geography || mapView.geography.label || "Geography not yet defined";
    const draft: ExchangeRecord = { id, type: "rfx", title: "New RFx draft", organization: organizationName, summary: "RFx draft created from the issuer workflow.", geography: contextualGeography, metadata: [], ownedByViewer: true, card: { eyebrow: "RFx", status: { label: "Draft", tone: "neutral" } } };
    setRecordsState((current) => [draft, ...current]); persistLocalRfxDraft(draft); setSelectedRecordId(id); setDetailRecordId(undefined); setRfxWorkflow({ entry: "create-rfx", recordId: id });
  }

  async function toggleRfxWatch(record: ExchangeRecord) {
    const currentlySaved = savedRecordIds.has(record.id);
    const entry: RfxWorkflowEntry = record.ownedByViewer ? "manage-rfx" : "view";
    const loaded = await loadRfxWorkspace(record.id, entry);
    let next = setWorkspaceValues(loaded.workspace, { "watch.active": !currentlySaved });
    if (!record.ownedByViewer) next = setPursuitState(next, currentlySaved ? "discovered" : "watching");
    const saved = await saveRfxWorkspace(next, loaded.persistence);
    setSavedRecordIds((current) => { const updated = new Set(current); if (currentlySaved) updated.delete(record.id); else updated.add(record.id); return updated; });
    setActionNotice(`${currentlySaved ? "Removed from watch" : record.ownedByViewer ? "Tracking" : "Watching"}: ${record.title} · ${saved.persistence === "postgres" ? "Postgres" : "this device"}`);
  }

  function handleCardSave(id: string) { const record = allRecords.find((item) => item.id === id); if (record?.type === "rfx") { void toggleRfxWatch(record); return; } toggleSaved(id); }

  function createResource(draft: ResourceDraft) { const id = `res-local-${Date.now()}`; const resource = { category: draft.category, availability: draft.availability, availabilityLabel: draft.availabilityLabel, capacity: draft.capacity || undefined, serviceArea: draft.serviceArea || undefined, visibility: draft.visibility, terms: draft.terms || undefined, status: "active" as const }; const record: ExchangeRecord = { id, type: "resource", title: draft.title, organization: organizationName, summary: draft.summary, geography: draft.geography, metadata: resourceMetadata(resource), location: draft.visibility === "public-location" ? (resolvedViewerContext.organization?.location ?? { lat: 36.9, lng: -76.71 }) : undefined, ownedByViewer: true, card: { eyebrow: "Resource Offer", classifications: [draft.category], status: { label: draft.availabilityLabel, tone: "success" }, distance: "Local" }, resource }; setRecordsState((current) => [record, ...current]); setSelectedRecordId(id); setResourceWorkflow(undefined); setResourceNotice("Resource offer published to the reference Exchange. Production persistence remains behind the Resources service boundary."); }
  function updateResource(recordId: string, draft: ResourceDraft) { setRecordsState((current) => current.map((record) => { if (record.id !== recordId || !record.resource) return record; const resource = { ...record.resource, category: draft.category, availability: draft.availability, availabilityLabel: draft.availabilityLabel, capacity: draft.capacity || undefined, serviceArea: draft.serviceArea || undefined, visibility: draft.visibility, terms: draft.terms || undefined }; return { ...record, organization: organizationName, title: draft.title, summary: draft.summary, geography: draft.geography, metadata: resourceMetadata(resource), location: draft.visibility === "public-location" ? (record.location ?? resolvedViewerContext.organization?.location ?? { lat: 36.9, lng: -76.71 }) : undefined, card: { ...record.card, classifications: [draft.category], status: { label: draft.availabilityLabel, tone: "success" }, relationships: record.card?.relationships?.filter((item) => item !== "owned") }, resource }; })); setResourceWorkflow(undefined); setResourceNotice("Resource changes saved in the reference Exchange."); }
  function requestResource(recordId: string, request: ResourceRequestDraft) { const record = allRecords.find((item) => item.id === recordId); setResourceWorkflow(undefined); setResourceNotice(`Request created for ${record?.title ?? "resource"}${request.neededBy ? ` · needed ${request.neededBy}` : ""}. Provider notification and fulfillment remain shared-service integrations.`); }
  function archiveResource(recordId: string) { setRecordsState((current) => current.map((record) => record.id === recordId && record.resource ? { ...record, resource: { ...record.resource, status: "archived" as const } } : record)); setSelectedRecordId(undefined); setDetailRecordId(undefined); setResourceWorkflow(undefined); setResourceNotice("Resource archived and removed from active discovery."); setUrl("resources"); }
  function createInsight(record: ExchangeRecord) { const next = record.ownedByViewer ? { ...record, organization: organizationName, metadata: record.metadata.filter((item) => item.toLowerCase() !== "owned by you") } : record; setRecordsState((current) => [next, ...current]); setSelectedRecordId(next.id); setActionNotice("Insight added to the reference Intelligence lens."); }
  function updateInsight(record: ExchangeRecord) { const next = record.ownedByViewer ? { ...record, organization: organizationName, metadata: record.metadata.filter((item) => item.toLowerCase() !== "owned by you") } : record; setRecordsState((current) => current.map((item) => item.id === next.id ? next : item)); setActionNotice("Insight updated in the reference session."); }
  function addIntelligenceNote(recordId: string, note: string) { setIntelligenceNotes((current) => ({ ...current, [recordId]: [...(current[recordId] ?? []), note] })); setActionNotice("Note added to this Intelligence record."); }

  function setLensScope(patch: Partial<DrawerQueryState>) { setDrawerQueries((current) => ({ ...current, [lens]: { ...createDefaultDrawerQuery(), sort: current[lens].sort, ...patch } })); }
  function applyLensControl(action: LensAction) { if (action.id === "show-mine") { setLensScope({ ownership: "mine" }); return true; } if (action.id === "show-saved") { setLensScope({ savedOnly: true }); return true; } if (action.id === "show-mapped") { setLensScope({ location: "mapped" }); return true; } if (action.id === "show-off-map") { setLensScope({ location: "off-map" }); return true; } if (action.id === "show-all") { setLensScope({}); return true; } return false; }
  function activeLensControlIds(resolved: LensAction[]) { const ids = new Set<string>(); if (drawerQuery.ownership === "mine") ids.add("show-mine"); if (drawerQuery.savedOnly) ids.add("show-saved"); if (drawerQuery.location === "mapped") ids.add("show-mapped"); if (drawerQuery.location === "off-map") ids.add("show-off-map"); if (drawerQuery.ownership === "all" && drawerQuery.location === "all" && !drawerQuery.savedOnly && !drawerQuery.featuredOnly) ids.add("show-all"); return resolved.filter((action) => ids.has(action.id)).map((action) => action.id); }

  async function handleAction(action: LensAction, record?: ExchangeRecord) {
    if (action.scope === "lens") { if (applyLensControl(action)) return; if (action.id === "create-rfx") { beginCreateRfx(); return; } if (action.id === "offer-resource") { setResourceWorkflow({ mode: "offer" }); return; } if (action.id === "add-insight") { setIntelligenceWorkflow({ mode: "add" }); return; } if (action.id === "manage-capability-profile") { const ownCapability = allRecords.find((item) => item.type === "capability" && item.ownedByViewer); if (ownCapability) setCapabilityWorkflow({ mode: "manage-capabilities", recordId: ownCapability.id }); else setActionNotice("No organization capability profile is available to manage yet."); return; } }
    if (action.requiresRecord && !record) return;
    if (lens === "rfx" && record) { if (action.id === "manage-rfx") { setDetailRecordId(undefined); setRfxWorkflow({ entry: "manage-rfx", recordId: record.id }); return; } if (action.id === "invite-team") { setDetailRecordId(undefined); setRfxWorkflow({ entry: "invite-team", recordId: record.id }); return; } if (action.id === "respond") { setDetailRecordId(undefined); setRfxWorkflow({ entry: "respond", recordId: record.id }); return; } if (action.id === "team") { setDetailRecordId(undefined); setRfxWorkflow({ entry: "team", recordId: record.id }); return; } }
    if (lens === "resources") { if (action.id === "edit-resource" && record) { setResourceWorkflow({ mode: "edit", recordId: record.id }); return; } if (action.id === "request-resource" && record) { setResourceWorkflow({ mode: "request", recordId: record.id }); return; } if (action.id === "archive-resource" && record) { setResourceWorkflow({ mode: "archive", recordId: record.id }); return; } }
    if (lens === "intelligence") { if (action.id === "edit-insight" && record) { setIntelligenceWorkflow({ mode: "edit", recordId: record.id }); return; } if (action.id === "add-note" && record) { setIntelligenceWorkflow({ mode: "note", recordId: record.id }); return; } if (action.id === "compare" && record) { setIntelligenceWorkflow({ mode: "compare", recordId: record.id }); return; } }
    if (lens === "capabilities" && record && isCapabilityWorkflowMode(action.id)) { setCapabilityWorkflow({ mode: action.id, recordId: record.id }); return; }
    if (action.id === "share" && record) { const url = `${location.origin}/exchange/${lens}/${record.id}`; try { if (navigator.share) await navigator.share({ title: record.title, text: record.summary, url }); else { await navigator.clipboard.writeText(url); setActionNotice("Record link copied."); } } catch (error) { if (error instanceof DOMException && error.name === "AbortError") return; setActionNotice("Unable to share this record right now."); } }
  }

  function resetMapView() { setMapView((current) => ({ ...createDefaultMapView(), layers: current.layers })); setFiltersByLens((current) => ({ ...current, [lens]: { ...current[lens], geography: undefined } })); setViewportDirty(false); }
  function handleMapViewChange(next: MapViewState) { setMapView(next); if (next.queriedBounds && next.currentBounds && !mapBoundsEqual(next.queriedBounds, next.currentBounds)) setViewportDirty(true); }
  function changeMapViewFromControls(next: MapViewState) { const moved = Math.abs(next.camera.zoom - mapView.camera.zoom) > 0.01 || Math.abs(next.camera.center.lat - mapView.camera.center.lat) > 0.00001 || Math.abs(next.camera.center.lng - mapView.camera.center.lng) > 0.00001; setMapView(next); if (moved) setViewportDirty(true); }
  function selectGeography(geography?: MapGeographyOption) { if (!geography) { resetMapView(); return; } setFiltersByLens((current) => ({ ...current, [lens]: { ...current[lens], geography: geography.label } })); setMapView((current) => viewForGeography(current, geography)); setViewportDirty(false); }
  function searchCurrentArea() { if (!mapView.currentBounds) return; setMapView((current) => ({ ...current, queriedBounds: current.currentBounds })); setViewportDirty(false); }
  function locateViewer() { if (!("geolocation" in navigator)) { setGeolocationStatus("unavailable"); return; } setGeolocationStatus("requesting"); navigator.geolocation.getCurrentPosition((position) => { const coordinate = { lat: position.coords.latitude, lng: position.coords.longitude }; setViewerLocation(coordinate); setGeolocationStatus("located"); setFiltersByLens((current) => ({ ...current, [lens]: { ...current[lens], geography: undefined } })); setMapView((current) => viewForCurrentLocation(current, coordinate)); setViewportDirty(true); }, (error) => setGeolocationStatus(error.code === 1 ? "denied" : "unavailable"), { timeout: 8000, maximumAge: 60000 }); }

  const visibleRecords = records.filter((record) => record.resource?.status !== "archived"); const lensRecent = recentSearches.filter((item) => item.lens === lens); const lensSaved = savedSearches.filter((item) => item.lens === lens); const mapped = visibleRecords.filter((record) => record.location).length; const offMap = visibleRecords.length - mapped;
  const drawerActiveActionIds = activeLensControlIds(actions); const detailActions = detailRecord ? definition.recordActions(detailRecord, resolvedViewerContext) : [];

  return <main className="exchange-shell">
    <PersistentMap lens={lens} records={visibleRecords} organizationAnchor={resolvedViewerContext.organization} selectedRecordId={selectedRecordId} drawerState={drawer} view={mapView} viewerLocation={viewerLocation} onViewChange={handleMapViewChange} onViewportInteraction={() => setViewportDirty(true)} onSelect={selectRecord} />
    <SearchControls state={searchState} placeholder={definition.searchPlaceholder} lensLabel={definition.label} suggestions={suggestions} recentSearches={lensRecent} savedSearches={lensSaved} onStateChange={updateSearchState} onCommit={commitSearch} onRunState={(next) => { updateSearchState(next); commitSearch(next); }} onSave={saveCurrentSearch} />
    <FloatingControls lens={lens} records={lensRecords.filter((record) => record.resource?.status !== "archived")} search={searchState.query} filters={floatingFilters} onFiltersChange={(next) => setFiltersByLens((current) => ({ ...current, [lens]: next }))} mapView={mapView} mapGeographies={mapGeographies} onMapViewChange={changeMapViewFromControls} onSelectGeography={selectGeography} geolocationStatus={geolocationStatus} onLocate={locateViewer} onResetView={resetMapView} searchAreaAvailable={viewportDirty} onSearchArea={searchCurrentArea} />
    <ResultsDrawer state={drawer} onStateChange={setDrawer} lens={lens} lensLabel={definition.label} records={visibleRecords} totalAvailableCount={viewportRecords.length} selectedRecordId={selectedRecordId} actions={actions} activeActionIds={drawerActiveActionIds} getRecordActions={(record) => definition.recordActions(record, resolvedViewerContext)} onAction={(action, record) => { void handleAction(action, record); }} emptyMessage={definition.emptyMessage} resultContext={`${mapped} mapped · ${offMap} off-map${mapView.queriedBounds ? " · map area applied" : ""}`} query={drawerQuery} onQueryChange={(next) => setDrawerQueries((current) => ({ ...current, [lens]: next }))} onSelect={selectRecord} onOpen={openDetail} onToggleSave={handleCardSave} />
    <BottomNav activeLens={lens} onLensChange={changeLens} onMenu={() => setMenuOpen(true)} />
    {detailRecord ? <DetailSurface record={detailRecord} actions={detailActions} notes={intelligenceNotes[detailRecord.id] ?? []} onAction={(action) => { void handleAction(action, detailRecord); }} onClose={closeDetail} /> : null}
    {menuOpen ? <MenuSurface onClose={() => setMenuOpen(false)} /> : null}
    {rfxWorkflow && rfxWorkflowRecord ? <RfxWorkflowSurface record={rfxWorkflowRecord} entry={rfxWorkflow.entry} onClose={() => setRfxWorkflow(undefined)} onOpenDetail={() => { setRfxWorkflow(undefined); openDetail(rfxWorkflowRecord.id); }} onToggleWatch={() => { void toggleRfxWatch(rfxWorkflowRecord); }} onLensHandoff={(next) => { setRfxWorkflow(undefined); changeLens(next); }} onOpenMenu={() => { setRfxWorkflow(undefined); setMenuOpen(true); }} /> : null}
    {resourceWorkflow ? <ResourceWorkflowSurface workflow={resourceWorkflow} record={resourceWorkflowRecord} onClose={() => setResourceWorkflow(undefined)} onCreate={createResource} onUpdate={updateResource} onRequest={requestResource} onArchive={archiveResource} /> : null}
    {intelligenceWorkflow ? <IntelligenceWorkflowSurface workflow={intelligenceWorkflow.mode} record={intelligenceWorkflowRecord} records={allRecords} onClose={() => setIntelligenceWorkflow(undefined)} onCreate={createInsight} onUpdate={updateInsight} onAddNote={addIntelligenceNote} /> : null}
    {capabilityWorkflow && capabilityWorkflowProfile ? <CapabilityWorkflowSurface profile={capabilityWorkflowProfile} mode={capabilityWorkflow.mode} onClose={() => setCapabilityWorkflow(undefined)} /> : null}
    <ResourceNotice message={resourceNotice} />{actionNotice ? <div className={styles.actionNotice} role="status" aria-live="polite">{actionNotice}</div> : null}
  </main>;
}
