"use client";

import { useEffect, useMemo, useState } from "react";
import type { Coordinates, DrawerQueryState, DrawerState, ExchangeFilters, ExchangeLens, ExchangeRecord, ExchangeSearchState, GeolocationStatus, LensAction, MapDisplayMode, MapViewState, RecentSearch, SavedSearch } from "@/lib/exchange/contracts";
import { exchangeSeed } from "@/lib/exchange/seed";
import { applyExchangeFilters, createExchangeFilters } from "@/lib/exchange/filter";
import { applyDrawerQuery, createDefaultDrawerQuery } from "@/lib/exchange/drawer";
import { lensDefinitions, lensOrder } from "@/lib/exchange/lenses";
import { createDefaultMapView } from "@/lib/exchange/map-model";
import { activeFilterCount, defaultSearchState, getSearchSuggestions, searchExchangeRecords, searchStateFromParams, searchStateToParams, typeByLens } from "@/lib/exchange/search";
import { PersistentMap } from "./persistent-map";
import { SearchControls } from "./search-controls";
import { FloatingControls } from "./floating-controls";
import { ResultsDrawer } from "./results-drawer";
import { BottomNav } from "./bottom-nav";
import { DetailSurface } from "./detail-surface";
import { MenuSurface } from "./menu-surface";
import styles from "./exchange-shell.module.css";

const recentStorageKey = "rfxchange:recent-searches";
const savedStorageKey = "rfxchange:saved-searches";
const initialSavedRecordIds = exchangeSeed.filter((record) => record.saved).map((record) => record.id);
const initialSearchStates = () => Object.fromEntries(lensOrder.map((lens) => [lens, defaultSearchState()])) as Record<ExchangeLens, ExchangeSearchState>;
const initialFloatingFilters = () => Object.fromEntries(lensOrder.map((lens) => [lens, createExchangeFilters()])) as Record<ExchangeLens, ExchangeFilters>;
const initialDrawerQueries = () => Object.fromEntries(lensOrder.map((lens) => [lens, createDefaultDrawerQuery()])) as Record<ExchangeLens, DrawerQueryState>;

