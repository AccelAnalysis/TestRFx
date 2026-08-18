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
import { exchangeSeed } from "@/lib/exchange/seed";
import { applyExchangeFilters, createExchangeFilters } from "@/lib/exchange/filter";
import { applyDrawerQuery, createDefaultDrawerQuery } from "@/lib/exchange/drawer";
import { intelligenceSeed, type IntelligenceWorkflow } from "@/lib/exchange/intelligence";
import { isCapabilityWorkflowMode, type CapabilityWorkflowMode } from "@/lib/capabilities/actions";
import { capabilityExchangeRecords, getCapabilityProfileByExchangeRecordId } from "@/lib/capabilities/reference";
import { lensDefinitions, lensOrder } from "@/lib/exchange/lenses";
import { createDefaultMapView } from "@/lib/exchange/map-model";
import {
  listResourcesFromService,
  setResourceRelationshipThroughService,
} from "@/lib/exchange/resource-service-client";
import {
  initialResourceNavigationState,
  type ResourceNavigationAction,
  type ResourceNavigationState,
} from "@/lib/exchange/resource-navigation";
import type { ResourceRelationshipKind } from "@/lib/server/exchange/resource-service";
import type { MenuSectionId } from "@/lib/exchange/menu";
import {
  activeFilterCount,
  defaultSearchState,
  getSearchSuggestions,
  searchExchangeRecords,
  searchStateFromParams,
  searchStateToParams,
  typeByLens,
} from "@/lib/exchange/search";
import { CapabilityWorkflowSurface } from "@/components/capabilities/capability-workflow-surface";
import { PersistentMap } from "./persistent-map";
import { SearchControls } from "./search-controls";
import { FloatingControls } from "./floating-controls";
import { ResultsDrawer } from "./results-drawer";
import { BottomNav } from "./bottom-nav";
import { DetailSurface } from "./detail-surface";
import { MenuSurface } from "./menu-surface";
import { IntelligenceWorkflowSurface } from "./intelligence-workflow-surface";
import { ResourceNavigationSurface } from "./resource-navigation-surface";
import { ResourceNotice } from "./resource-notice";
import { ResourceWorkflowSurface, type ResourceWorkflow } from "./resource-workflow-surface";
import styles from "./exchange-shell.module.css";

