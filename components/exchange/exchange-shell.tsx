"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  Coordinates,
  DrawerQueryState,
  DrawerState,
  ExchangeFilters,
  ExchangeLens,
  ExchangeRecord,
  ExchangeSearchState,
  GeolocationStatus,
  LensAction,
  MapDisplayMode,
  MapViewState,
  RecentSearch,
  SavedSearch,
} from "@/lib/exchange/contracts";
import type { RecordNavigationNode } from "@/lib/exchange/record-navigation";
import { applyExchangeFilters, createExchangeFilters } from "@/lib/exchange/filter";
import { applyDrawerQuery, createDefaultDrawerQuery } from "@/lib/exchange/drawer";
import type { IntelligenceInsightInput, IntelligenceWorkflow } from "@/lib/exchange/intelligence";
import { lensDefinitions, lensOrder } from "@/lib/exchange/lenses";
import { createDefaultMapView } from "@/lib/exchange/map-model";
import type { ResourceDraft, ResourceRequestDraft } from "@/lib/exchange/resources";
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
const initialSearchStates = () => Object.fromEntries(lensOrder.map((lens) => [lens, defaultSearchState()])) as Record<ExchangeLens, ExchangeSearchState>;
const initialFloatingFilters = () => Object.fromEntries(lensOrder.map((lens) => [lens, createExchangeFilters()])) as Record<ExchangeLens, ExchangeFilters>;
const initialDrawerQueries = () => Object.fromEntries(lensOrder.map((lens) => [lens, createDefaultDrawerQuery()])) as Record<ExchangeLens, DrawerQueryState>;
type IntelligenceFlow = { mode: IntelligenceWorkflow; recordId?: string };
type ServiceMode = "runtime" | "preview";

const previewAccess = {
  canOpenDetail: true,
  canSave: false,
  canWatch: false,
  canFollow: false,
  canTrack: false,
  canShare: true,
  canRefer: false,
  canRespond: false,
  canManage: false,
};

