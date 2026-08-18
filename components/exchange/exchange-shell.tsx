"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  Coordinates,
  DrawerState,
  ExchangeFilters,
  ExchangeLens,
  ExchangeSearchState,
  GeolocationStatus,
  MapDisplayMode,
  MapViewState,
  RecentSearch,
  SavedSearch,
} from "@/lib/exchange/contracts";
import { exchangeSeed } from "@/lib/exchange/seed";
import { applyExchangeFilters, createExchangeFilters } from "@/lib/exchange/filter";
import { lensDefinitions, lensOrder } from "@/lib/exchange/lenses";
import { createDefaultMapView } from "@/lib/exchange/map-model";
import {
  activeFilterCount,
  defaultSearchState,
  getSearchSuggestions,
  searchExchangeRecords,
  searchStateFromParams,
  searchStateToParams,
  typeByLens,
} from "@/lib/exchange/search";
import { PersistentMap } from "./persistent-map";
import { SearchControls } from "./search-controls";
import { FloatingControls } from "./floating-controls";
import { ResultsDrawer } from "./results-drawer";
import { BottomNav } from "./bottom-nav";
import { DetailSurface } from "./detail-surface";
import { MenuSurface } from "./menu-surface";

const recentStorageKey = "rfxchange:recent-searches";
const savedStorageKey = "rfxchange:saved-searches";

function initialSearchStates() {
  return Object.fromEntries(lensOrder.map((lens) => [lens, defaultSearchState()])) as Record<ExchangeLens, ExchangeSearchState>;
}

function initialFloatingFilters(): Record<ExchangeLens, ExchangeFilters> {
  return Object.fromEntries(lensOrder.map((lens) => [lens, createExchangeFilters()])) as Record<ExchangeLens, ExchangeFilters>;
}

