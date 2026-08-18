"use client";

import { useEffect, useMemo, useState } from "react";
import type { Coordinates, DrawerQueryState, DrawerState, ExchangeFilters, ExchangeLens, ExchangeRecord, ExchangeSearchState, GeolocationStatus, LensAction, MapDisplayMode, MapViewState, RecentSearch, SavedSearch } from "@/lib/exchange/contracts";
import { exchangeSeed } from "@/lib/exchange/seed";
import { applyExchangeFilters, createExchangeFilters } from "@/lib/exchange/filter";
import { applyDrawerQuery, createDefaultDrawerQuery } from "@/lib/exchange/drawer";
import { intelligenceSeed, type IntelligenceWorkflow } from "@/lib/exchange/intelligence";
import { isCapabilityWorkflowMode, type CapabilityWorkflowMode } from "@/lib/capabilities/actions";
import { capabilityExchangeRecords, getCapabilityProfileByExchangeRecordId } from "@/lib/capabilities/reference";
import { getLensActionWorkflow, type LensActionWorkflow, type LensWorkflowNode, type LensWorkflowTarget } from "@/lib/exchange/action-workflows";
import type { SharedWorkflowLaunch, SharedWorkflowId } from "@/lib/exchange/shared-workflows";
import { lensDefinitions, lensOrder } from "@/lib/exchange/lenses";
import { createDefaultMapView } from "@/lib/exchange/map-model";
import { resourceMetadata, type ResourceDraft, type ResourceRequestDraft } from "@/lib/exchange/resources";
import { activeFilterCount, defaultSearchState, getSearchSuggestions, searchExchangeRecords, searchStateFromParams, searchStateToParams, typeByLens } from "@/lib/exchange/search";
import { CapabilityWorkflowSurface } from "@/components/capabilities/capability-workflow-surface";
import { PersistentMap } from "./persistent-map";
import { SearchControls } from "./search-controls";
import { FloatingControls } from "./floating-controls";
import { ResultsDrawer } from "./results-drawer";
import { BottomNav } from "./bottom-nav";
import { DetailSurface } from "./detail-surface";
import { MenuSurface } from "./menu-surface";
import { IntelligenceWorkflowSurface } from "./intelligence-workflow-surface";
import { LensActionWorkflowSurface } from "./lens-action-workflow-surface";
import { RfxWorkflowSurface, type RfxWorkflowCommand, type RfxWorkflowLaunch } from "./rfx-workflow-surface";
import { SharedWorkflowSurface, type SharedWorkflowCompletion } from "./shared-workflow-surface";
import { ResourceNotice } from "./resource-notice";
import { ResourceWorkflowSurface, type ResourcePersistenceResult, type ResourceWorkflow } from "./resource-workflow-surface";
import styles from "./exchange-shell.module.css";

const recentStorageKey = "rfxchange:recent-searches";
const savedStorageKey = "rfxchange:saved-searches";
const initialRecords = [...exchangeSeed.filter((record) => record.type !== "intelligence" && record.type !== "capability"), ...intelligenceSeed, ...capabilityExchangeRecords];
const initialSavedRecordIds = initialRecords.filter((record) => record.saved).map((record) => record.id);
const initialSearchStates = () => Object.fromEntries(lensOrder.map((item) => [item, defaultSearchState()])) as Record<ExchangeLens, ExchangeSearchState>;
const initialFloatingFilters = () => Object.fromEntries(lensOrder.map((item) => [item, createExchangeFilters()])) as Record<ExchangeLens, ExchangeFilters>;
const initialDrawerQueries = () => Object.fromEntries(lensOrder.map((item) => [item, createDefaultDrawerQuery()])) as Record<ExchangeLens, DrawerQueryState>;
type IntelligenceFlow = { mode: IntelligenceWorkflow; recordId?: string };
type CapabilityFlow = { mode: CapabilityWorkflowMode; recordId: string };
type HierarchyFlow = { workflow: LensActionWorkflow; record?: ExchangeRecord };

