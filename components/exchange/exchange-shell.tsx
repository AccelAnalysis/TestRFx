"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Coordinates, DrawerQueryState, DrawerResultStatus, DrawerState, ExchangeFilters, ExchangeLens, ExchangeRecord, ExchangeSearchState, GeolocationStatus, LensAction, MapDisplayMode, MapViewState, RecentSearch, SavedSearch } from "@/lib/exchange/contracts";
import { exchangeSeed } from "@/lib/exchange/seed";
import { applyExchangeFilters, createExchangeFilters } from "@/lib/exchange/filter";
import { applyDrawerQuery, createDefaultDrawerQuery } from "@/lib/exchange/drawer";
import { intelligenceSeed, type IntelligenceWorkflow } from "@/lib/exchange/intelligence";
import type { CapabilityWorkflowMode } from "@/lib/capabilities/actions";
import { capabilityExchangeRecords, getCapabilityProfileByExchangeRecordId } from "@/lib/capabilities/reference";
import { lensDefinitions, lensOrder } from "@/lib/exchange/lenses";
import { createDefaultMapView } from "@/lib/exchange/map-model";
import type { ResourceDraft, ResourceRequestDraft } from "@/lib/exchange/resources";
import { activeFilterCount, defaultSearchState, getSearchSuggestions, searchExchangeRecords, searchStateFromParams, searchStateToParams, typeByLens } from "@/lib/exchange/search";
import { exchangeResultsUrl, type ExchangeResultsApiResponse } from "@/lib/exchange/results-client";
import { getDrawerWorkflowRoot, type DrawerWorkflowExecution, type DrawerWorkflowNode, type RfxWorkflowCommand } from "@/lib/exchange/drawer-workflows";
import { referenceActorContext, type SharedWorkflowEvent, type SharedWorkflowLaunch, type SharedWorkflowId } from "@/lib/exchange/shared-workflows";
import { CapabilityWorkflowSurface } from "@/components/capabilities/capability-workflow-surface";
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
import { DrawerWorkflowNavigator } from "./drawer-workflow-navigator";
import { SharedWorkflowSurface } from "./shared-workflow-surface";
import { RfxWorkflowSurface } from "./rfx-workflow-surface";
import { ReferralPolicySurface } from "./referral-policy-surface";
import styles from "./exchange-shell.module.css";

const recentStorageKey = "rfxchange:recent-searches";
const savedStorageKey = "rfxchange:saved-searches";
const referenceMode = process.env.NEXT_PUBLIC_RFXCHANGE_REFERENCE_MODE === "1";
const initialRecords = [...exchangeSeed.filter((record) => record.type !== "intelligence" && record.type !== "capability"), ...intelligenceSeed, ...capabilityExchangeRecords];
const initialSavedRecordIds = initialRecords.filter((record) => record.saved).map((record) => record.id);
const initialSearchStates = () => Object.fromEntries(lensOrder.map((lens) => [lens, defaultSearchState()])) as Record<ExchangeLens, ExchangeSearchState>;
const initialFloatingFilters = () => Object.fromEntries(lensOrder.map((lens) => [lens, createExchangeFilters()])) as Record<ExchangeLens, ExchangeFilters>;
const initialDrawerQueries = () => Object.fromEntries(lensOrder.map((lens) => [lens, createDefaultDrawerQuery()])) as Record<ExchangeLens, DrawerQueryState>;
const initialDrawerStates = () => Object.fromEntries(lensOrder.map((lens) => [lens, "mid" as DrawerState])) as Record<ExchangeLens, DrawerState>;
const initialMapViews = () => Object.fromEntries(lensOrder.map((lens) => [lens, createDefaultMapView()])) as Record<ExchangeLens, MapViewState>;
const initialSelections = () => Object.fromEntries(lensOrder.map((lens) => [lens, undefined])) as Record<ExchangeLens, string | undefined>;

