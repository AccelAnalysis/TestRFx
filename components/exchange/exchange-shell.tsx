"use client";

import { useEffect, useMemo, useState } from "react";
import type { Coordinates, DrawerQueryState, DrawerState, ExchangeFilters, ExchangeLens, ExchangeRecord, ExchangeSearchState, GeolocationStatus, LensAction, MapDisplayMode, MapViewState, RecentSearch, SavedSearch } from "@/lib/exchange/contracts";
import { exchangeSeed } from "@/lib/exchange/seed";
import { applyExchangeFilters, createExchangeFilters } from "@/lib/exchange/filter";
import { applyDrawerQuery, createDefaultDrawerQuery } from "@/lib/exchange/drawer";
import { buildParticipantInsight, intelligenceSeed, updateParticipantInsight, type IntelligenceInsightInput, type IntelligenceWorkflow } from "@/lib/exchange/intelligence";
import { lensDefinitions, lensOrder } from "@/lib/exchange/lenses";
import { createDefaultMapView } from "@/lib/exchange/map-model";
import { resourceMetadata, type ResourceDraft, type ResourceRequestDraft } from "@/lib/exchange/resources";
import { activeFilterCount, defaultSearchState, getSearchSuggestions, searchExchangeRecords, searchStateFromParams, searchStateToParams, typeByLens } from "@/lib/exchange/search";
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
const initialRecords = [...exchangeSeed.filter((record) => record.type !== "intelligence"), ...intelligenceSeed];
const initialSavedRecordIds = initialRecords.filter((record) => record.saved).map((record) => record.id);
const initialSearchStates = () => Object.fromEntries(lensOrder.map((lens) => [lens, defaultSearchState()])) as Record<ExchangeLens, ExchangeSearchState>;
const initialFloatingFilters = () => Object.fromEntries(lensOrder.map((lens) => [lens, createExchangeFilters()])) as Record<ExchangeLens, ExchangeFilters>;
const initialDrawerQueries = () => Object.fromEntries(lensOrder.map((lens) => [lens, createDefaultDrawerQuery()])) as Record<ExchangeLens, DrawerQueryState>;
type IntelligenceFlow = { mode: IntelligenceWorkflow; recordId?: string };