export function ExchangeShell({
  initialLens = "rfx",
  initialRecordId,
  initialRecords = [],
  serviceMode = "runtime",
}: {
  initialLens?: ExchangeLens;
  initialRecordId?: string;
  initialRecords?: ExchangeRecord[];
  serviceMode?: ServiceMode;
}) {
  const preparedInitialRecords = useMemo(() => serviceMode === "preview" ? initialRecords.map((record) => ({ ...record, access: previewAccess })) : initialRecords, [initialRecords, serviceMode]);
  const [lens, setLens] = useState<ExchangeLens>(initialLens);
  const [recordsState, setRecordsState] = useState<ExchangeRecord[]>(preparedInitialRecords);
  const [searchByLens, setSearchByLens] = useState<Record<ExchangeLens, ExchangeSearchState>>(initialSearchStates);
  const [filtersByLens, setFiltersByLens] = useState<Record<ExchangeLens, ExchangeFilters>>(initialFloatingFilters);
  const [drawerQueries, setDrawerQueries] = useState<Record<ExchangeLens, DrawerQueryState>>(initialDrawerQueries);
  const [drawer, setDrawer] = useState<DrawerState>("mid");
  const [mapView, setMapView] = useState<MapViewState>(createDefaultMapView);
  const [selectedRecordId, setSelectedRecordId] = useState<string | undefined>(initialRecordId);
  const [detailRecordId, setDetailRecordId] = useState<string | undefined>(initialRecordId);
  const [detailNavigationPath, setDetailNavigationPath] = useState<string[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [actionNotice, setActionNotice] = useState("");
  const [resourceWorkflow, setResourceWorkflow] = useState<ResourceWorkflow | undefined>();
  const [resourceNotice, setResourceNotice] = useState<string>();
  const [intelligenceWorkflow, setIntelligenceWorkflow] = useState<IntelligenceFlow>();
  const [geolocationStatus, setGeolocationStatus] = useState<GeolocationStatus>("idle");
  const [viewerLocation, setViewerLocation] = useState<Coordinates | undefined>();
  const [viewportDirty, setViewportDirty] = useState(false);

  useEffect(() => { setRecordsState(preparedInitialRecords); }, [preparedInitialRecords]);

  const allRecords = recordsState;
  const definition = lensDefinitions[lens];
  const searchState = searchByLens[lens];
  const floatingFilters = filtersByLens[lens];
  const drawerQuery = drawerQueries[lens];
  const searchResponse = useMemo(() => searchExchangeRecords(allRecords, lens, searchState), [allRecords, lens, searchState]);
  const searchRecords = useMemo(() => searchResponse.results.map((result) => result.record), [searchResponse]);
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

  useEffect(() => { try { const recent = localStorage.getItem(recentStorageKey); const saved = localStorage.getItem(savedStorageKey); if (recent) setRecentSearches(JSON.parse(recent)); if (saved) setSavedSearches(JSON.parse(saved)); } catch {} }, []);
  useEffect(() => {
    function syncFromUrl() {
      const parts = location.pathname.split("/").filter(Boolean);
      const urlLens = parts[1];
      if (urlLens === "rfx" || urlLens === "resources" || urlLens === "intelligence" || urlLens === "capabilities") {
        const params = new URLSearchParams(location.search);
        const urlState = searchStateFromParams(params);
        setLens(urlLens);
        setSearchByLens((current) => ({ ...current, [urlLens]: urlState }));
        const recordId = parts[2];
        setSelectedRecordId(recordId);
        setDetailRecordId(recordId);
        setDetailNavigationPath(params.get("flow")?.split("/").filter(Boolean) ?? []);
      }
    }
    syncFromUrl();
    addEventListener("popstate", syncFromUrl);
    return () => removeEventListener("popstate", syncFromUrl);
  }, []);
  useEffect(() => { if (selectedRecordId && !records.some((record) => record.id === selectedRecordId)) setSelectedRecordId(undefined); }, [records, selectedRecordId]);
  useEffect(() => { if (!actionNotice) return; const timeout = setTimeout(() => setActionNotice(""), 3200); return () => clearTimeout(timeout); }, [actionNotice]);
  useEffect(() => { if (!resourceNotice) return; const timeout = setTimeout(() => setResourceNotice(undefined), 4200); return () => clearTimeout(timeout); }, [resourceNotice]);

  function persistRecent(next: RecentSearch[]) { setRecentSearches(next); try { localStorage.setItem(recentStorageKey, JSON.stringify(next)); } catch {} }
  function persistSaved(next: SavedSearch[]) { setSavedSearches(next); try { localStorage.setItem(savedStorageKey, JSON.stringify(next)); } catch {} }
  function setUrl(nextLens: ExchangeLens, recordId?: string, mode: "push" | "replace" = "replace", state = searchByLens[nextLens], flow: string[] = recordId === detailRecordId ? detailNavigationPath : []) {
    const path = recordId ? `/exchange/${nextLens}/${recordId}` : `/exchange/${nextLens}`;
    const params = searchStateToParams(state);
    if (recordId && flow.length) params.set("flow", flow.join("/"));
    const suffix = params.toString();
    history[mode === "push" ? "pushState" : "replaceState"]({}, "", suffix ? `${path}?${suffix}` : path);
  }
  function updateSearchState(next: ExchangeSearchState) { setSearchByLens((current) => ({ ...current, [lens]: next })); setUrl(lens, detailRecordId, "replace", next, detailNavigationPath); }
  function commitSearch(next: ExchangeSearchState) { updateSearchState(next); if (!next.query.trim() && activeFilterCount(next) === 0) return; const recent: RecentSearch = { id: `${lens}-${Date.now()}`, lens, state: next, createdAt: new Date().toISOString() }; persistRecent([recent, ...recentSearches.filter((item) => item.lens !== lens || JSON.stringify(item.state) !== JSON.stringify(next))].slice(0, 12)); }
  function saveCurrentSearch() { if (!searchState.query.trim() && activeFilterCount(searchState) === 0) return; const descriptor = searchState.query.trim() || searchState.filters.geography.trim() || "Discovery"; const saved: SavedSearch = { id: `${lens}-${Date.now()}`, name: `${definition.label}: ${descriptor}`, lens, state: searchState, createdAt: new Date().toISOString() }; persistSaved([saved, ...savedSearches.filter((item) => item.lens !== lens || JSON.stringify(item.state) !== JSON.stringify(searchState))].slice(0, 20)); }
  function changeLens(next: ExchangeLens) { const prior = searchByLens[next]; const carried = prior.query.trim() ? prior : { ...prior, query: searchState.query }; setLens(next); setSearchByLens((current) => ({ ...current, [next]: carried })); setSelectedRecordId(undefined); setDetailRecordId(undefined); setDetailNavigationPath([]); setResourceWorkflow(undefined); setIntelligenceWorkflow(undefined); setActionNotice(""); setUrl(next, undefined, "replace", carried, []); }
  function selectRecord(id: string) { setSelectedRecordId(id); if (drawer === "peek") setDrawer("mid"); }
  function openDetail(id: string) { setSelectedRecordId(id); setDetailRecordId(id); setDetailNavigationPath([]); setUrl(lens, id, "push", searchState, []); void recordActivity(id, "RecordCardOpened"); }
  function closeDetail() { setDetailRecordId(undefined); setDetailNavigationPath([]); setUrl(lens, undefined, "replace", searchState, []); }
  function updateDetailPath(path: string[]) { setDetailNavigationPath(path); if (detailRecordId) setUrl(lens, detailRecordId, "replace", searchState, path); }

  function activeActionIds(record: ExchangeRecord | undefined, resolved: LensAction[]) {
    if (!record) return [];
    const relations = new Set(record.card?.relationships ?? []);
    return resolved.filter((action) => {
      if (action.toggle === "save") return Boolean(record.saved);
      if (action.toggle === "watch") return relations.has("watched");
      if (action.toggle === "track" || action.id === "follow-track") return relations.has("following");
      if (action.toggle === "follow") return relations.has("following");
      return false;
    }).map((action) => action.id);
  }

  function updateRecordRelationships(recordId: string, relationships: string[], saved?: boolean) {
    setRecordsState((current) => current.map((record) => record.id !== recordId ? record : ({
      ...record,
      saved: saved ?? relationships.includes("saved"),
      card: { ...record.card, relationships: relationships.filter((item): item is NonNullable<ExchangeRecord["card"]>["relationships"] extends (infer T)[] | undefined ? T : never => ["saved", "watched", "following", "referred", "responded", "teamed", "requested", "connected", "owned"].includes(item)) as NonNullable<ExchangeRecord["card"]>["relationships"] },
    })));
  }

  async function responseJson(response: Response) {
    const body = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : `Request failed (${response.status}).`);
    return body;
  }

  async function runSharedWorkflow(actionId: string, record: ExchangeRecord, payload: Record<string, unknown> = {}) {
    if (serviceMode === "preview") throw new Error("The static preview is read-only. Production workflows require the authenticated runtime.");
    const normalizedAction = actionId === "invite-team" ? "team" : actionId === "follow-track" ? "track" : actionId;
    const response = await fetch("/api/exchange/workflows", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ actionId: normalizedAction, lens, recordId: record.id, source: detailRecordId ? "detail" : "action-rail", payload }) });
    const body = await responseJson(response);
    if (Array.isArray(body.relationships)) updateRecordRelationships(record.id, body.relationships.filter((item): item is string => typeof item === "string"), typeof body.saved === "boolean" ? body.saved : undefined);
    return body;
  }

  async function setRelationship(record: ExchangeRecord, kind: "saved" | "watching" | "tracking" | "following", active: boolean) {
    if (serviceMode === "preview") throw new Error("The static preview is read-only. Production relationships require an authenticated session.");
    const response = await fetch(`/api/exchange/records/${encodeURIComponent(record.id)}/relationships`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, active }) });
    const body = await responseJson(response);
    updateRecordRelationships(record.id, Array.isArray(body.relationships) ? body.relationships.filter((item): item is string => typeof item === "string") : [], typeof body.saved === "boolean" ? body.saved : undefined);
    return body;
  }

  async function runDomainWorkflow(action: string, recordId: string | undefined, payload: Record<string, unknown>) {
    if (serviceMode === "preview") throw new Error("The static preview is read-only. Production commands require the authenticated runtime.");
    const response = await fetch("/api/exchange/domain-workflows", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, recordId, payload }) });
    const body = await responseJson(response);
    await refreshLensRecords(lens);
    return body;
  }

  async function refreshLensRecords(targetLens: ExchangeLens) {
    if (serviceMode === "preview") return;
    const response = await fetch(`/api/exchange/results?lens=${encodeURIComponent(targetLens)}`, { cache: "no-store" });
    const body = await responseJson(response);
    const next = Array.isArray(body.records) ? body.records as ExchangeRecord[] : [];
    const type = typeByLens[targetLens];
    setRecordsState((current) => [...current.filter((record) => record.type !== type), ...next]);
  }

  async function recordActivity(recordId: string, eventName: "RecordCardOpened" | "RecordViewed") {
    if (serviceMode === "preview") return;
    await fetch("/api/exchange/activity", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ recordId, eventName }) }).catch(() => undefined);
  }

  async function toggleSaved(id: string) {
    const record = allRecords.find((item) => item.id === id); if (!record) return;
    try { await setRelationship(record, "saved", !record.saved); setActionNotice(`${record.saved ? "Removed from" : "Added to"} Saved: ${record.title}`); }
    catch (error) { setActionNotice(error instanceof Error ? error.message : "Unable to update Saved."); }
  }

  async function handleAction(action: LensAction, record?: ExchangeRecord) {
    if (action.requiresRecord && !record) return;
    if (!action.operational || !action.authorized || !action.applicable || !action.prerequisitesSatisfied) { setActionNotice(action.unavailableReason ?? "This workflow is unavailable."); return; }
    if (action.trigger === "detail" && record) { openDetail(record.id); return; }
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
    }
    if (action.id === "share" && record) {
      try {
        if (serviceMode === "runtime") await runSharedWorkflow("share", record);
        const url = `${location.origin}/exchange/${lens}/${record.id}`;
        if (navigator.share) await navigator.share({ title: record.title, text: record.summary, url });
        else { await navigator.clipboard.writeText(url); setActionNotice("Record link copied."); }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setActionNotice(error instanceof Error ? error.message : "Unable to share this record right now.");
      }
      return;
    }
    if (record && action.toggle) {
      const relations = new Set(record.card?.relationships ?? []);
      const kind = action.toggle === "save" ? "saved" : action.toggle === "watch" ? "watching" : action.toggle === "track" ? "tracking" : record.type === "intelligence" ? "tracking" : "following";
      const active = kind === "saved" ? !record.saved : kind === "watching" ? !relations.has("watched") : !relations.has("following");
      try { await setRelationship(record, kind, active); setActionNotice(`${action.label}: ${record.title}`); }
      catch (error) { setActionNotice(error instanceof Error ? error.message : "Unable to update relationship."); }
      return;
    }
    if (record && (action.id === "team" || action.id === "invite-team" || action.id === "refer")) {
      try { await runSharedWorkflow(action.id, record); setActionNotice(`${action.label} workflow created.`); }
      catch (error) { setActionNotice(error instanceof Error ? error.message : "Unable to create workflow."); }
    }
  }

  function executeNavigationNode(node: RecordNavigationNode) {
    const record = detailRecord; if (!record || !node.command) return;
    const action = detailActions.find((candidate) => candidate.id === node.actionId);
    if (action) { void handleAction(action, record); return; }
    if (["save", "watch", "track", "follow"].includes(node.command)) {
      const kind = node.command === "save" ? "saved" : node.command === "watch" ? "watching" : node.command === "track" ? "tracking" : "following";
      const relations = new Set(record.card?.relationships ?? []);
      const active = kind === "saved" ? !record.saved : kind === "watching" ? !relations.has("watched") : !relations.has("following");
      void setRelationship(record, kind, active).catch((error) => setActionNotice(error instanceof Error ? error.message : "Unable to update relationship."));
      return;
    }
    if (node.command === "share") { void handleAction({ id: "share", position: 1, label: "Share", icon: "↗", trigger: "direct", ownership: "any", visible: true, applicable: true, authorized: true, operational: true, prerequisitesSatisfied: true }, record); return; }
    if (node.command === "refer" || node.command === "team" || node.command === "invite-team") { void runSharedWorkflow(node.command === "invite-team" ? "team" : node.command, record).then(() => setActionNotice(`${node.label} workflow created.`)).catch((error) => setActionNotice(error instanceof Error ? error.message : "Unable to create workflow.")); return; }
    if (node.command === "offer-resource") setResourceWorkflow({ mode: "offer" });
    if (node.command === "edit-resource") setResourceWorkflow({ mode: "edit", recordId: record.id });
    if (node.command === "request-resource") setResourceWorkflow({ mode: "request", recordId: record.id });
    if (node.command === "archive-resource") setResourceWorkflow({ mode: "archive", recordId: record.id });
    if (node.command === "add-insight") setIntelligenceWorkflow({ mode: "add" });
    if (node.command === "edit-insight") setIntelligenceWorkflow({ mode: "edit", recordId: record.id });
    if (node.command === "add-note") setIntelligenceWorkflow({ mode: "note", recordId: record.id });
  }

  async function createResource(draft: ResourceDraft) { try { const result = await runDomainWorkflow("offer-resource", undefined, draft as unknown as Record<string, unknown>); setResourceWorkflow(undefined); setResourceNotice(`Resource offer published${typeof result.recordId === "string" ? ` · ${result.recordId}` : ""}.`); } catch (error) { setResourceNotice(error instanceof Error ? error.message : "Unable to publish resource."); } }
  async function updateResource(recordId: string, draft: ResourceDraft) { try { await runDomainWorkflow("edit-resource", recordId, draft as unknown as Record<string, unknown>); setResourceWorkflow(undefined); setResourceNotice("Resource changes saved."); } catch (error) { setResourceNotice(error instanceof Error ? error.message : "Unable to update resource."); } }
  async function requestResource(recordId: string, request: ResourceRequestDraft) { try { await runDomainWorkflow("request-resource", recordId, request as unknown as Record<string, unknown>); setResourceWorkflow(undefined); setResourceNotice("Resource request created."); } catch (error) { setResourceNotice(error instanceof Error ? error.message : "Unable to request resource."); } }
  async function archiveResource(recordId: string) { try { await runDomainWorkflow("archive-resource", recordId, {}); setResourceWorkflow(undefined); setResourceNotice("Resource archived and retained in audit history."); } catch (error) { setResourceNotice(error instanceof Error ? error.message : "Unable to archive resource."); } }
  async function createInsight(input: IntelligenceInsightInput) { await runDomainWorkflow("add-insight", undefined, input as unknown as Record<string, unknown>); setActionNotice("Insight added."); }
  async function updateInsight(recordId: string, input: IntelligenceInsightInput) { await runDomainWorkflow("edit-insight", recordId, input as unknown as Record<string, unknown>); setActionNotice("Insight updated."); }
  async function addIntelligenceNote(recordId: string, note: string) { await runDomainWorkflow("add-note", recordId, { note }); setActionNotice("Note added."); }

  function resetMapView() { setMapView(createDefaultMapView()); setViewportDirty(false); }
  function locateViewer() { if (!("geolocation" in navigator)) { setGeolocationStatus("unavailable"); return; } setGeolocationStatus("requesting"); navigator.geolocation.getCurrentPosition((position) => { setViewerLocation({ lat: position.coords.latitude, lng: position.coords.longitude }); setGeolocationStatus("located"); }, (error) => setGeolocationStatus(error.code === 1 ? "denied" : "unavailable"), { timeout: 8000, maximumAge: 60000 }); }

  const visibleRecords = records.filter((record) => record.resource?.status !== "archived");
  const lensRecent = recentSearches.filter((item) => item.lens === lens);
  const lensSaved = savedSearches.filter((item) => item.lens === lens);
  const mapped = visibleRecords.filter((record) => record.location).length;
  const offMap = visibleRecords.length - mapped;
  const drawerActiveActionIds = activeActionIds(actionRecord, actions);
  const detailActions = detailRecord ? definition.actions(detailRecord) : [];
  const detailActiveActionIds = activeActionIds(detailRecord, detailActions);

  return <main className="exchange-shell">
    <PersistentMap lens={lens} records={visibleRecords} selectedRecordId={selectedRecordId} drawerState={drawer} view={mapView} viewerLocation={viewerLocation} onViewChange={(next) => { setMapView(next); setViewportDirty(true); }} onSelect={selectRecord} />
    <SearchControls state={searchState} placeholder={definition.searchPlaceholder} lensLabel={definition.label} suggestions={suggestions} recentSearches={lensRecent} savedSearches={lensSaved} onStateChange={updateSearchState} onCommit={commitSearch} onRunState={(next) => { updateSearchState(next); commitSearch(next); }} onSave={saveCurrentSearch} />
    <FloatingControls lens={lens} records={lensRecords.filter((record) => record.resource?.status !== "archived")} search={searchState.query} filters={floatingFilters} onFiltersChange={(next) => setFiltersByLens((current) => ({ ...current, [lens]: next }))} mapDisplayMode={mapView.camera.mode} onMapDisplayModeChange={(mode: MapDisplayMode) => setMapView((current) => ({ ...current, camera: { ...current.camera, mode, pitch: mode === "3d" ? 42 : 0 } }))} geolocationStatus={geolocationStatus} onLocate={locateViewer} onResetView={resetMapView} searchAreaAvailable={viewportDirty} onSearchArea={() => setViewportDirty(false)} />
    <ResultsDrawer state={drawer} onStateChange={setDrawer} lens={lens} lensLabel={definition.label} records={visibleRecords} totalAvailableCount={filteredRecords.length} selectedRecordId={selectedRecordId} actions={actions} activeActionIds={drawerActiveActionIds} onAction={(action) => { void handleAction(action, actionRecord); }} emptyMessage={definition.emptyMessage} resultContext={`${mapped} mapped · ${offMap} off-map`} query={drawerQuery} onQueryChange={(next) => setDrawerQueries((current) => ({ ...current, [lens]: next }))} onSelect={selectRecord} onOpen={openDetail} onToggleSave={(id) => { void toggleSaved(id); }} />
    <BottomNav activeLens={lens} onLensChange={changeLens} onMenu={() => setMenuOpen(true)} />
    {detailRecord ? <DetailSurface record={detailRecord} actions={detailActions} activeActionIds={detailActiveActionIds} navigationPath={detailNavigationPath} onNavigationPathChange={updateDetailPath} onWorkflowNode={executeNavigationNode} onAction={(action) => { void handleAction(action, detailRecord); }} onClose={closeDetail} /> : null}
    {menuOpen ? <MenuSurface onClose={() => setMenuOpen(false)} /> : null}
    {resourceWorkflow ? <ResourceWorkflowSurface workflow={resourceWorkflow} record={resourceWorkflowRecord} onClose={() => setResourceWorkflow(undefined)} onCreate={createResource} onUpdate={updateResource} onRequest={requestResource} onArchive={archiveResource} /> : null}
    {intelligenceWorkflow ? <IntelligenceWorkflowSurface workflow={intelligenceWorkflow.mode} record={intelligenceWorkflowRecord} onClose={() => setIntelligenceWorkflow(undefined)} onCreate={createInsight} onUpdate={updateInsight} onAddNote={addIntelligenceNote} /> : null}
    <ResourceNotice message={resourceNotice} />
    {actionNotice ? <div className={styles.actionNotice} role="status" aria-live="polite">{actionNotice}</div> : null}
  </main>;
}