type IntelligenceFlow = { mode: IntelligenceWorkflow; recordId?: string };
type CapabilityFlow = { mode: CapabilityWorkflowMode; recordId: string };
type DrawerFlow = { root: DrawerWorkflowNode; recordId?: string };
type RfxFlow = { command: RfxWorkflowCommand; recordId?: string };

export function ExchangeShell({ initialLens = "rfx", initialRecordId }: { initialLens?: ExchangeLens; initialRecordId?: string }) {
  const [lens, setLens] = useState<ExchangeLens>(initialLens);
  const [recordsState, setRecordsState] = useState<ExchangeRecord[]>(referenceMode ? initialRecords : []);
  const [searchByLens, setSearchByLens] = useState<Record<ExchangeLens, ExchangeSearchState>>(initialSearchStates);
  const [filtersByLens, setFiltersByLens] = useState<Record<ExchangeLens, ExchangeFilters>>(initialFloatingFilters);
  const [drawerQueries, setDrawerQueries] = useState<Record<ExchangeLens, DrawerQueryState>>(initialDrawerQueries);
  const [drawerByLens, setDrawerByLens] = useState<Record<ExchangeLens, DrawerState>>(initialDrawerStates);
  const [mapViewByLens, setMapViewByLens] = useState<Record<ExchangeLens, MapViewState>>(initialMapViews);
  const [selectedByLens, setSelectedByLens] = useState<Record<ExchangeLens, string | undefined>>(() => ({ ...initialSelections(), [initialLens]: initialRecordId }));
  const [detailRecordId, setDetailRecordId] = useState<string | undefined>(initialRecordId);
  const [menuOpen, setMenuOpen] = useState(false);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [savedRecordIds, setSavedRecordIds] = useState<Set<string>>(() => new Set(initialSavedRecordIds));
  const [relationshipState, setRelationshipState] = useState<Record<string, Partial<Record<SharedWorkflowId, boolean>>>>({});
  const [actionNotice, setActionNotice] = useState("");
  const [resourceWorkflow, setResourceWorkflow] = useState<ResourceWorkflow | undefined>();
  const [resourceNotice, setResourceNotice] = useState<string>();
  const [intelligenceWorkflow, setIntelligenceWorkflow] = useState<IntelligenceFlow>();
  const [intelligenceNotes, setIntelligenceNotes] = useState<Record<string, string[]>>({});
  const [capabilityWorkflow, setCapabilityWorkflow] = useState<CapabilityFlow>();
  const [drawerWorkflow, setDrawerWorkflow] = useState<DrawerFlow>();
  const [sharedWorkflow, setSharedWorkflow] = useState<SharedWorkflowLaunch>();
  const [rfxWorkflow, setRfxWorkflow] = useState<RfxFlow>();
  const [referralPolicyRecordId, setReferralPolicyRecordId] = useState<string>();
  const [resultStatus, setResultStatus] = useState<DrawerResultStatus>(referenceMode ? "ready" : "loading");
  const [serverSummary, setServerSummary] = useState({ total: 0, mapped: 0, offMap: 0 });
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [geolocationStatus, setGeolocationStatus] = useState<GeolocationStatus>("idle");
  const [viewerLocation, setViewerLocation] = useState<Coordinates | undefined>();
  const [viewportDirty, setViewportDirty] = useState(false);

  const searchState = searchByLens[lens];
  const floatingFilters = filtersByLens[lens];
  const drawerQuery = drawerQueries[lens];
  const drawer = drawerByLens[lens];
  const mapView = mapViewByLens[lens];
  const selectedRecordId = selectedByLens[lens];
  const definition = lensDefinitions[lens];
  const allRecords = useMemo(() => recordsState.map((record) => ({ ...record, saved: savedRecordIds.has(record.id) ? true : record.saved })), [recordsState, savedRecordIds]);
  const referenceSearchResponse = useMemo(() => searchExchangeRecords(allRecords, lens, searchState), [allRecords, lens, searchState]);
  const lensServerRecords = useMemo(() => allRecords.filter((record) => record.type === typeByLens[lens]), [allRecords, lens]);
  const searchRecords = referenceMode ? referenceSearchResponse.results.map((result) => result.record) : lensServerRecords;
  const filteredRecords = useMemo(() => applyExchangeFilters(searchRecords, floatingFilters), [searchRecords, floatingFilters]);
  const records = useMemo(() => applyDrawerQuery(filteredRecords, drawerQuery), [filteredRecords, drawerQuery]);
  const lensRecords = useMemo(() => allRecords.filter((record) => record.type === typeByLens[lens]), [allRecords, lens]);
  const suggestions = useMemo(() => getSearchSuggestions(allRecords, lens, searchState.query), [allRecords, lens, searchState.query]);
  const selectedRecord = allRecords.find((record) => record.id === selectedRecordId);
  const detailRecord = allRecords.find((record) => record.id === detailRecordId);
  const actionRecord = selectedRecord && records.some((record) => record.id === selectedRecord.id) ? selectedRecord : records[0];
  const actions = definition.actions(actionRecord);
  const resourceWorkflowRecord = resourceWorkflow && "recordId" in resourceWorkflow ? allRecords.find((record) => record.id === resourceWorkflow.recordId) : undefined;
  const intelligenceWorkflowRecord = intelligenceWorkflow?.recordId ? allRecords.find((record) => record.id === intelligenceWorkflow.recordId) : undefined;
  const capabilityWorkflowProfile = capabilityWorkflow ? getCapabilityProfileByExchangeRecordId(capabilityWorkflow.recordId) : undefined;
  const rfxWorkflowRecord = rfxWorkflow?.recordId ? allRecords.find((record) => record.id === rfxWorkflow.recordId) : undefined;
  const referralPolicyRecord = referralPolicyRecordId ? allRecords.find((record) => record.id === referralPolicyRecordId) : undefined;

  const loadResults = useCallback(async (cursor?: string, append = false) => {
    if (referenceMode) return;
    if (append) setLoadingMore(true); else setResultStatus("loading");
    try {
      const response = await fetch(exchangeResultsUrl(lens, searchState, cursor), { headers: { accept: "application/json" } });
      const body = await response.json().catch(() => ({})) as Partial<ExchangeResultsApiResponse> & { error?: string };
      if (!response.ok || !body.records || !body.summary) throw new Error(body.error ?? "Exchange results could not be loaded.");
      setRecordsState((current) => {
        const otherLenses = current.filter((record) => record.type !== typeByLens[lens]);
        const priorLens = append ? current.filter((record) => record.type === typeByLens[lens]) : [];
        const merged = [...priorLens, ...body.records!].filter((record, index, items) => items.findIndex((candidate) => candidate.id === record.id) === index);
        return [...otherLenses, ...merged];
      });
      setSavedRecordIds((current) => {
        const next = new Set(current);
        for (const record of body.records!) {
          if (record.saved) next.add(record.id);
          else next.delete(record.id);
        }
        return next;
      });
      setServerSummary(body.summary);
      setNextCursor(body.nextCursor ?? null);
      setResultStatus("ready");
    } catch (error) {
      if (typeof navigator !== "undefined" && !navigator.onLine) setResultStatus("offline"); else setResultStatus("error");
      setActionNotice(error instanceof Error ? error.message : "Exchange results could not be loaded.");
    } finally { setLoadingMore(false); }
  }, [lens, searchState]);

  useEffect(() => { try { const recent = localStorage.getItem(recentStorageKey); const saved = localStorage.getItem(savedStorageKey); if (recent) setRecentSearches(JSON.parse(recent)); if (saved) setSavedSearches(JSON.parse(saved)); } catch {} }, []);
  useEffect(() => { function syncFromUrl() { const parts = location.pathname.split("/").filter(Boolean); const urlLens = parts[1]; if (urlLens === "rfx" || urlLens === "resources" || urlLens === "intelligence" || urlLens === "capabilities") { const urlState = searchStateFromParams(new URLSearchParams(location.search)); setLens(urlLens); setSearchByLens((current) => ({ ...current, [urlLens]: urlState })); const recordId = parts[2]; setSelectedByLens((current) => ({ ...current, [urlLens]: recordId })); setDetailRecordId(recordId); } } syncFromUrl(); addEventListener("popstate", syncFromUrl); return () => removeEventListener("popstate", syncFromUrl); }, []);
  useEffect(() => { if (referenceMode) return; const timeout = setTimeout(() => { void loadResults(); }, 160); return () => clearTimeout(timeout); }, [loadResults]);
  useEffect(() => { if (selectedRecordId && resultStatus === "ready" && !records.some((record) => record.id === selectedRecordId)) setSelectedByLens((current) => ({ ...current, [lens]: undefined })); }, [records, selectedRecordId, lens, resultStatus]);
  useEffect(() => { if (!actionNotice) return; const timeout = setTimeout(() => setActionNotice(""), 3600); return () => clearTimeout(timeout); }, [actionNotice]);
  useEffect(() => { if (!resourceNotice) return; const timeout = setTimeout(() => setResourceNotice(undefined), 4200); return () => clearTimeout(timeout); }, [resourceNotice]);

  function persistRecent(next: RecentSearch[]) { setRecentSearches(next); try { localStorage.setItem(recentStorageKey, JSON.stringify(next)); } catch {} }
  function persistSaved(next: SavedSearch[]) { setSavedSearches(next); try { localStorage.setItem(savedStorageKey, JSON.stringify(next)); } catch {} }
  function setUrl(nextLens: ExchangeLens, recordId?: string, mode: "push" | "replace" = "replace", state = searchByLens[nextLens]) { const path = recordId ? `/exchange/${nextLens}/${recordId}` : `/exchange/${nextLens}`; const params = searchStateToParams(state).toString(); const next = params ? `${path}?${params}` : path; history[mode === "push" ? "pushState" : "replaceState"]({}, "", next); }
  function getRecordShareUrl(record: ExchangeRecord) { const url = `${location.origin}/exchange/${lens}/${record.id}`; return url; }
  function updateSearchState(next: ExchangeSearchState) { setSearchByLens((current) => ({ ...current, [lens]: next })); setUrl(lens, detailRecordId, "replace", next); }
  function commitSearch(next: ExchangeSearchState) { updateSearchState(next); if (!next.query.trim() && activeFilterCount(next) === 0) return; const recent: RecentSearch = { id: `${lens}-${Date.now()}`, lens, state: next, createdAt: new Date().toISOString() }; persistRecent([recent, ...recentSearches.filter((item) => item.lens !== lens || JSON.stringify(item.state) !== JSON.stringify(next))].slice(0, 12)); }
  function saveCurrentSearch() { if (!searchState.query.trim() && activeFilterCount(searchState) === 0) return; const descriptor = searchState.query.trim() || searchState.filters.geography.trim() || "Discovery"; const saved: SavedSearch = { id: `${lens}-${Date.now()}`, name: `${definition.label}: ${descriptor}`, lens, state: searchState, createdAt: new Date().toISOString() }; persistSaved([saved, ...savedSearches.filter((item) => item.lens !== lens || JSON.stringify(item.state) !== JSON.stringify(searchState))].slice(0, 20)); }
  function changeLens(next: ExchangeLens) { const prior = searchByLens[next]; const carried = prior.query.trim() ? prior : { ...prior, query: searchState.query }; setLens(next); setSearchByLens((current) => ({ ...current, [next]: carried })); setDetailRecordId(undefined); setResourceWorkflow(undefined); setIntelligenceWorkflow(undefined); setCapabilityWorkflow(undefined); setDrawerWorkflow(undefined); setSharedWorkflow(undefined); setRfxWorkflow(undefined); setActionNotice(""); setUrl(next, selectedByLens[next], "replace", carried); }
  function setDrawer(next: DrawerState) { setDrawerByLens((current) => ({ ...current, [lens]: next })); }
  function setMapView(next: MapViewState) { setMapViewByLens((current) => ({ ...current, [lens]: next })); }
  function selectRecord(id: string) { setSelectedByLens((current) => ({ ...current, [lens]: id })); if (drawer === "peek") setDrawer("mid"); }
  function openDetail(id: string) { selectRecord(id); setDetailRecordId(id); setUrl(lens, id, "push", searchState); }
  function closeDetail() { setDetailRecordId(undefined); setUrl(lens, undefined, "replace", searchState); }
  function relationshipActive(recordId: string, workflow: SharedWorkflowId) { return Boolean(relationshipState[recordId]?.[workflow]); }
  function actionIsActive(record: ExchangeRecord | undefined, action: LensAction) { if (!record || !action.toggle) return false; if (action.toggle === "save") return savedRecordIds.has(record.id) || Boolean(record.saved); if (action.toggle === "watch") return relationshipActive(record.id, "watch"); if (action.toggle === "track") return relationshipActive(record.id, "track"); return relationshipActive(record.id, "follow") || Boolean(record.card?.relationships?.includes("following")); }
  function activeActionIds(record: ExchangeRecord | undefined, resolved: LensAction[]) { return resolved.filter((action) => actionIsActive(record, action)).map((action) => action.id); }

  async function postDomainWorkflow(body: Record<string, unknown>) {
    if (referenceMode) throw new Error("The static preview does not execute data mutations.");
    const response = await fetch("/api/exchange/domain-workflows", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json().catch(() => ({})) as { error?: string; result?: { recordId: string; message: string } };
    if (!response.ok || !result.result) throw new Error(result.error ?? "Workflow failed.");
    return result.result;
  }

  async function createResource(draft: ResourceDraft) { try { const result = await postDomainWorkflow({ domain: "resources", action: "offer", draft }); setResourceWorkflow(undefined); setResourceNotice(result.message); await loadResults(); setSelectedByLens((current) => ({ ...current, resources: result.recordId })); } catch (error) { setResourceNotice(error instanceof Error ? error.message : "Resource offer failed."); } }
  async function updateResource(recordId: string, draft: ResourceDraft) { try { const result = await postDomainWorkflow({ domain: "resources", action: "edit", recordId, draft }); setResourceWorkflow(undefined); setResourceNotice(result.message); await loadResults(); } catch (error) { setResourceNotice(error instanceof Error ? error.message : "Resource update failed."); } }
  async function requestResource(recordId: string, request: ResourceRequestDraft) { try { const result = await postDomainWorkflow({ domain: "resources", action: "request", recordId, draft: request }); setResourceWorkflow(undefined); setResourceNotice(result.message); } catch (error) { setResourceNotice(error instanceof Error ? error.message : "Resource request failed."); } }
  async function archiveResource(recordId: string) { try { const result = await postDomainWorkflow({ domain: "resources", action: "archive", recordId }); setResourceWorkflow(undefined); setResourceNotice(result.message); setSelectedByLens((current) => ({ ...current, resources: undefined })); setDetailRecordId(undefined); await loadResults(); setUrl("resources"); } catch (error) { setResourceNotice(error instanceof Error ? error.message : "Resource archive failed."); } }
  async function createInsight(record: ExchangeRecord) { try { const result = await postDomainWorkflow({ domain: "intelligence", action: "add", record }); setActionNotice(result.message); await loadResults(); setSelectedByLens((current) => ({ ...current, intelligence: result.recordId })); } catch (error) { setActionNotice(error instanceof Error ? error.message : "Insight creation failed."); } }
  async function updateInsight(record: ExchangeRecord) { try { const result = await postDomainWorkflow({ domain: "intelligence", action: "edit", record }); setActionNotice(result.message); await loadResults(); } catch (error) { setActionNotice(error instanceof Error ? error.message : "Insight update failed."); } }
  async function addIntelligenceNote(recordId: string, note: string) { try { const result = await postDomainWorkflow({ domain: "intelligence", action: "note", recordId, note }); setIntelligenceNotes((current) => ({ ...current, [recordId]: [...(current[recordId] ?? []), note] })); setActionNotice(result.message); } catch (error) { setActionNotice(error instanceof Error ? error.message : "Adding note failed."); } }

  async function toggleSaved(recordId: string) {
    const record = allRecords.find((item) => item.id === recordId); if (!record) return;
    if (referenceMode) { setActionNotice("The static preview does not simulate saved-state persistence."); return; }
    const active = savedRecordIds.has(recordId) || Boolean(record.saved);
    try {
      const response = await fetch("/api/exchange/workflows", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ actionId: "save", lens, recordId, source: "action-rail", payload: { active: !active } }) });
      const body = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Save workflow failed.");
      setSavedRecordIds((current) => { const next = new Set(current); if (active) next.delete(recordId); else next.add(recordId); return next; });
      setRecordsState((current) => current.map((item) => item.id === recordId ? { ...item, saved: !active } : item));
    } catch (error) { setActionNotice(error instanceof Error ? error.message : "Save workflow failed."); }
  }

  function launchShared(workflow: SharedWorkflowId, record: ExchangeRecord, source: "action-rail" | "detail" = "action-rail") {
    if (workflow === "share") void getRecordShareUrl(record);
    setSharedWorkflow({ workflow, lens, record, actor: referenceActorContext, source });
  }

  function executeDrawerWorkflow(execution: DrawerWorkflowExecution, node: DrawerWorkflowNode, record = actionRecord) {
    if (execution.kind === "outcome") { setActionNotice(node.label); return; }
    if (execution.kind === "detail") { if (record) { setDrawerWorkflow(undefined); openDetail(record.id); } return; }
    if (execution.kind === "shared") { if (record) { setDrawerWorkflow(undefined); launchShared(execution.workflow, record); } return; }
    if (execution.kind === "rfx") { setDrawerWorkflow(undefined); setRfxWorkflow({ command: execution.workflow, recordId: record?.id }); return; }
    if (execution.kind === "resource") { setDrawerWorkflow(undefined); if (execution.workflow === "offer") setResourceWorkflow({ mode: "offer" }); else if (record && execution.workflow === "edit") setResourceWorkflow({ mode: "edit", recordId: record.id }); else if (record && execution.workflow === "request") setResourceWorkflow({ mode: "request", recordId: record.id }); else if (record && execution.workflow === "archive") setResourceWorkflow({ mode: "archive", recordId: record.id }); return; }
    if (execution.kind === "intelligence") { setDrawerWorkflow(undefined); setIntelligenceWorkflow({ mode: execution.workflow, recordId: record?.id }); return; }
    if (execution.kind === "capability") { if (record) { setDrawerWorkflow(undefined); setCapabilityWorkflow({ mode: execution.workflow, recordId: record.id }); } return; }
    if (execution.kind === "menu") { setDrawerWorkflow(undefined); setMenuOpen(true); setActionNotice("Open Referrals in Menu to manage this cross-lens workflow."); }
  }

  function handleAction(action: LensAction, record?: ExchangeRecord) {
    if (action.requiresRecord && !record) return;
    const root = getDrawerWorkflowRoot(lens, action.ownership, action.id);
    if (!root) { setActionNotice(`No source-defined child workflow is registered for ${action.label}.`); return; }
    if (root.children?.length) { setDrawerWorkflow({ root, recordId: record?.id }); return; }
    if (root.execution) executeDrawerWorkflow(root.execution, root, record);
  }

  function handleSharedComplete(event: SharedWorkflowEvent) {
    if (event.workflow === "save") {
      const active = event.payload.active !== false;
      setSavedRecordIds((current) => { const next = new Set(current); if (active) next.add(event.recordId); else next.delete(event.recordId); return next; });
      setRecordsState((current) => current.map((item) => item.id === event.recordId ? { ...item, saved: active } : item));
    }
    if (event.workflow === "watch" || event.workflow === "track" || event.workflow === "follow") {
      const active = event.payload.active !== false;
      setRelationshipState((current) => ({ ...current, [event.recordId]: { ...(current[event.recordId] ?? {}), [event.workflow]: active } }));
    }
    setSharedWorkflow(undefined);
    setActionNotice(`${event.eventName}: ${event.recordTitle}`);
  }

  function resetMapView() { setMapView(createDefaultMapView()); setViewportDirty(false); }
  function locateViewer() { if (!("geolocation" in navigator)) { setGeolocationStatus("unavailable"); return; } setGeolocationStatus("requesting"); navigator.geolocation.getCurrentPosition((position) => { setViewerLocation({ lat: position.coords.latitude, lng: position.coords.longitude }); setGeolocationStatus("located"); }, (error) => setGeolocationStatus(error.code === 1 ? "denied" : "unavailable"), { timeout: 8000, maximumAge: 60000 }); }

  const visibleRecords = records.filter((record) => record.resource?.status !== "archived");
  const lensRecent = recentSearches.filter((item) => item.lens === lens);
  const lensSaved = savedSearches.filter((item) => item.lens === lens);
  const mapped = visibleRecords.filter((record) => record.location).length;
  const offMap = visibleRecords.length - mapped;
  const totalAvailableCount = referenceMode ? filteredRecords.length : serverSummary.total;
  const drawerActiveActionIds = activeActionIds(actionRecord, actions);
  const detailActions = detailRecord ? definition.actions(detailRecord) : [];
  const detailActiveActionIds = activeActionIds(detailRecord, detailActions);
  const drawerWorkflowRecord = drawerWorkflow?.recordId ? allRecords.find((record) => record.id === drawerWorkflow.recordId) : actionRecord;
  const sharedWorkflowActive = sharedWorkflow ? (sharedWorkflow.workflow === "save" ? savedRecordIds.has(sharedWorkflow.record.id) || Boolean(sharedWorkflow.record.saved) : relationshipActive(sharedWorkflow.record.id, sharedWorkflow.workflow)) : false;

  return <main className="exchange-shell">
    <PersistentMap lens={lens} records={visibleRecords} selectedRecordId={selectedRecordId} drawerState={drawer} view={mapView} viewerLocation={viewerLocation} onViewChange={(next) => { setMapView(next); setViewportDirty(true); }} onSelect={selectRecord} />
    <SearchControls state={searchState} placeholder={definition.searchPlaceholder} lensLabel={definition.label} suggestions={suggestions} recentSearches={lensRecent} savedSearches={lensSaved} onStateChange={updateSearchState} onCommit={commitSearch} onRunState={(next) => { updateSearchState(next); commitSearch(next); }} onSave={saveCurrentSearch} />
    <FloatingControls lens={lens} records={lensRecords.filter((record) => record.resource?.status !== "archived")} search={searchState.query} filters={floatingFilters} onFiltersChange={(next) => setFiltersByLens((current) => ({ ...current, [lens]: next }))} mapDisplayMode={mapView.camera.mode} onMapDisplayModeChange={(mode: MapDisplayMode) => setMapView({ ...mapView, camera: { ...mapView.camera, mode, pitch: mode === "3d" ? 42 : 0 } })} geolocationStatus={geolocationStatus} onLocate={locateViewer} onResetView={resetMapView} searchAreaAvailable={viewportDirty} onSearchArea={() => setViewportDirty(false)} />
    <ResultsDrawer state={drawer} onStateChange={setDrawer} lens={lens} lensLabel={definition.label} records={visibleRecords} totalAvailableCount={totalAvailableCount} selectedRecordId={selectedRecordId} actions={actions} activeActionIds={drawerActiveActionIds} onAction={(action) => handleAction(action, actionRecord)} emptyMessage={definition.emptyMessage} resultContext={`${mapped} mapped · ${offMap} off-map`} query={drawerQuery} onQueryChange={(next) => setDrawerQueries((current) => ({ ...current, [lens]: next }))} onSelect={selectRecord} onOpen={openDetail} onToggleSave={(id) => { void toggleSaved(id); }} resultStatus={resultStatus} hasMore={Boolean(nextCursor)} loadingMore={loadingMore} onLoadMore={() => { if (nextCursor) void loadResults(nextCursor, true); }} onRetry={() => { void loadResults(); }} />
    <BottomNav activeLens={lens} onLensChange={changeLens} onMenu={() => setMenuOpen(true)} />
    {detailRecord ? <DetailSurface record={detailRecord} actions={detailActions} activeActionIds={detailActiveActionIds} notes={intelligenceNotes[detailRecord.id] ?? []} onAction={(action) => handleAction(action, detailRecord)} onClose={closeDetail} /> : null}
    {menuOpen ? <MenuSurface onClose={() => setMenuOpen(false)} /> : null}
    {drawerWorkflow ? <DrawerWorkflowNavigator root={drawerWorkflow.root} record={drawerWorkflowRecord} onClose={() => setDrawerWorkflow(undefined)} onExecute={(execution, node) => executeDrawerWorkflow(execution, node, drawerWorkflowRecord)} onInspectReferralPolicy={() => { if (drawerWorkflowRecord) { setReferralPolicyRecordId(drawerWorkflowRecord.id); setDrawerWorkflow(undefined); } }} /> : null}
    {sharedWorkflow ? <SharedWorkflowSurface launch={sharedWorkflow} records={allRecords} active={sharedWorkflowActive} onClose={() => setSharedWorkflow(undefined)} onComplete={handleSharedComplete} /> : null}
    {rfxWorkflow ? <RfxWorkflowSurface command={rfxWorkflow.command} record={rfxWorkflowRecord} onClose={() => setRfxWorkflow(undefined)} onComplete={(result) => { setRfxWorkflow(undefined); setActionNotice(result.message); void loadResults(); if (result.recordId) setSelectedByLens((current) => ({ ...current, rfx: result.recordId })); }} /> : null}
    {referralPolicyRecord ? <ReferralPolicySurface record={referralPolicyRecord} onClose={() => setReferralPolicyRecordId(undefined)} /> : null}
    {resourceWorkflow ? <ResourceWorkflowSurface workflow={resourceWorkflow} record={resourceWorkflowRecord} onClose={() => setResourceWorkflow(undefined)} onCreate={(draft) => { void createResource(draft); }} onUpdate={(recordId, draft) => { void updateResource(recordId, draft); }} onRequest={(recordId, request) => { void requestResource(recordId, request); }} onArchive={(recordId) => { void archiveResource(recordId); }} /> : null}
    {intelligenceWorkflow ? <IntelligenceWorkflowSurface workflow={intelligenceWorkflow.mode} record={intelligenceWorkflowRecord} records={allRecords} onClose={() => setIntelligenceWorkflow(undefined)} onCreate={(record) => { void createInsight(record); }} onUpdate={(record) => { void updateInsight(record); }} onAddNote={(recordId, note) => { void addIntelligenceNote(recordId, note); }} /> : null}
    {capabilityWorkflow && capabilityWorkflowProfile ? <CapabilityWorkflowSurface profile={capabilityWorkflowProfile} mode={capabilityWorkflow.mode} onClose={() => setCapabilityWorkflow(undefined)} /> : null}
    <ResourceNotice message={resourceNotice} />{actionNotice ? <div className={styles.actionNotice} role="status" aria-live="polite">{actionNotice}</div> : null}
  </main>;
}