export function ExchangeShell({ initialLens = "rfx", initialRecordId }: { initialLens?: ExchangeLens; initialRecordId?: string }) {
  const [lens, setLens] = useState<ExchangeLens>(initialLens);
  const [recordsState, setRecordsState] = useState<ExchangeRecord[]>(initialRecords);
  const [searchByLens, setSearchByLens] = useState<Record<ExchangeLens, ExchangeSearchState>>(initialSearchStates);
  const [filtersByLens, setFiltersByLens] = useState<Record<ExchangeLens, ExchangeFilters>>(initialFloatingFilters);
  const [drawerQueries, setDrawerQueries] = useState<Record<ExchangeLens, DrawerQueryState>>(initialDrawerQueries);
  const [drawer, setDrawer] = useState<DrawerState>("mid");
  const [mapView, setMapView] = useState<MapViewState>(createDefaultMapView);
  const [selectedRecordId, setSelectedRecordId] = useState<string | undefined>(initialRecordId);
  const [detailRecordId, setDetailRecordId] = useState<string | undefined>(initialRecordId);
  const [menuOpen, setMenuOpen] = useState(false);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [savedRecordIds, setSavedRecordIds] = useState<Set<string>>(() => new Set(initialSavedRecordIds));
  const [actionState, setActionState] = useState<Record<string, boolean>>({});
  const [actionNotice, setActionNotice] = useState("");
  const [resourceWorkflow, setResourceWorkflow] = useState<ResourceWorkflow | undefined>();
  const [resourceNotice, setResourceNotice] = useState<string>();
  const [intelligenceWorkflow, setIntelligenceWorkflow] = useState<IntelligenceFlow>();
  const [intelligenceNotes, setIntelligenceNotes] = useState<Record<string, string[]>>({});
  const [geolocationStatus, setGeolocationStatus] = useState<GeolocationStatus>("idle");
  const [viewerLocation, setViewerLocation] = useState<Coordinates | undefined>();
  const [viewportDirty, setViewportDirty] = useState(false);

  const allRecords = useMemo(() => recordsState.map((record) => ({ ...record, saved: savedRecordIds.has(record.id) })), [recordsState, savedRecordIds]);
  const definition = lensDefinitions[lens]; const searchState = searchByLens[lens]; const floatingFilters = filtersByLens[lens]; const drawerQuery = drawerQueries[lens];
  const searchResponse = useMemo(() => searchExchangeRecords(allRecords, lens, searchState), [allRecords, lens, searchState]);
  const searchRecords = useMemo(() => searchResponse.results.map((result) => result.record), [searchResponse]);
  const filteredRecords = useMemo(() => applyExchangeFilters(searchRecords, floatingFilters), [searchRecords, floatingFilters]);
  const records = useMemo(() => applyDrawerQuery(filteredRecords, drawerQuery), [filteredRecords, drawerQuery]);
  const lensRecords = useMemo(() => allRecords.filter((record) => record.type === typeByLens[lens]), [allRecords, lens]);
  const suggestions = useMemo(() => getSearchSuggestions(allRecords, lens, searchState.query), [allRecords, lens, searchState.query]);
  const selectedRecord = allRecords.find((record) => record.id === selectedRecordId); const detailRecord = allRecords.find((record) => record.id === detailRecordId);
  const actionRecord = selectedRecord && records.some((record) => record.id === selectedRecord.id) ? selectedRecord : records[0]; const actions = definition.actions(actionRecord);
  const resourceWorkflowRecord = resourceWorkflow && "recordId" in resourceWorkflow ? allRecords.find((record) => record.id === resourceWorkflow.recordId) : undefined;
  const intelligenceWorkflowRecord = intelligenceWorkflow?.recordId ? allRecords.find((record) => record.id === intelligenceWorkflow.recordId) : undefined;

  useEffect(() => { try { const recent = localStorage.getItem(recentStorageKey); const saved = localStorage.getItem(savedStorageKey); if (recent) setRecentSearches(JSON.parse(recent)); if (saved) setSavedSearches(JSON.parse(saved)); } catch {} }, []);
  useEffect(() => { function syncFromUrl() { const parts = location.pathname.split("/").filter(Boolean); const urlLens = parts[1]; if (urlLens === "rfx" || urlLens === "resources" || urlLens === "intelligence" || urlLens === "capabilities") { const urlState = searchStateFromParams(new URLSearchParams(location.search)); setLens(urlLens); setSearchByLens((current) => ({ ...current, [urlLens]: urlState })); const recordId = parts[2]; setSelectedRecordId(recordId); setDetailRecordId(recordId); } } syncFromUrl(); addEventListener("popstate", syncFromUrl); return () => removeEventListener("popstate", syncFromUrl); }, []);
  useEffect(() => { if (selectedRecordId && !records.some((record) => record.id === selectedRecordId)) setSelectedRecordId(undefined); }, [records, selectedRecordId]);
  useEffect(() => { if (!actionNotice) return; const timeout = setTimeout(() => setActionNotice(""), 2200); return () => clearTimeout(timeout); }, [actionNotice]);
  useEffect(() => { if (!resourceNotice) return; const timeout = setTimeout(() => setResourceNotice(undefined), 3600); return () => clearTimeout(timeout); }, [resourceNotice]);

  function persistRecent(next: RecentSearch[]) { setRecentSearches(next); try { localStorage.setItem(recentStorageKey, JSON.stringify(next)); } catch {} }
  function persistSaved(next: SavedSearch[]) { setSavedSearches(next); try { localStorage.setItem(savedStorageKey, JSON.stringify(next)); } catch {} }
  function setUrl(nextLens: ExchangeLens, recordId?: string, mode: "push" | "replace" = "replace", state = searchByLens[nextLens]) { const path = recordId ? `/exchange/${nextLens}/${recordId}` : `/exchange/${nextLens}`; const params = searchStateToParams(state).toString(); const next = params ? `${path}?${params}` : path; history[mode === "push" ? "pushState" : "replaceState"]({}, "", next); }
  function updateSearchState(next: ExchangeSearchState) { setSearchByLens((current) => ({ ...current, [lens]: next })); setUrl(lens, detailRecordId, "replace", next); }
  function commitSearch(next: ExchangeSearchState) { updateSearchState(next); if (!next.query.trim() && activeFilterCount(next) === 0) return; const recent: RecentSearch = { id: `${lens}-${Date.now()}`, lens, state: next, createdAt: new Date().toISOString() }; persistRecent([recent, ...recentSearches.filter((item) => item.lens !== lens || JSON.stringify(item.state) !== JSON.stringify(next))].slice(0, 12)); }
  function saveCurrentSearch() { if (!searchState.query.trim() && activeFilterCount(searchState) === 0) return; const descriptor = searchState.query.trim() || searchState.filters.geography.trim() || "Discovery"; const saved: SavedSearch = { id: `${lens}-${Date.now()}`, name: `${definition.label}: ${descriptor}`, lens, state: searchState, createdAt: new Date().toISOString() }; persistSaved([saved, ...savedSearches.filter((item) => item.lens !== lens || JSON.stringify(item.state) !== JSON.stringify(searchState))].slice(0, 20)); }
  function changeLens(next: ExchangeLens) { const prior = searchByLens[next]; const carried = prior.query.trim() ? prior : { ...prior, query: searchState.query }; setLens(next); setSearchByLens((current) => ({ ...current, [next]: carried })); setSelectedRecordId(undefined); setDetailRecordId(undefined); setResourceWorkflow(undefined); setIntelligenceWorkflow(undefined); setActionNotice(""); setUrl(next, undefined, "replace", carried); }
  function selectRecord(id: string) { setSelectedRecordId(id); if (drawer === "peek") setDrawer("mid"); }
  function openDetail(id: string) { setSelectedRecordId(id); setDetailRecordId(id); setUrl(lens, id, "push", searchState); }
  function closeDetail() { setDetailRecordId(undefined); setUrl(lens, undefined, "replace", searchState); }
  function toggleSaved(id: string) { setSavedRecordIds((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; }); }
  function actionKey(record: ExchangeRecord, action: LensAction) { return `${record.id}:${action.id}`; }
  function actionIsActive(record: ExchangeRecord | undefined, action: LensAction) { if (!record || !action.toggle) return false; if (action.toggle === "save") return savedRecordIds.has(record.id); const key = actionKey(record, action); return actionState[key] ?? false; }
  function activeActionIds(record: ExchangeRecord | undefined, resolved: LensAction[]) { return resolved.filter((action) => actionIsActive(record, action)).map((action) => action.id); }

  function createResource(draft: ResourceDraft) { const id = `res-local-${Date.now()}`; const resource = { category: draft.category, availability: draft.availability, availabilityLabel: draft.availabilityLabel, capacity: draft.capacity || undefined, serviceArea: draft.serviceArea || undefined, visibility: draft.visibility, terms: draft.terms || undefined, status: "active" as const }; const record: ExchangeRecord = { id, type: "resource", title: draft.title, organization: "Your Organization", summary: draft.summary, geography: draft.geography, metadata: ["Owned by you", ...resourceMetadata(resource)], location: draft.visibility === "public-location" ? { lat: 36.9, lng: -76.71 } : undefined, ownedByViewer: true, card: { eyebrow: "Resource Offer", classifications: [draft.category], status: { label: draft.availabilityLabel, tone: "success" }, relationships: ["owned"], distance: "Local" }, resource }; setRecordsState((current) => [record, ...current]); setSelectedRecordId(id); setResourceWorkflow(undefined); setResourceNotice("Resource offer published to the reference Exchange. Production persistence remains behind the Resources service boundary."); }
  function updateResource(recordId: string, draft: ResourceDraft) { setRecordsState((current) => current.map((record) => { if (record.id !== recordId || !record.resource) return record; const resource = { ...record.resource, category: draft.category, availability: draft.availability, availabilityLabel: draft.availabilityLabel, capacity: draft.capacity || undefined, serviceArea: draft.serviceArea || undefined, visibility: draft.visibility, terms: draft.terms || undefined }; return { ...record, title: draft.title, summary: draft.summary, geography: draft.geography, metadata: ["Owned by you", ...resourceMetadata(resource)], location: draft.visibility === "public-location" ? (record.location ?? { lat: 36.9, lng: -76.71 }) : undefined, card: { ...record.card, classifications: [draft.category], status: { label: draft.availabilityLabel, tone: "success" } }, resource }; })); setResourceWorkflow(undefined); setResourceNotice("Resource changes saved in the reference Exchange."); }
  function requestResource(recordId: string, request: ResourceRequestDraft) { const record = allRecords.find((item) => item.id === recordId); setResourceWorkflow(undefined); setResourceNotice(`Request created for ${record?.title ?? "resource"}${request.neededBy ? ` · needed ${request.neededBy}` : ""}. Provider notification and fulfillment remain shared-service integrations.`); }
  function archiveResource(recordId: string) { setRecordsState((current) => current.map((record) => record.id === recordId && record.resource ? { ...record, resource: { ...record.resource, status: "archived" as const } } : record)); setSelectedRecordId(undefined); setDetailRecordId(undefined); setResourceWorkflow(undefined); setResourceNotice("Resource archived and removed from active discovery."); setUrl("resources"); }
  function createInsight(record: ExchangeRecord) { setRecordsState((current) => [record, ...current]); setSelectedRecordId(record.id); setActionNotice("Insight added to the reference Intelligence lens."); }
  function updateInsight(record: ExchangeRecord) { setRecordsState((current) => current.map((item) => item.id === record.id ? record : item)); setActionNotice("Insight updated in the reference session."); }
  function addIntelligenceNote(recordId: string, note: string) { setIntelligenceNotes((current) => ({ ...current, [recordId]: [...(current[recordId] ?? []), note] })); setActionNotice("Note added to this Intelligence record."); }

  async function handleAction(action: LensAction, record?: ExchangeRecord) {
    if (action.requiresRecord && !record) return;
    if (lens === "resources") {
      if (action.id === "offer-resource") { setResourceWorkflow({ mode: "offer" }); return; }
      if (action.id === "edit-resource" && record) { setResourceWorkflow({ mode: "edit", recordId: record.id }); return; }
      if (action.id === "request-resource" && record) { setResourceWorkflow({ mode: "request", recordId: record.id }); return; }
      if (action.id === "archive-resource" && record) { setResourceWorkflow({ mode: "archive", recordId: record.id }); return; }
    }
    if (lens === "intelligence") {
      if (action.id === "add-insight") { setIntelligenceWorkflow({ mode: "add" }); return; }
      if (action.id === "edit-insight" && record) { setIntelligenceWorkflow({ mode: "edit", recordId: record.id }); return; }
      if (action.id === "add-note" && record) { setIntelligenceWorkflow({ mode: "note", recordId: record.id }); return; }
      if (action.id === "compare" && record) { setIntelligenceWorkflow({ mode: "compare", recordId: record.id }); return; }
    }
    if (action.trigger === "detail" && record) { openDetail(record.id); return; }
    if (action.id === "share" && record) { const url = `${location.origin}/exchange/${lens}/${record.id}`; try { if (navigator.share) await navigator.share({ title: record.title, text: record.summary, url }); else { await navigator.clipboard.writeText(url); setActionNotice("Record link copied."); } } catch (error) { if (error instanceof DOMException && error.name === "AbortError") return; setActionNotice("Unable to share this record right now."); } return; }
    if (action.toggle && record) { if (action.toggle === "save") toggleSaved(record.id); else { const key = actionKey(record, action); const next = !actionIsActive(record, action); setActionState((current) => ({ ...current, [key]: next })); } setActionNotice(`${action.label}: ${record.title}`); }
  }
  function resetMapView() { setMapView(createDefaultMapView()); setViewportDirty(false); }
  function locateViewer() { if (!("geolocation" in navigator)) { setGeolocationStatus("unavailable"); return; } setGeolocationStatus("requesting"); navigator.geolocation.getCurrentPosition((position) => { setViewerLocation({ lat: position.coords.latitude, lng: position.coords.longitude }); setGeolocationStatus("located"); }, (error) => setGeolocationStatus(error.code === 1 ? "denied" : "unavailable"), { timeout: 8000, maximumAge: 60000 }); }

  const visibleRecords = records.filter((record) => record.resource?.status !== "archived"); const lensRecent = recentSearches.filter((item) => item.lens === lens); const lensSaved = savedSearches.filter((item) => item.lens === lens); const mapped = visibleRecords.filter((record) => record.location).length; const offMap = visibleRecords.length - mapped;
  const drawerActiveActionIds = activeActionIds(actionRecord, actions); const detailActions = detailRecord ? definition.actions(detailRecord) : []; const detailActiveActionIds = activeActionIds(detailRecord, detailActions);

  return <main className="exchange-shell">
    <PersistentMap lens={lens} records={visibleRecords} selectedRecordId={selectedRecordId} drawerState={drawer} view={mapView} viewerLocation={viewerLocation} onViewChange={(next) => { setMapView(next); setViewportDirty(true); }} onSelect={selectRecord} />
    <SearchControls state={searchState} placeholder={definition.searchPlaceholder} lensLabel={definition.label} suggestions={suggestions} recentSearches={lensRecent} savedSearches={lensSaved} onStateChange={updateSearchState} onCommit={commitSearch} onRunState={(next) => { updateSearchState(next); commitSearch(next); }} onSave={saveCurrentSearch} />
    <FloatingControls lens={lens} records={lensRecords.filter((record) => record.resource?.status !== "archived")} search={searchState.query} filters={floatingFilters} onFiltersChange={(next) => setFiltersByLens((current) => ({ ...current, [lens]: next }))} mapDisplayMode={mapView.camera.mode} onMapDisplayModeChange={(mode: MapDisplayMode) => setMapView((current) => ({ ...current, camera: { ...current.camera, mode, pitch: mode === "3d" ? 42 : 0 } }))} geolocationStatus={geolocationStatus} onLocate={locateViewer} onResetView={resetMapView} searchAreaAvailable={viewportDirty} onSearchArea={() => setViewportDirty(false)} />
    <ResultsDrawer state={drawer} onStateChange={setDrawer} lens={lens} lensLabel={definition.label} records={visibleRecords} totalAvailableCount={filteredRecords.length} selectedRecordId={selectedRecordId} actions={actions} activeActionIds={drawerActiveActionIds} onAction={(action) => { void handleAction(action, actionRecord); }} emptyMessage={definition.emptyMessage} resultContext={`${mapped} mapped · ${offMap} off-map`} query={drawerQuery} onQueryChange={(next) => setDrawerQueries((current) => ({ ...current, [lens]: next }))} onSelect={selectRecord} onOpen={openDetail} onToggleSave={toggleSaved} />
    <BottomNav activeLens={lens} onLensChange={changeLens} onMenu={() => setMenuOpen(true)} />
    {detailRecord ? <DetailSurface record={detailRecord} actions={detailActions} activeActionIds={detailActiveActionIds} notes={intelligenceNotes[detailRecord.id] ?? []} onAction={(action) => { void handleAction(action, detailRecord); }} onClose={closeDetail} /> : null}
    {menuOpen ? <MenuSurface onClose={() => setMenuOpen(false)} /> : null}
    {resourceWorkflow ? <ResourceWorkflowSurface workflow={resourceWorkflow} record={resourceWorkflowRecord} onClose={() => setResourceWorkflow(undefined)} onCreate={createResource} onUpdate={updateResource} onRequest={requestResource} onArchive={archiveResource} /> : null}
    {intelligenceWorkflow ? <IntelligenceWorkflowSurface workflow={intelligenceWorkflow.mode} record={intelligenceWorkflowRecord} records={allRecords} onClose={() => setIntelligenceWorkflow(undefined)} onCreate={createInsight} onUpdate={updateInsight} onAddNote={addIntelligenceNote} /> : null}
    <ResourceNotice message={resourceNotice} />
    {actionNotice ? <div className={styles.actionNotice} role="status" aria-live="polite">{actionNotice}</div> : null}
  </main>;
}