export function ExchangeShell({ initialLens = "rfx", initialRecordId }: { initialLens?: ExchangeLens; initialRecordId?: string }) {
  const [lens, setLens] = useState<ExchangeLens>(initialLens);
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
  const [geolocationStatus, setGeolocationStatus] = useState<GeolocationStatus>("idle");
  const [viewerLocation, setViewerLocation] = useState<Coordinates | undefined>();
  const [viewportDirty, setViewportDirty] = useState(false);

  const allRecords = useMemo(() => exchangeSeed.map((record) => ({ ...record, saved: savedRecordIds.has(record.id) })), [savedRecordIds]);
  const definition = lensDefinitions[lens]; const searchState = searchByLens[lens]; const floatingFilters = filtersByLens[lens]; const drawerQuery = drawerQueries[lens];
  const searchResponse = useMemo(() => searchExchangeRecords(allRecords, lens, searchState), [allRecords, lens, searchState]);
  const searchRecords = useMemo(() => searchResponse.results.map((result) => result.record), [searchResponse]);
  const filteredRecords = useMemo(() => applyExchangeFilters(searchRecords, floatingFilters), [searchRecords, floatingFilters]);
  const records = useMemo(() => applyDrawerQuery(filteredRecords, drawerQuery), [filteredRecords, drawerQuery]);
  const lensRecords = useMemo(() => allRecords.filter((record) => record.type === typeByLens[lens]), [allRecords, lens]);
  const suggestions = useMemo(() => getSearchSuggestions(allRecords, lens, searchState.query), [allRecords, lens, searchState.query]);
  const selectedRecord = allRecords.find((record) => record.id === selectedRecordId); const detailRecord = allRecords.find((record) => record.id === detailRecordId);
  const actionRecord = selectedRecord && records.some((record) => record.id === selectedRecord.id) ? selectedRecord : records[0]; const actions = definition.actions(actionRecord);

  useEffect(() => { try { const recent = localStorage.getItem(recentStorageKey); const saved = localStorage.getItem(savedStorageKey); if (recent) setRecentSearches(JSON.parse(recent)); if (saved) setSavedSearches(JSON.parse(saved)); } catch {} }, []);
  useEffect(() => { function syncFromUrl() { const parts = location.pathname.split("/").filter(Boolean); const urlLens = parts[1]; if (urlLens === "rfx" || urlLens === "resources" || urlLens === "intelligence" || urlLens === "capabilities") { const urlState = searchStateFromParams(new URLSearchParams(location.search)); setLens(urlLens); setSearchByLens((current) => ({ ...current, [urlLens]: urlState })); const recordId = parts[2]; setSelectedRecordId(recordId); setDetailRecordId(recordId); } } syncFromUrl(); addEventListener("popstate", syncFromUrl); return () => removeEventListener("popstate", syncFromUrl); }, []);
  useEffect(() => { if (selectedRecordId && !records.some((record) => record.id === selectedRecordId)) setSelectedRecordId(undefined); }, [records, selectedRecordId]);
  useEffect(() => { if (!actionNotice) return; const timeout = setTimeout(() => setActionNotice(""), 2200); return () => clearTimeout(timeout); }, [actionNotice]);

  function persistRecent(next: RecentSearch[]) { setRecentSearches(next); try { localStorage.setItem(recentStorageKey, JSON.stringify(next)); } catch {} }
  function persistSaved(next: SavedSearch[]) { setSavedSearches(next); try { localStorage.setItem(savedStorageKey, JSON.stringify(next)); } catch {} }
  function setUrl(nextLens: ExchangeLens, recordId?: string, mode: "push" | "replace" = "replace", state = searchByLens[nextLens]) { const path = recordId ? `/exchange/${nextLens}/${recordId}` : `/exchange/${nextLens}`; const params = searchStateToParams(state).toString(); const next = params ? `${path}?${params}` : path; history[mode === "push" ? "pushState" : "replaceState"]({}, "", next); }
  function updateSearchState(next: ExchangeSearchState) { setSearchByLens((current) => ({ ...current, [lens]: next })); setUrl(lens, detailRecordId, "replace", next); }
  function commitSearch(next: ExchangeSearchState) { updateSearchState(next); if (!next.query.trim() && activeFilterCount(next) === 0) return; const recent: RecentSearch = { id: `${lens}-${Date.now()}`, lens, state: next, createdAt: new Date().toISOString() }; persistRecent([recent, ...recentSearches.filter((item) => item.lens !== lens || JSON.stringify(item.state) !== JSON.stringify(next))].slice(0, 12)); }
  function saveCurrentSearch() { if (!searchState.query.trim() && activeFilterCount(searchState) === 0) return; const descriptor = searchState.query.trim() || searchState.filters.geography.trim() || "Discovery"; const saved: SavedSearch = { id: `${lens}-${Date.now()}`, name: `${definition.label}: ${descriptor}`, lens, state: searchState, createdAt: new Date().toISOString() }; persistSaved([saved, ...savedSearches.filter((item) => item.lens !== lens || JSON.stringify(item.state) !== JSON.stringify(searchState))].slice(0, 20)); }
  function changeLens(next: ExchangeLens) { const prior = searchByLens[next]; const carried = prior.query.trim() ? prior : { ...prior, query: searchState.query }; setLens(next); setSearchByLens((current) => ({ ...current, [next]: carried })); setSelectedRecordId(undefined); setDetailRecordId(undefined); setActionNotice(""); setUrl(next, undefined, "replace", carried); }
  function selectRecord(id: string) { setSelectedRecordId(id); if (drawer === "peek") setDrawer("mid"); }
  function openDetail(id: string) { setSelectedRecordId(id); setDetailRecordId(id); setUrl(lens, id, "push", searchState); }
  function closeDetail() { setDetailRecordId(undefined); setUrl(lens, undefined, "replace", searchState); }
  function toggleSaved(id: string) { setSavedRecordIds((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; }); }
  function actionKey(record: ExchangeRecord, action: LensAction) { return `${record.id}:${action.id}`; }
  function actionIsActive(record: ExchangeRecord | undefined, action: LensAction) { if (!record || !action.toggle) return false; if (action.toggle === "save") return savedRecordIds.has(record.id); const key = actionKey(record, action); return actionState[key] ?? false; }
  function activeActionIds(record: ExchangeRecord | undefined, resolved: LensAction[]) { return resolved.filter((action) => actionIsActive(record, action)).map((action) => action.id); }
  async function handleAction(action: LensAction, record?: ExchangeRecord) {
    if (action.requiresRecord && !record) return;
    if (action.trigger === "detail" && record) { openDetail(record.id); return; }
    if (action.id === "share" && record) { const url = `${location.origin}/exchange/${lens}/${record.id}`; try { if (navigator.share) await navigator.share({ title: record.title, text: record.summary, url }); else { await navigator.clipboard.writeText(url); setActionNotice("Record link copied."); } } catch (error) { if (error instanceof DOMException && error.name === "AbortError") return; setActionNotice("Unable to share this record right now."); } return; }
    if (action.toggle && record) { if (action.toggle === "save") toggleSaved(record.id); else { const key = actionKey(record, action); const next = !actionIsActive(record, action); setActionState((current) => ({ ...current, [key]: next })); } setActionNotice(`${action.label}: ${record.title}`); }
  }
  function resetMapView() { setMapView(createDefaultMapView()); setViewportDirty(false); }
  function locateViewer() { if (!("geolocation" in navigator)) { setGeolocationStatus("unavailable"); return; } setGeolocationStatus("requesting"); navigator.geolocation.getCurrentPosition((position) => { setViewerLocation({ lat: position.coords.latitude, lng: position.coords.longitude }); setGeolocationStatus("located"); }, (error) => setGeolocationStatus(error.code === 1 ? "denied" : "unavailable"), { timeout: 8000, maximumAge: 60000 }); }

  const lensRecent = recentSearches.filter((item) => item.lens === lens); const lensSaved = savedSearches.filter((item) => item.lens === lens); const mapped = records.filter((record) => record.location).length; const offMap = records.length - mapped;
  const drawerActiveActionIds = activeActionIds(actionRecord, actions); const detailActions = detailRecord ? definition.actions(detailRecord) : []; const detailActiveActionIds = activeActionIds(detailRecord, detailActions);

  return <main className="exchange-shell">
    <PersistentMap lens={lens} records={records} selectedRecordId={selectedRecordId} drawerState={drawer} view={mapView} viewerLocation={viewerLocation} onViewChange={(next) => { setMapView(next); setViewportDirty(true); }} onSelect={selectRecord} />
    <SearchControls state={searchState} placeholder={definition.searchPlaceholder} lensLabel={definition.label} suggestions={suggestions} recentSearches={lensRecent} savedSearches={lensSaved} onStateChange={updateSearchState} onCommit={commitSearch} onRunState={(next) => { updateSearchState(next); commitSearch(next); }} onSave={saveCurrentSearch} />
    <FloatingControls lens={lens} records={lensRecords} search={searchState.query} filters={floatingFilters} onFiltersChange={(next) => setFiltersByLens((current) => ({ ...current, [lens]: next }))} mapDisplayMode={mapView.camera.mode} onMapDisplayModeChange={(mode: MapDisplayMode) => setMapView((current) => ({ ...current, camera: { ...current.camera, mode, pitch: mode === "3d" ? 42 : 0 } }))} geolocationStatus={geolocationStatus} onLocate={locateViewer} onResetView={resetMapView} searchAreaAvailable={viewportDirty} onSearchArea={() => setViewportDirty(false)} />
    <ResultsDrawer state={drawer} onStateChange={setDrawer} lens={lens} lensLabel={definition.label} records={records} totalAvailableCount={filteredRecords.length} selectedRecordId={selectedRecordId} actions={actions} activeActionIds={drawerActiveActionIds} onAction={(action) => { void handleAction(action, actionRecord); }} emptyMessage={definition.emptyMessage} resultContext={`${mapped} mapped · ${offMap} off-map`} query={drawerQuery} onQueryChange={(next) => setDrawerQueries((current) => ({ ...current, [lens]: next }))} onSelect={selectRecord} onOpen={openDetail} onToggleSave={toggleSaved} />
    <BottomNav activeLens={lens} onLensChange={changeLens} onMenu={() => setMenuOpen(true)} />
    {detailRecord ? <DetailSurface record={detailRecord} actions={detailActions} activeActionIds={detailActiveActionIds} onAction={(action) => { void handleAction(action, detailRecord); }} onClose={closeDetail} /> : null}
    {menuOpen ? <MenuSurface onClose={() => setMenuOpen(false)} /> : null}
    {actionNotice ? <div className={styles.actionNotice} role="status" aria-live="polite">{actionNotice}</div> : null}
  </main>;
}
