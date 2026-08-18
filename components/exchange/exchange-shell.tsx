"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  DrawerState,
  ExchangeLens,
  ExchangeSearchState,
  RecentSearch,
  SavedSearch,
} from "@/lib/exchange/contracts";
import { exchangeSeed } from "@/lib/exchange/seed";
import { lensDefinitions, lensOrder } from "@/lib/exchange/lenses";
import {
  activeFilterCount,
  defaultSearchState,
  getSearchSuggestions,
  searchExchangeRecords,
  searchStateFromParams,
  searchStateToParams,
} from "@/lib/exchange/search";
import { MapCanvas } from "./map-canvas";
import { SearchControls } from "./search-controls";
import { ResultsDrawer } from "./results-drawer";
import { BottomNav } from "./bottom-nav";
import { DetailSurface } from "./detail-surface";
import { MenuSurface } from "./menu-surface";

const recentStorageKey = "rfxchange:recent-searches";
const savedStorageKey = "rfxchange:saved-searches";

function initialSearchStates() {
  return Object.fromEntries(lensOrder.map((lens) => [lens, defaultSearchState()])) as Record<ExchangeLens, ExchangeSearchState>;
}

export function ExchangeShell({ initialLens = "rfx", initialRecordId }: { initialLens?: ExchangeLens; initialRecordId?: string }) {
  const [lens, setLens] = useState<ExchangeLens>(initialLens);
  const [searchByLens, setSearchByLens] = useState<Record<ExchangeLens, ExchangeSearchState>>(initialSearchStates);
  const [drawer, setDrawer] = useState<DrawerState>("mid");
  const [selectedRecordId, setSelectedRecordId] = useState<string | undefined>(initialRecordId);
  const [detailRecordId, setDetailRecordId] = useState<string | undefined>(initialRecordId);
  const [menuOpen, setMenuOpen] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);

  const definition = lensDefinitions[lens];
  const searchState = searchByLens[lens];
  const searchResponse = useMemo(() => searchExchangeRecords(exchangeSeed, lens, searchState), [lens, searchState]);
  const records = useMemo(() => searchResponse.results.map((result) => result.record), [searchResponse]);
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

  function openDetail(id: string) {
    setSelectedRecordId(id);
    setDetailRecordId(id);
    setUrl(lens, id, "push", searchState);
  }

  function closeDetail() {
    setDetailRecordId(undefined);
    setUrl(lens, undefined, "replace", searchState);
  }

  const lensRecent = recentSearches.filter((item) => item.lens === lens);
  const lensSaved = savedSearches.filter((item) => item.lens === lens);
  const resultContext = searchResponse.offMap > 0 ? `${searchResponse.total} results · ${searchResponse.mapped} mapped · ${searchResponse.offMap} off-map` : undefined;

  return (
    <main className="exchange-shell">
      <MapCanvas records={records} selectedRecordId={selectedRecordId} onSelect={(id) => { setSelectedRecordId(id); if (drawer === "peek") setDrawer("mid"); }} resetKey={resetKey} />
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
        onResetView={() => setResetKey((value) => value + 1)}
      />
      <ResultsDrawer state={drawer} onStateChange={setDrawer} lensLabel={definition.label} records={records} selectedRecordId={selectedRecordId} actions={actions} emptyMessage={definition.emptyMessage} resultContext={resultContext} onSelect={setSelectedRecordId} onOpen={openDetail} />
      <BottomNav activeLens={lens} onLensChange={changeLens} onMenu={() => setMenuOpen(true)} />
      {detailRecord ? <DetailSurface record={detailRecord} actions={definition.actions(detailRecord)} onClose={closeDetail} /> : null}
      {menuOpen ? <MenuSurface onClose={() => setMenuOpen(false)} /> : null}
    </main>
  );
}