const recentStorageKey = "rfxchange:recent-searches";
const savedStorageKey = "rfxchange:saved-searches";
const initialRecords = [
  ...exchangeSeed.filter((record) => record.type !== "intelligence" && record.type !== "capability"),
  ...intelligenceSeed,
  ...capabilityExchangeRecords,
];
const initialSavedRecordIds = initialRecords.filter((record) => record.saved).map((record) => record.id);
const initialSearchStates = () => Object.fromEntries(lensOrder.map((lens) => [lens, defaultSearchState()])) as Record<ExchangeLens, ExchangeSearchState>;
const initialFloatingFilters = () => Object.fromEntries(lensOrder.map((lens) => [lens, createExchangeFilters()])) as Record<ExchangeLens, ExchangeFilters>;
const initialDrawerQueries = () => Object.fromEntries(lensOrder.map((lens) => [lens, createDefaultDrawerQuery()])) as Record<ExchangeLens, DrawerQueryState>;
type IntelligenceFlow = { mode: IntelligenceWorkflow; recordId?: string };
type CapabilityFlow = { mode: CapabilityWorkflowMode; recordId: string };

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
  const [menuInitialSection, setMenuInitialSection] = useState<MenuSectionId | undefined>();
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [savedRecordIds, setSavedRecordIds] = useState<Set<string>>(() => new Set(initialSavedRecordIds));
  const [actionState, setActionState] = useState<Record<string, boolean>>({});
  const [actionNotice, setActionNotice] = useState("");
  const [resourceWorkflow, setResourceWorkflow] = useState<ResourceWorkflow | undefined>();
  const [resourceNotice, setResourceNotice] = useState<string>();
  const [resourceNavigationOpen, setResourceNavigationOpen] = useState(false);
  const [resourceNavigation, setResourceNavigation] = useState<ResourceNavigationState>(initialResourceNavigationState);
  const [intelligenceWorkflow, setIntelligenceWorkflow] = useState<IntelligenceFlow>();
  const [intelligenceNotes, setIntelligenceNotes] = useState<Record<string, string[]>>({});
  const [capabilityWorkflow, setCapabilityWorkflow] = useState<CapabilityFlow>();
  const [geolocationStatus, setGeolocationStatus] = useState<GeolocationStatus>("idle");
  const [viewerLocation, setViewerLocation] = useState<Coordinates | undefined>();
  const [viewportDirty, setViewportDirty] = useState(false);

  const allRecords = useMemo(
    () => recordsState.map((record) => ({ ...record, saved: savedRecordIds.has(record.id) })),
    [recordsState, savedRecordIds],
  );
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
  const resourceContextRecord = selectedRecord?.type === "resource" ? selectedRecord : undefined;
  const resourceWorkflowRecord = resourceWorkflow && "recordId" in resourceWorkflow
    ? allRecords.find((record) => record.id === resourceWorkflow.recordId)
    : undefined;
  const intelligenceWorkflowRecord = intelligenceWorkflow?.recordId
    ? allRecords.find((record) => record.id === intelligenceWorkflow.recordId)
    : undefined;
  const capabilityWorkflowProfile = capabilityWorkflow
    ? getCapabilityProfileByExchangeRecordId(capabilityWorkflow.recordId)
    : undefined;

  useEffect(() => {
    try {
      const recent = localStorage.getItem(recentStorageKey);
      const saved = localStorage.getItem(savedStorageKey);
      if (recent) setRecentSearches(JSON.parse(recent));
      if (saved) setSavedSearches(JSON.parse(saved));
    } catch {}
  }, []);

  useEffect(() => {
    let cancelled = false;
    void listResourcesFromService()
      .then(({ records: serviceRecords }) => {
        if (cancelled) return;
        setRecordsState((current) => [...current.filter((record) => record.type !== "resource"), ...serviceRecords]);
        setSavedRecordIds((current) => {
          const next = new Set([...current].filter((id) => !initialRecords.some((record) => record.id === id && record.type === "resource")));
          serviceRecords.filter((record) => record.saved).forEach((record) => next.add(record.id));
          return next;
        });
      })
      .catch(() => {
        // Static/preview builds may not have a configured database or authenticated org.
        // Seed Resources remain read-only preview data; mutations never report fake success.
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    function syncFromUrl() {
      const parts = location.pathname.split("/").filter(Boolean);
      const urlLens = parts[1];
      if (urlLens === "rfx" || urlLens === "resources" || urlLens === "intelligence" || urlLens === "capabilities") {
        const urlState = searchStateFromParams(new URLSearchParams(location.search));
        setLens(urlLens);
        setSearchByLens((current) => ({ ...current, [urlLens]: urlState }));
        const recordId = parts[2];
        setSelectedRecordId(recordId);
        setDetailRecordId(recordId);
      }
    }
    syncFromUrl();
    addEventListener("popstate", syncFromUrl);
    return () => removeEventListener("popstate", syncFromUrl);
  }, []);

  useEffect(() => {
    if (selectedRecordId && !records.some((record) => record.id === selectedRecordId)) setSelectedRecordId(undefined);
  }, [records, selectedRecordId]);
  useEffect(() => {
    if (!actionNotice) return;
    const timeout = setTimeout(() => setActionNotice(""), 2200);
    return () => clearTimeout(timeout);
  }, [actionNotice]);
  useEffect(() => {
    if (!resourceNotice) return;
    const timeout = setTimeout(() => setResourceNotice(undefined), 4200);
    return () => clearTimeout(timeout);
  }, [resourceNotice]);

  function persistRecent(next: RecentSearch[]) {
    setRecentSearches(next);
    try { localStorage.setItem(recentStorageKey, JSON.stringify(next)); } catch {}
  }
  function persistSaved(next: SavedSearch[]) {
    setSavedSearches(next);
    try { localStorage.setItem(savedStorageKey, JSON.stringify(next)); } catch {}
  }
  function setUrl(nextLens: ExchangeLens, recordId?: string, mode: "push" | "replace" = "replace", state = searchByLens[nextLens]) {
    const path = recordId ? `/exchange/${nextLens}/${recordId}` : `/exchange/${nextLens}`;
    const params = searchStateToParams(state).toString();
    const next = params ? `${path}?${params}` : path;
    history[mode === "push" ? "pushState" : "replaceState"]({}, "", next);
  }
  function updateSearchState(next: ExchangeSearchState) {
    setSearchByLens((current) => ({ ...current, [lens]: next }));
    setUrl(lens, detailRecordId, "replace", next);
  }
  function commitSearch(next: ExchangeSearchState) {
    updateSearchState(next);
    if (!next.query.trim() && activeFilterCount(next) === 0) return;
    const recent: RecentSearch = { id: `${lens}-${Date.now()}`, lens, state: next, createdAt: new Date().toISOString() };
    persistRecent([recent, ...recentSearches.filter((item) => item.lens !== lens || JSON.stringify(item.state) !== JSON.stringify(next))].slice(0, 12));
  }
  function saveCurrentSearch() {
    if (!searchState.query.trim() && activeFilterCount(searchState) === 0) return;
    const descriptor = searchState.query.trim() || searchState.filters.geography.trim() || "Discovery";
    const saved: SavedSearch = { id: `${lens}-${Date.now()}`, name: `${definition.label}: ${descriptor}`, lens, state: searchState, createdAt: new Date().toISOString() };
    persistSaved([saved, ...savedSearches.filter((item) => item.lens !== lens || JSON.stringify(item.state) !== JSON.stringify(searchState))].slice(0, 20));
  }
  function changeLens(next: ExchangeLens) {
    const prior = searchByLens[next];
    const carried = prior.query.trim() ? prior : { ...prior, query: searchState.query };
    setLens(next);
    setSearchByLens((current) => ({ ...current, [next]: carried }));
    setSelectedRecordId(undefined);
    setDetailRecordId(undefined);
    setResourceWorkflow(undefined);
    setResourceNavigationOpen(false);
    setIntelligenceWorkflow(undefined);
    setCapabilityWorkflow(undefined);
    setActionNotice("");
    setUrl(next, undefined, "replace", carried);
  }
  function selectRecord(id: string) {
    setSelectedRecordId(id);
    if (drawer === "peek") setDrawer("mid");
  }
  function openDetail(id: string) {
    setSelectedRecordId(id);
    setDetailRecordId(id);
    setUrl(lens, id, "push", searchState);
  }
  function closeDetail() {
    setDetailRecordId(undefined);
    setUrl(lens, undefined, "replace", searchState);
  }

  function setSavedLocal(id: string, active: boolean) {
    setSavedRecordIds((current) => {
      const next = new Set(current);
      if (active) next.add(id); else next.delete(id);
      return next;
    });
  }

  async function toggleSaved(id: string) {
    const record = allRecords.find((item) => item.id === id);
    if (!record) return;
    const active = !savedRecordIds.has(id);
    if (record.type === "resource") {
      try {
        await setResourceRelationshipThroughService(id, "saved", active);
        setSavedLocal(id, active);
        setResourceNotice(active ? "Resource saved." : "Resource removed from saved.");
      } catch (error) {
        setResourceNotice(error instanceof Error ? error.message : "The Resources service could not update Save.");
      }
      return;
    }
    setSavedLocal(id, active);
  }

  function actionKey(record: ExchangeRecord, action: LensAction) { return `${record.id}:${action.id}`; }
  function actionIsActive(record: ExchangeRecord | undefined, action: LensAction) {
    if (!record || !action.toggle) return false;
    if (action.toggle === "save") return savedRecordIds.has(record.id);
    if (lens === "capabilities" && action.id === "follow") return savedRecordIds.has(record.id);
    return actionState[actionKey(record, action)] ?? false;
  }
  function activeActionIds(record: ExchangeRecord | undefined, resolved: LensAction[]) {
    return resolved.filter((action) => actionIsActive(record, action)).map((action) => action.id);
  }

  function commitResourceRecord(record: ExchangeRecord) {
    setRecordsState((current) => current.some((item) => item.id === record.id)
      ? current.map((item) => item.id === record.id ? record : item)
      : [record, ...current]);
    setSavedLocal(record.id, Boolean(record.saved));
    setSelectedRecordId(record.id);
  }

  function markResourceArchived(recordId: string) {
    setRecordsState((current) => current.map((record) => record.id === recordId && record.resource
      ? { ...record, resource: { ...record.resource, status: "archived" as const } }
      : record));
    setSelectedRecordId(undefined);
    setDetailRecordId(undefined);
    setUrl("resources");
  }

  function resourceRelationshipChanged(recordId: string, kind: ResourceRelationshipKind, active: boolean) {
    if (kind === "saved") setSavedLocal(recordId, active);
    if (kind === "following") {
      setRecordsState((current) => current.map((record) => {
        if (record.id !== recordId) return record;
        const relationships = new Set(record.card?.relationships ?? []);
        if (active) relationships.add("following"); else relationships.delete("following");
        return { ...record, card: { ...record.card, relationships: [...relationships] } };
      }));
    }
  }

  function openReferralsManagement() {
    setResourceWorkflow(undefined);
    setResourceNavigationOpen(false);
    setMenuInitialSection("referrals");
    setMenuOpen(true);
  }

  function referResource(recordId: string) {
    setSelectedRecordId(recordId);
    setResourceNavigationOpen(false);
    setResourceWorkflow({ mode: "referral", recordId });
  }

  function dispatchResourceNavigation(action: ResourceNavigationAction) {
    if (action === "open-referrals-management") { openReferralsManagement(); return; }
    if (action === "offer") { setResourceNavigationOpen(false); setResourceWorkflow({ mode: "offer" }); return; }
    const record = resourceContextRecord;
    if (!record) { setResourceNotice("Select a Resource to continue this workflow."); return; }
    setResourceNavigationOpen(false);
    if (action === "view") { openDetail(record.id); return; }
    if (action === "referral") { setResourceWorkflow({ mode: "referral", recordId: record.id }); return; }
    if (action === "edit") { setResourceWorkflow({ mode: "edit", recordId: record.id }); return; }
    if (action === "request") { setResourceWorkflow({ mode: "request", recordId: record.id }); return; }
    if (action === "share") { setResourceWorkflow({ mode: "share", recordId: record.id }); return; }
    if (action === "save-archive") { setResourceWorkflow({ mode: "save-archive", recordId: record.id }); return; }
    if (action === "save-follow") setResourceWorkflow({ mode: "save-follow", recordId: record.id });
  }

  function createInsight(record: ExchangeRecord) {
    setRecordsState((current) => [record, ...current]);
    setSelectedRecordId(record.id);
    setActionNotice("Insight added to the reference Intelligence lens.");
  }
  function updateInsight(record: ExchangeRecord) {
    setRecordsState((current) => current.map((item) => item.id === record.id ? record : item));
    setActionNotice("Insight updated in the reference session.");
  }
  function addIntelligenceNote(recordId: string, note: string) {
    setIntelligenceNotes((current) => ({ ...current, [recordId]: [...(current[recordId] ?? []), note] }));
    setActionNotice("Note added to this Intelligence record.");
  }

  async function handleAction(action: LensAction, record?: ExchangeRecord) {
    if (action.requiresRecord && !record) return;
    if (lens === "resources") {
      if (action.id === "offer-resource") { setResourceWorkflow({ mode: "offer" }); return; }
      if (action.id === "edit-resource" && record) { setResourceWorkflow({ mode: "edit", recordId: record.id }); return; }
      if (action.id === "request-resource" && record) { setResourceWorkflow({ mode: "request", recordId: record.id }); return; }
      if (action.id === "share" && record) { setResourceWorkflow({ mode: "share", recordId: record.id }); return; }
      if (action.id === "save-archive" && record) { setResourceWorkflow({ mode: "save-archive", recordId: record.id }); return; }
      if (action.id === "save-follow" && record) { setResourceWorkflow({ mode: "save-follow", recordId: record.id }); return; }
    }
    if (lens === "intelligence") {
      if (action.id === "add-insight") { setIntelligenceWorkflow({ mode: "add" }); return; }
      if (action.id === "edit-insight" && record) { setIntelligenceWorkflow({ mode: "edit", recordId: record.id }); return; }
      if (action.id === "add-note" && record) { setIntelligenceWorkflow({ mode: "note", recordId: record.id }); return; }
      if (action.id === "compare" && record) { setIntelligenceWorkflow({ mode: "compare", recordId: record.id }); return; }
    }
    if (lens === "capabilities" && record && isCapabilityWorkflowMode(action.id)) {
      setCapabilityWorkflow({ mode: action.id, recordId: record.id }); return;
    }
    if (lens === "capabilities" && record && action.id === "follow") {
      void toggleSaved(record.id);
      setActionNotice(`${savedRecordIds.has(record.id) ? "Removed from saved" : "Saved / following"}: ${record.organization}`);
      return;
    }
    if (action.trigger === "detail" && record) { openDetail(record.id); return; }
    if (action.id === "share" && record) {
      const url = `${location.origin}/exchange/${lens}/${record.id}`;
      try {
        if (navigator.share) await navigator.share({ title: record.title, text: record.summary, url });
        else { await navigator.clipboard.writeText(url); setActionNotice("Record link copied."); }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setActionNotice("Unable to share this record right now.");
      }
      return;
    }
    if (action.toggle && record) {
      if (action.toggle === "save") void toggleSaved(record.id);
      else {
        const key = actionKey(record, action);
        const next = !actionIsActive(record, action);
        setActionState((current) => ({ ...current, [key]: next }));
      }
      setActionNotice(`${action.label}: ${record.title}`);
    }
  }

  function resetMapView() { setMapView(createDefaultMapView()); setViewportDirty(false); }
  function locateViewer() {
    if (!("geolocation" in navigator)) { setGeolocationStatus("unavailable"); return; }
    setGeolocationStatus("requesting");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setViewerLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
        setGeolocationStatus("located");
      },
      (error) => setGeolocationStatus(error.code === 1 ? "denied" : "unavailable"),
      { timeout: 8000, maximumAge: 60000 },
    );
  }

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
    <ResultsDrawer state={drawer} onStateChange={setDrawer} lens={lens} lensLabel={definition.label} records={visibleRecords} totalAvailableCount={filteredRecords.length} selectedRecordId={selectedRecordId} actions={actions} activeActionIds={drawerActiveActionIds} onAction={(action) => { void handleAction(action, actionRecord); }} emptyMessage={definition.emptyMessage} resultContext={`${mapped} mapped · ${offMap} off-map`} query={drawerQuery} onQueryChange={(next) => setDrawerQueries((current) => ({ ...current, [lens]: next }))} onSelect={selectRecord} onOpen={openDetail} onToggleSave={(id) => { void toggleSaved(id); }} onOpenResourcesHierarchy={lens === "resources" ? () => setResourceNavigationOpen(true) : undefined} onReferResource={lens === "resources" ? referResource : undefined} />
    <BottomNav activeLens={lens} onLensChange={changeLens} onMenu={() => { setMenuInitialSection(undefined); setMenuOpen(true); }} />
    {detailRecord ? <DetailSurface record={detailRecord} actions={detailActions} activeActionIds={detailActiveActionIds} notes={intelligenceNotes[detailRecord.id] ?? []} onAction={(action) => { void handleAction(action, detailRecord); }} onReferResource={detailRecord.type === "resource" ? referResource : undefined} onClose={closeDetail} /> : null}
    {menuOpen ? <MenuSurface initialSectionId={menuInitialSection} onClose={() => { setMenuOpen(false); setMenuInitialSection(undefined); }} /> : null}
    {resourceNavigationOpen && lens === "resources" ? <ResourceNavigationSurface state={resourceNavigation} record={resourceContextRecord} onStateChange={setResourceNavigation} onAction={dispatchResourceNavigation} onClose={() => setResourceNavigationOpen(false)} /> : null}
    {resourceWorkflow ? <ResourceWorkflowSurface workflow={resourceWorkflow} record={resourceWorkflowRecord} onClose={() => setResourceWorkflow(undefined)} onRecordCommitted={commitResourceRecord} onRecordArchived={markResourceArchived} onRelationshipChanged={resourceRelationshipChanged} onComplete={setResourceNotice} onOpenReferralsManagement={openReferralsManagement} /> : null}
    {intelligenceWorkflow ? <IntelligenceWorkflowSurface workflow={intelligenceWorkflow.mode} record={intelligenceWorkflowRecord} records={allRecords} onClose={() => setIntelligenceWorkflow(undefined)} onCreate={createInsight} onUpdate={updateInsight} onAddNote={addIntelligenceNote} /> : null}
    {capabilityWorkflow && capabilityWorkflowProfile ? <CapabilityWorkflowSurface profile={capabilityWorkflowProfile} mode={capabilityWorkflow.mode} onClose={() => setCapabilityWorkflow(undefined)} /> : null}
    <ResourceNotice message={resourceNotice} />
    {actionNotice ? <div className={styles.actionNotice} role="status" aria-live="polite">{actionNotice}</div> : null}
  </main>;
}