export function ExchangeShell({ initialLens = "rfx", initialRecordId }: { initialLens?: ExchangeLens; initialRecordId?: string }) {
  const [lens, setLens] = useState<ExchangeLens>(initialLens);
  const [searchByLens, setSearchByLens] = useState<Record<ExchangeLens, ExchangeSearchState>>(initialSearchStates);
  const [filtersByLens, setFiltersByLens] = useState<Record<ExchangeLens, ExchangeFilters>>(initialFloatingFilters);
  const [drawer, setDrawer] = useState<DrawerState>("mid");
  const [mapView, setMapView] = useState<MapViewState>(createDefaultMapView);
  const [selectedRecordId, setSelectedRecordId] = useState<string | undefined>(initialRecordId);
  const [detailRecordId, setDetailRecordId] = useState<string | undefined>(initialRecordId);
  const [menuOpen, setMenuOpen] = useState(false);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [geolocationStatus, setGeolocationStatus] = useState<GeolocationStatus>("idle");
  const [viewerLocation, setViewerLocation] = useState<Coordinates | undefined>();
  const [viewportDirty, setViewportDirty] = useState(false);

  const definition = lensDefinitions[lens];
  const searchState = searchByLens[lens];
  const floatingFilters = filtersByLens[lens];
  const searchResponse = useMemo(() => searchExchangeRecords(exchangeSeed, lens, searchState), [lens, searchState]);
  const searchRecords = useMemo(() => searchResponse.results.map((result) => result.record), [searchResponse]);
  const records = useMemo(() => applyExchangeFilters(searchRecords, floatingFilters), [searchRecords, floatingFilters]);
  const lensRecords = useMemo(() => exchangeSeed.filter((record) => record.type === typeByLens[lens]), [lens]);
  const suggestions = useMemo(() => getSearchSuggestions(exchangeSeed, lens, searchState.query), [lens, searchState.query]);
  const selectedRecord = exchangeSeed.find((record) => record.id === selectedRecordId);
  const detailRecord = exchangeSeed.find((record) => record.id === detailRecordId);
  const actionRecord = selectedRecord && records.some((record) => record.id === selectedRecord.id) ? selectedRecord : records[0];
  const actions = definition.actions(actionRecord);

  useEffect(() => {
    try {
      const recent = window.localStorage.getItem(recentStorageKey);
      const saved = window.localStorage.getItem(savedStorageKey);
      if (recent) setRecentSearches(JSON.parse(recent) as RecentSearch[]);
      if (saved) setSavedSearches(JSON.parse(saved) as SavedSearch[]);
    } catch {
      // Local discovery history is optional; the Exchange remains usable without storage access.
    }
  }, []);

  useEffect(() => {
    function syncFromUrl() {
      const parts = window.location.pathname.split("/").filter(Boolean);
      const urlLens = parts[1];
      if (urlLens === "rfx" || urlLens === "resources" || urlLens === "intelligence" || urlLens === "capabilities") {
        const urlState = searchStateFromParams(new URLSearchParams(window.location.search));
        setLens(urlLens);
        setSearchByLens((current) => ({ ...current, [urlLens]: urlState }));
        const recordId = parts[2];
        setSelectedRecordId(recordId);
        setDetailRecordId(recordId);
      }
    }
    syncFromUrl();
    window.addEventListener("popstate", syncFromUrl);
    return () => window.removeEventListener("popstate", syncFromUrl);
  }, []);

  useEffect(() => {
    if (selectedRecordId && !records.some((record) => record.id === selectedRecordId)) setSelectedRecordId(undefined);
  }, [records, selectedRecordId]);

  function persistRecent(next: RecentSearch[]) {
    setRecentSearches(next);
    try { window.localStorage.setItem(recentStorageKey, JSON.stringify(next)); } catch { /* optional storage */ }
  }

  function persistSaved(next: SavedSearch[]) {
    setSavedSearches(next);
    try { window.localStorage.setItem(savedStorageKey, JSON.stringify(next)); } catch { /* optional storage */ }
  }

  function setUrl(nextLens: ExchangeLens, recordId?: string, mode: "push" | "replace" = "replace", state = searchByLens[nextLens]) {
    const path = recordId ? `/exchange/${nextLens}/${recordId}` : `/exchange/${nextLens}`;
    const params = searchStateToParams(state).toString();
    const next = params ? `${path}?${params}` : path;
    if (mode === "push") window.history.pushState({}, "", next);
    else window.history.replaceState({}, "", next);
  }

  function updateSearchState(next: ExchangeSearchState) {
    setSearchByLens((current) => ({ ...current, [lens]: next }));
    setUrl(lens, detailRecordId, "replace", next);
  }

  function commitSearch(next: ExchangeSearchState) {
    updateSearchState(next);
    if (!next.query.trim() && activeFilterCount(next) === 0) return;
    const recent: RecentSearch = { id: `${lens}-${Date.now()}`, lens, state: next, createdAt: new Date().toISOString() };
    const deduped = recentSearches.filter((item) => item.lens !== lens || JSON.stringify(item.state) !== JSON.stringify(next));
    persistRecent([recent, ...deduped].slice(0, 12));
  }

  function runSearchState(next: ExchangeSearchState) {
    updateSearchState(next);
    commitSearch(next);
  }

  function saveCurrentSearch() {
    if (!searchState.query.trim() && activeFilterCount(searchState) === 0) return;
    const descriptor = searchState.query.trim() || searchState.filters.geography.trim() || "Discovery";
    const saved: SavedSearch = {
      id: `${lens}-${Date.now()}`,
      name: `${definition.label}: ${descriptor}`,
      lens,
      state: searchState,
      createdAt: new Date().toISOString(),
    };
    persistSaved([saved, ...savedSearches.filter((item) => item.lens !== lens || JSON.stringify(item.state) !== JSON.stringify(searchState))].slice(0, 20));
  }

  function changeLens(next: ExchangeLens) {
    const prior = searchByLens[next];
    const carried = prior.query.trim() ? prior : { ...prior, query: searchState.query };
    setLens(next);
    setSearchByLens((current) => ({ ...current, [next]: carried }));
    setSelectedRecordId(undefined);
    setDetailRecordId(undefined);
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

  function updateFloatingFilters(next: ExchangeFilters) {
    setFiltersByLens((current) => ({ ...current, [lens]: next }));
  }

  function resetMapView() {
    setMapView(createDefaultMapView());
    setViewportDirty(false);
  }

  function setMapDisplayMode(mode: MapDisplayMode) {
    setMapView((current) => ({ ...current, camera: { ...current.camera, mode, pitch: mode === "3d" ? 42 : 0 } }));
  }

  function locateViewer() {
    if (!("geolocation" in navigator)) {
      setGeolocationStatus("unavailable");
      return;
    }
    setGeolocationStatus("requesting");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setViewerLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
        setGeolocationStatus("located");
      },
      (error) => setGeolocationStatus(error.code === 1 ? "denied" : "unavailable"),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 },
    );
  }

  const lensRecent = recentSearches.filter((item) => item.lens === lens);
  const lensSaved = savedSearches.filter((item) => item.lens === lens);
  const mapped = records.filter((record) => record.location).length;
  const offMap = records.length - mapped;
  const resultContext = offMap > 0 ? `${records.length} results · ${mapped} mapped · ${offMap} off-map` : undefined;

  return (
    <main className="exchange-shell">
      <PersistentMap
        lens={lens}
        records={records}
        selectedRecordId={selectedRecordId}
        drawerState={drawer}
        view={mapView}
        viewerLocation={viewerLocation}
        onViewChange={(next) => { setMapView(next); setViewportDirty(true); }}
        onSelect={selectRecord}
      />
      <SearchControls
        state={searchState}
        placeholder={definition.searchPlaceholder}
        lensLabel={definition.label}
        suggestions={suggestions}
        recentSearches={lensRecent}
        savedSearches={lensSaved}
        onStateChange={updateSearchState}
        onCommit={commitSearch}
        onRunState={runSearchState}
        onSave={saveCurrentSearch}
      />
      <FloatingControls
        lens={lens}
        records={lensRecords}
        search={searchState.query}
        filters={floatingFilters}
        onFiltersChange={updateFloatingFilters}
        mapDisplayMode={mapView.camera.mode}
        onMapDisplayModeChange={setMapDisplayMode}
        geolocationStatus={geolocationStatus}
        onLocate={locateViewer}
        onResetView={resetMapView}
        searchAreaAvailable={viewportDirty}
        onSearchArea={() => setViewportDirty(false)}
      />
      <ResultsDrawer state={drawer} onStateChange={setDrawer} lensLabel={definition.label} records={records} selectedRecordId={selectedRecordId} actions={actions} emptyMessage={definition.emptyMessage} resultContext={resultContext} onSelect={selectRecord} onOpen={openDetail} />
      <BottomNav activeLens={lens} onLensChange={changeLens} onMenu={() => setMenuOpen(true)} />
      {detailRecord ? <DetailSurface record={detailRecord} actions={definition.actions(detailRecord)} onClose={closeDetail} /> : null}
      {menuOpen ? <MenuSurface onClose={() => setMenuOpen(false)} /> : null}
    </main>
  );
}