export function ExchangeShell({ initialLens = "rfx", initialRecordId }: { initialLens?: ExchangeLens; initialRecordId?: string }) {
  const [lens, setLens] = useState<ExchangeLens>(initialLens);
  const [recordsState, setRecordsState] = useState<ExchangeRecord[]>(initialRecords);
  const [searchByLens, setSearchByLens] = useState<Record<ExchangeLens, ExchangeSearchState>>(initialSearchStates);
  const [filtersByLens, setFiltersByLens] = useState<Record<ExchangeLens, ExchangeFilters>>(initialFloatingFilters);
  const [drawerQueries, setDrawerQueries] = useState<Record<ExchangeLens, DrawerQueryState>>(initialDrawerQueries);
  const [drawer, setDrawer] = useState<DrawerState>("mid"); const [mapView, setMapView] = useState<MapViewState>(createDefaultMapView);
  const [selectedRecordId, setSelectedRecordId] = useState<string | undefined>(initialRecordId); const [detailRecordId, setDetailRecordId] = useState<string | undefined>(initialRecordId); const [menuOpen, setMenuOpen] = useState(false); const [menuSection, setMenuSection] = useState<"referrals" | "saved" | undefined>();
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]); const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]); const [savedRecordIds, setSavedRecordIds] = useState<Set<string>>(() => new Set(initialSavedRecordIds));
  const [actionState, setActionState] = useState<Record<string, boolean>>({}); const [actionNotice, setActionNotice] = useState("");
  const [hierarchyFlow, setHierarchyFlow] = useState<HierarchyFlow>(); const [sharedWorkflow, setSharedWorkflow] = useState<SharedWorkflowLaunch>(); const [rfxWorkflow, setRfxWorkflow] = useState<RfxWorkflowLaunch>();
  const [resourceWorkflow, setResourceWorkflow] = useState<ResourceWorkflow | undefined>(); const [resourceNotice, setResourceNotice] = useState<string>();
  const [intelligenceWorkflow, setIntelligenceWorkflow] = useState<IntelligenceFlow>(); const [intelligenceNotes, setIntelligenceNotes] = useState<Record<string, string[]>>({});
  const [capabilityWorkflow, setCapabilityWorkflow] = useState<CapabilityFlow>();
  const [geolocationStatus, setGeolocationStatus] = useState<GeolocationStatus>("idle"); const [viewerLocation, setViewerLocation] = useState<Coordinates | undefined>(); const [viewportDirty, setViewportDirty] = useState(false);

  const allRecords = useMemo(() => recordsState.map((record) => ({ ...record, saved: savedRecordIds.has(record.id) })), [recordsState, savedRecordIds]);
  const definition = lensDefinitions[lens]; const searchState = searchByLens[lens]; const floatingFilters = filtersByLens[lens]; const drawerQuery = drawerQueries[lens];
  const searchResponse = useMemo(() => searchExchangeRecords(allRecords, lens, searchState), [allRecords, lens, searchState]); const searchRecords = useMemo(() => searchResponse.results.map((result) => result.record), [searchResponse]);
  const filteredRecords = useMemo(() => applyExchangeFilters(searchRecords, floatingFilters), [searchRecords, floatingFilters]); const records = useMemo(() => applyDrawerQuery(filteredRecords, drawerQuery), [filteredRecords, drawerQuery]);
  const lensRecords = useMemo(() => allRecords.filter((record) => record.type === typeByLens[lens]), [allRecords, lens]); const suggestions = useMemo(() => getSearchSuggestions(allRecords, lens, searchState.query), [allRecords, lens, searchState.query]);
  const selectedRecord = allRecords.find((record) => record.id === selectedRecordId); const detailRecord = allRecords.find((record) => record.id === detailRecordId); const actionRecord = selectedRecord && records.some((record) => record.id === selectedRecord.id) ? selectedRecord : records[0]; const actions = definition.actions(actionRecord);
  const resourceWorkflowRecord = resourceWorkflow && "recordId" in resourceWorkflow ? allRecords.find((record) => record.id === resourceWorkflow.recordId) : undefined;
  const intelligenceWorkflowRecord = intelligenceWorkflow?.recordId ? allRecords.find((record) => record.id === intelligenceWorkflow.recordId) : undefined;
  const capabilityWorkflowProfile = capabilityWorkflow ? getCapabilityProfileByExchangeRecordId(capabilityWorkflow.recordId) : undefined;

  useEffect(() => { try { const recent = localStorage.getItem(recentStorageKey); const saved = localStorage.getItem(savedStorageKey); if (recent) setRecentSearches(JSON.parse(recent)); if (saved) setSavedSearches(JSON.parse(saved)); } catch {} }, []);
  useEffect(() => { function syncFromUrl() { const parts = location.pathname.split("/").filter(Boolean); const urlLens = parts[1]; if (urlLens === "rfx" || urlLens === "resources" || urlLens === "intelligence" || urlLens === "capabilities") { const urlState = searchStateFromParams(new URLSearchParams(location.search)); setLens(urlLens); setSearchByLens((current) => ({ ...current, [urlLens]: urlState })); const recordId = parts[2]; setSelectedRecordId(recordId); setDetailRecordId(recordId); } } syncFromUrl(); addEventListener("popstate", syncFromUrl); return () => removeEventListener("popstate", syncFromUrl); }, []);
  useEffect(() => { if (selectedRecordId && !records.some((record) => record.id === selectedRecordId)) setSelectedRecordId(undefined); }, [records, selectedRecordId]);
  useEffect(() => { if (!actionNotice) return; const timeout = setTimeout(() => setActionNotice(""), 2600); return () => clearTimeout(timeout); }, [actionNotice]);
  useEffect(() => { if (!resourceNotice) return; const timeout = setTimeout(() => setResourceNotice(undefined), 3600); return () => clearTimeout(timeout); }, [resourceNotice]);

  function persistRecent(next: RecentSearch[]) { setRecentSearches(next); try { localStorage.setItem(recentStorageKey, JSON.stringify(next)); } catch {} }
  function persistSaved(next: SavedSearch[]) { setSavedSearches(next); try { localStorage.setItem(savedStorageKey, JSON.stringify(next)); } catch {} }
  function setUrl(nextLens: ExchangeLens, recordId?: string, mode: "push" | "replace" = "replace", state = searchByLens[nextLens]) { const path = recordId ? `/exchange/${nextLens}/${recordId}` : `/exchange/${nextLens}`; const params = searchStateToParams(state).toString(); const next = params ? `${path}?${params}` : path; history[mode === "push" ? "pushState" : "replaceState"]({}, "", next); }
  function updateSearchState(next: ExchangeSearchState) { setSearchByLens((current) => ({ ...current, [lens]: next })); setUrl(lens, detailRecordId, "replace", next); }
  function commitSearch(next: ExchangeSearchState) { updateSearchState(next); if (!next.query.trim() && activeFilterCount(next) === 0) return; const recent: RecentSearch = { id: `${lens}-${Date.now()}`, lens, state: next, createdAt: new Date().toISOString() }; persistRecent([recent, ...recentSearches.filter((item) => item.lens !== lens || JSON.stringify(item.state) !== JSON.stringify(next))].slice(0, 12)); }
  function saveCurrentSearch() { if (!searchState.query.trim() && activeFilterCount(searchState) === 0) return; const descriptor = searchState.query.trim() || searchState.filters.geography.trim() || "Discovery"; const saved: SavedSearch = { id: `${lens}-${Date.now()}`, name: `${definition.label}: ${descriptor}`, lens, state: searchState, createdAt: new Date().toISOString() }; persistSaved([saved, ...savedSearches.filter((item) => item.lens !== lens || JSON.stringify(item.state) !== JSON.stringify(searchState))].slice(0, 20)); }
  function changeLens(next: ExchangeLens) { const prior = searchByLens[next]; const carried = prior.query.trim() ? prior : { ...prior, query: searchState.query }; setLens(next); setSearchByLens((current) => ({ ...current, [next]: carried })); setSelectedRecordId(undefined); setDetailRecordId(undefined); setHierarchyFlow(undefined); setSharedWorkflow(undefined); setRfxWorkflow(undefined); setResourceWorkflow(undefined); setIntelligenceWorkflow(undefined); setCapabilityWorkflow(undefined); setActionNotice(""); setUrl(next, undefined, "replace", carried); }
  function selectRecord(id: string) { setSelectedRecordId(id); if (drawer === "peek") setDrawer("mid"); }
  function openDetail(id: string) { setSelectedRecordId(id); setDetailRecordId(id); setUrl(lens, id, "push", searchState); }
  function closeDetail() { setDetailRecordId(undefined); setUrl(lens, undefined, "replace", searchState); }
  function toggleSaved(id: string, active?: boolean) { setSavedRecordIds((current) => { const next = new Set(current); const shouldSave = active ?? !next.has(id); if (shouldSave) next.add(id); else next.delete(id); return next; }); }
  function actionKey(record: ExchangeRecord, actionId: string) { return `${record.id}:${actionId}`; }
  function actionIsActive(record: ExchangeRecord | undefined, action: LensAction) { if (!record || !action.toggle) return false; if (action.toggle === "save" || action.toggle === "follow") return savedRecordIds.has(record.id); return actionState[actionKey(record, action.id)] ?? false; }
  function activeActionIds(record: ExchangeRecord | undefined, resolved: LensAction[]) { return resolved.filter((action) => actionIsActive(record, action)).map((action) => action.id); }

  function createResource(draft: ResourceDraft, persisted: ResourcePersistenceResult) { const id = persisted.publicId; if (!id) { setResourceNotice("Resource service did not return a canonical record ID."); return; } const resource = { category: draft.category, availability: draft.availability, availabilityLabel: draft.availabilityLabel, capacity: draft.capacity || undefined, serviceArea: draft.serviceArea || undefined, visibility: draft.visibility, terms: draft.terms || undefined, status: "active" as const }; const record: ExchangeRecord = { id, type: "resource", title: draft.title, organization: persisted.organization ?? "Active organization", summary: draft.summary, geography: draft.geography, metadata: ["Owned by you", ...resourceMetadata(resource)], ownedByViewer: true, card: { eyebrow: "Resource Offer", classifications: [draft.category], status: { label: draft.availabilityLabel, tone: "success" }, relationships: ["owned"] }, resource }; setRecordsState((current) => [record, ...current.filter((item) => item.id !== id)]); setSelectedRecordId(id); setResourceWorkflow(undefined); setResourceNotice("Resource offer persisted and added to active Exchange discovery."); }
  function updateResource(recordId: string, draft: ResourceDraft, _persisted: ResourcePersistenceResult) { setRecordsState((current) => current.map((record) => { if (record.id !== recordId || !record.resource) return record; const resource = { ...record.resource, category: draft.category, availability: draft.availability, availabilityLabel: draft.availabilityLabel, capacity: draft.capacity || undefined, serviceArea: draft.serviceArea || undefined, visibility: draft.visibility, terms: draft.terms || undefined }; return { ...record, title: draft.title, summary: draft.summary, geography: draft.geography, metadata: ["Owned by you", ...resourceMetadata(resource)], resource }; })); setResourceWorkflow(undefined); setResourceNotice("Resource changes persisted to the canonical Resources repository."); }
  function requestResource(recordId: string, request: ResourceRequestDraft, persisted: ResourcePersistenceResult) { const record = allRecords.find((item) => item.id === recordId); setResourceWorkflow(undefined); setResourceNotice(`Resource request ${persisted.requestId ?? ""} created for ${record?.title ?? "resource"}${request.neededBy ? ` · needed ${request.neededBy}` : ""}.`); }
  function archiveResource(recordId: string, _persisted: ResourcePersistenceResult) { setRecordsState((current) => current.map((record) => record.id === recordId && record.resource ? { ...record, resource: { ...record.resource, status: "archived" as const } } : record)); setSelectedRecordId(undefined); setDetailRecordId(undefined); setResourceWorkflow(undefined); setResourceNotice("Resource archived in the canonical Resources repository and removed from active discovery."); setUrl("resources"); }
  function createInsight(record: ExchangeRecord) { setRecordsState((current) => [record, ...current.filter((item) => item.id !== record.id)]); setSelectedRecordId(record.id); setActionNotice("Insight persisted and added to the Intelligence lens."); }
  function updateInsight(record: ExchangeRecord) { setRecordsState((current) => current.map((item) => item.id === record.id ? record : item)); setActionNotice("Insight changes persisted to the Intelligence repository."); }
  function addIntelligenceNote(recordId: string, note: string) { setIntelligenceNotes((current) => ({ ...current, [recordId]: [...(current[recordId] ?? []), note] })); setActionNotice("Intelligence note persisted with organization visibility."); }

  function openRailAction(action: LensAction, record?: ExchangeRecord) { const workflow = getLensActionWorkflow(lens, action.ownership, action.id); if (workflow) { setHierarchyFlow({ workflow, record }); return; } void handleLegacyAction(action, record); }
  async function handleLegacyAction(action: LensAction, record?: ExchangeRecord) { if (action.requiresRecord && !record) return; if (action.trigger === "detail" && record) { openDetail(record.id); return; } if (action.id === "share" && record) { setSharedWorkflow({ workflow: "share", lens, record, source: "action-rail" }); } }

  function dispatchDomainTarget(domain: ExchangeLens, action: string, record?: ExchangeRecord) {
    if (domain === "rfx") { const command = action as RfxWorkflowCommand; const creation = command === "draft" || command === "save" || command === "publish"; setRfxWorkflow({ command, record: creation ? undefined : record }); return; }
    if (domain === "resources") { if (action === "offer") setResourceWorkflow({ mode: "offer" }); else if (action === "edit" && record) setResourceWorkflow({ mode: "edit", recordId: record.id }); else if (action === "request" && record) setResourceWorkflow({ mode: "request", recordId: record.id }); else if (action === "archive" && record) setResourceWorkflow({ mode: "archive", recordId: record.id }); return; }
    if (domain === "intelligence") { const mode = action as IntelligenceWorkflow; if (mode === "add") setIntelligenceWorkflow({ mode }); else if (record) setIntelligenceWorkflow({ mode, recordId: record.id }); return; }
    if (domain === "capabilities" && record && isCapabilityWorkflowMode(action)) setCapabilityWorkflow({ mode: action, recordId: record.id });
  }

  function handleWorkflowTarget(target: LensWorkflowTarget, node: LensWorkflowNode) { const record = hierarchyFlow?.record; setHierarchyFlow(undefined); if (target.type === "detail") { if (record) openDetail(record.id); return; } if (target.type === "domain") { dispatchDomainTarget(target.domain, target.action, record); return; } if (target.type === "shared") { if (record) setSharedWorkflow({ workflow: target.workflow, lens, record, source: "action-rail" }); else setActionNotice("Select a record before starting this shared workflow."); return; } if (target.type === "menu") { setMenuSection(target.section); setMenuOpen(true); return; } if (target.type === "return") { setActionNotice("Returned to Exchange context."); return; } if (target.type === "outcome") setActionNotice(node.label); }

  function completeSharedWorkflow(execution: SharedWorkflowCompletion) { const record = sharedWorkflow?.record; if (record) { const active = typeof execution.result.active === "boolean" ? execution.result.active : undefined; const workflow = sharedWorkflow?.workflow as SharedWorkflowId | undefined; if (workflow === "save" || workflow === "follow") toggleSaved(record.id, active); if ((workflow === "watch" || workflow === "track") && active !== undefined) setActionState((current) => ({ ...current, [actionKey(record, workflow)]: active })); } setActionNotice(`${execution.eventName} saved by RFxchange service.`); }

  function completeRfxWorkflow(message: string, result?: Record<string, unknown>) { const publicId = typeof result?.publicId === "string" ? result.publicId : undefined; const title = typeof result?.title === "string" ? result.title : undefined; const summary = typeof result?.summary === "string" ? result.summary : undefined; if (publicId && title && summary && !recordsState.some((record) => record.id === publicId)) { const created: ExchangeRecord = { id: publicId, type: "rfx", title, organization: typeof result?.organization === "string" ? result.organization : "Active organization", summary, geography: "Off-map", metadata: [String(result?.status ?? "draft"), "Owned by you"], ownedByViewer: true }; setRecordsState((current) => [created, ...current]); setSelectedRecordId(publicId); } else if (publicId && (title || summary)) { setRecordsState((current) => current.map((record) => record.id === publicId ? { ...record, title: title ?? record.title, summary: summary ?? record.summary } : record)); } setActionNotice(message); }

  function resetMapView() { setMapView(createDefaultMapView()); setViewportDirty(false); }
  function locateViewer() { if (!("geolocation" in navigator)) { setGeolocationStatus("unavailable"); return; } setGeolocationStatus("requesting"); navigator.geolocation.getCurrentPosition((position) => { setViewerLocation({ lat: position.coords.latitude, lng: position.coords.longitude }); setGeolocationStatus("located"); }, (error) => setGeolocationStatus(error.code === 1 ? "denied" : "unavailable"), { timeout: 8000, maximumAge: 60000 }); }

  const visibleRecords = records.filter((record) => record.resource?.status !== "archived"); const lensRecent = recentSearches.filter((item) => item.lens === lens); const lensSaved = savedSearches.filter((item) => item.lens === lens); const mapped = visibleRecords.filter((record) => record.location).length; const offMap = visibleRecords.length - mapped;
  const drawerActiveActionIds = activeActionIds(actionRecord, actions); const detailActions = detailRecord ? definition.actions(detailRecord) : []; const detailActiveActionIds = activeActionIds(detailRecord, detailActions);

  return <main className="exchange-shell">
    <PersistentMap lens={lens} records={visibleRecords} selectedRecordId={selectedRecordId} drawerState={drawer} view={mapView} viewerLocation={viewerLocation} onViewChange={(next) => { setMapView(next); setViewportDirty(true); }} onSelect={selectRecord} />
    <SearchControls state={searchState} placeholder={definition.searchPlaceholder} lensLabel={definition.label} suggestions={suggestions} recentSearches={lensRecent} savedSearches={lensSaved} onStateChange={updateSearchState} onCommit={commitSearch} onRunState={(next) => { updateSearchState(next); commitSearch(next); }} onSave={saveCurrentSearch} />
    <FloatingControls lens={lens} records={lensRecords.filter((record) => record.resource?.status !== "archived")} search={searchState.query} filters={floatingFilters} onFiltersChange={(next) => setFiltersByLens((current) => ({ ...current, [lens]: next }))} mapDisplayMode={mapView.camera.mode} onMapDisplayModeChange={(mode: MapDisplayMode) => setMapView((current) => ({ ...current, camera: { ...current.camera, mode, pitch: mode === "3d" ? 42 : 0 } }))} geolocationStatus={geolocationStatus} onLocate={locateViewer} onResetView={resetMapView} searchAreaAvailable={viewportDirty} onSearchArea={() => setViewportDirty(false)} />
    <ResultsDrawer state={drawer} onStateChange={setDrawer} lens={lens} lensLabel={definition.label} records={visibleRecords} totalAvailableCount={filteredRecords.length} selectedRecordId={selectedRecordId} actions={actions} activeActionIds={drawerActiveActionIds} onAction={(action) => openRailAction(action, actionRecord)} emptyMessage={definition.emptyMessage} resultContext={`${mapped} mapped · ${offMap} off-map`} query={drawerQuery} onQueryChange={(next) => setDrawerQueries((current) => ({ ...current, [lens]: next }))} onSelect={selectRecord} onOpen={openDetail} onToggleSave={toggleSaved} />
    <BottomNav activeLens={lens} onLensChange={changeLens} onMenu={() => { setMenuSection(undefined); setMenuOpen(true); }} />
    {detailRecord ? <DetailSurface record={detailRecord} actions={detailActions} activeActionIds={detailActiveActionIds} notes={intelligenceNotes[detailRecord.id] ?? []} onAction={(action) => openRailAction(action, detailRecord)} onClose={closeDetail} /> : null}
    {menuOpen ? <MenuSurface onClose={() => { setMenuOpen(false); setMenuSection(undefined); }} initialSectionId={menuSection} /> : null}
    {hierarchyFlow ? <LensActionWorkflowSurface workflow={hierarchyFlow.workflow} record={hierarchyFlow.record} onClose={() => setHierarchyFlow(undefined)} onTarget={handleWorkflowTarget} /> : null}
    {sharedWorkflow ? <SharedWorkflowSurface launch={sharedWorkflow} onClose={() => setSharedWorkflow(undefined)} onComplete={completeSharedWorkflow} /> : null}
    {rfxWorkflow ? <RfxWorkflowSurface launch={rfxWorkflow} onClose={() => setRfxWorkflow(undefined)} onComplete={completeRfxWorkflow} /> : null}
    {resourceWorkflow ? <ResourceWorkflowSurface workflow={resourceWorkflow} record={resourceWorkflowRecord} onClose={() => setResourceWorkflow(undefined)} onCreate={createResource} onUpdate={updateResource} onRequest={requestResource} onArchive={archiveResource} /> : null}
    {intelligenceWorkflow ? <IntelligenceWorkflowSurface workflow={intelligenceWorkflow.mode} record={intelligenceWorkflowRecord} records={allRecords} onClose={() => setIntelligenceWorkflow(undefined)} onCreate={createInsight} onUpdate={updateInsight} onAddNote={addIntelligenceNote} /> : null}
    {capabilityWorkflow && capabilityWorkflowProfile ? <CapabilityWorkflowSurface profile={capabilityWorkflowProfile} mode={capabilityWorkflow.mode} onClose={() => setCapabilityWorkflow(undefined)} /> : null}
    <ResourceNotice message={resourceNotice} />{actionNotice ? <div className={styles.actionNotice} role="status" aria-live="polite">{actionNotice}</div> : null}
  </main>;
}
