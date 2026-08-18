"use client";

import { useMemo, useState } from "react";
import type {
  DrawerResultStatus,
  ExchangeLens,
  ExchangeSearchState,
  MapBounds,
  Coordinates,
  RecentSearch,
  SavedSearch,
  SearchNavigationNode,
  SearchNavigationState,
  SearchSuggestion,
  SearchWorkflowNodeId,
} from "@/lib/exchange/contracts";
import { activeFilterCount, createDefaultSearchFilters } from "@/lib/exchange/search";
import { findSearchNavigationNode, getSearchNavigationTree, lensSearchFacetDefinitions } from "@/lib/exchange/search-navigation";
import styles from "./search-controls.module.css";

function leafState(state: ExchangeSearchState, filters: Partial<ExchangeSearchState["filters"]>) {
  return { ...state, filters: { ...state.filters, ...filters } };
}

function commaValues(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

export function SearchControls({
  lens,
  state,
  placeholder,
  lensLabel,
  suggestions,
  recentSearches,
  savedSearches,
  searchStatus,
  serviceMode,
  libraryNotice,
  mapCenter,
  mapBounds,
  exchangeGeography,
  onStateChange,
  onCommit,
  onRunState,
  onSave,
  onUpdateSaved,
  onDeleteSaved,
}: {
  lens: ExchangeLens;
  state: ExchangeSearchState;
  placeholder: string;
  lensLabel: string;
  suggestions: SearchSuggestion[];
  recentSearches: RecentSearch[];
  savedSearches: SavedSearch[];
  searchStatus: DrawerResultStatus;
  serviceMode: "live" | "preview" | "unavailable";
  libraryNotice?: string;
  mapCenter: Coordinates;
  mapBounds: MapBounds;
  exchangeGeography: string;
  onStateChange: (state: ExchangeSearchState) => void;
  onCommit: (state: ExchangeSearchState) => void;
  onRunState: (state: ExchangeSearchState) => void;
  onSave: (name?: string, sourceState?: ExchangeSearchState) => Promise<void> | void;
  onUpdateSaved: (id: string, patch: { name?: string; state?: ExchangeSearchState; alertEnabled?: boolean }) => Promise<void> | void;
  onDeleteSaved: (id: string) => Promise<void> | void;
}) {
  const tree = useMemo(() => getSearchNavigationTree(lens), [lens]);
  const [open, setOpen] = useState(false);
  const [nav, setNav] = useState<SearchNavigationState>({ path: ["root"] });
  const [savedName, setSavedName] = useState("");
  const [newName, setNewName] = useState("");
  const currentId = nav.path[nav.path.length - 1] ?? "root";
  const currentNode = findSearchNavigationNode(tree, currentId);
  const selectedSaved = savedSearches.find((item) => item.id === nav.selectedSavedId);
  const selectedRecent = recentSearches.find((item) => item.id === nav.selectedRecentId);
  const editingSaved = nav.selectedSavedId ? selectedSaved : undefined;
  const filterCount = activeFilterCount(state);

  function patch(next: Partial<ExchangeSearchState>) {
    onStateChange({ ...state, ...next });
  }

  function patchFilters(next: Partial<ExchangeSearchState["filters"]>) {
    onStateChange({ ...state, filters: { ...state.filters, ...next } });
  }

  function navigate(id: SearchWorkflowNodeId, selection?: { savedId?: string; recentId?: string }) {
    setNav((current) => ({
      path: id === "root" ? ["root"] : [...current.path, id],
      selectedSavedId: selection?.savedId ?? current.selectedSavedId,
      selectedRecentId: selection?.recentId ?? current.selectedRecentId,
    }));
  }

  function back() {
    setNav((current) => {
      if (current.path.length <= 1) return { path: ["root"] };
      const path = current.path.slice(0, -1);
      const nextId = path[path.length - 1];
      return {
        path,
        selectedSavedId: nextId === "saved-detail" ? current.selectedSavedId : path.includes("saved-detail") ? current.selectedSavedId : undefined,
        selectedRecentId: nextId === "recent-detail" ? current.selectedRecentId : path.includes("recent-detail") ? current.selectedRecentId : undefined,
      };
    });
  }

  function openRoot() {
    setOpen(true);
    setNav({ path: ["root"] });
  }

  function openSuggestions() {
    setOpen(true);
    setNav({ path: ["root", "discover", "suggestions"] });
  }

  function closePanel() {
    setOpen(false);
    setNav({ path: ["root"] });
  }

  function runSuggestion(suggestion: SearchSuggestion) {
    const next = { ...state, query: suggestion.query };
    onStateChange(next);
    onCommit(next);
    closePanel();
  }

  function renderNodeList(node: SearchNavigationNode) {
    return (
      <div className={styles.treeList}>
        {(node.children ?? []).map((child) => (
          <button className={styles.treeRow} key={child.id} type="button" onClick={() => navigate(child.id)}>
            <span><strong>{child.label}</strong><small>{child.description}</small></span><b aria-hidden>›</b>
          </button>
        ))}
      </div>
    );
  }

  function saveEditingCriteria() {
    if (!editingSaved) return;
    void onUpdateSaved(editingSaved.id, { state });
  }

  function renderLeaf(id: SearchWorkflowNodeId) {
    if (id === "suggestions") {
      return <div className={styles.section}>{suggestions.length ? suggestions.map((suggestion) => (
        <button className={styles.option} key={suggestion.id} type="button" onClick={() => runSuggestion(suggestion)}>
          <span className={styles.kind}>{suggestion.kind}</span><span><strong>{suggestion.label}</strong><small>{suggestion.description}</small></span>
        </button>
      )) : <p className={styles.empty}>{state.query.trim() ? `No suggestions yet. Press Enter to search for “${state.query}”.` : "Start typing to see suggestions for this lens."}</p>}</div>;
    }

    if (id === "recent") {
      return <div className={styles.section}>{recentSearches.length ? recentSearches.map((recent) => (
        <button className={`${styles.option} ${styles.compact}`} key={recent.id} type="button" onClick={() => navigate("recent-detail", { recentId: recent.id })}>
          <span className={styles.kind}>↺</span><span><strong>{recent.state.query || "Browse all"}</strong><small>{recent.state.filters.geography || "Current Exchange geography"}</small></span>
        </button>
      )) : <p className={styles.empty}>No recent searches are available for {lensLabel}.</p>}</div>;
    }

    if (id === "recent-detail") {
      if (!selectedRecent) return <p className={styles.empty}>That recent search is no longer available.</p>;
      return <div className={styles.formStack}>
        <div className={styles.summaryCard}><strong>{selectedRecent.state.query || "Browse all"}</strong><small>{selectedRecent.state.filters.geography || "Current Exchange geography"}</small></div>
        <button className={styles.primaryAction} type="button" onClick={() => { onRunState(selectedRecent.state); closePanel(); }}>Run this search</button>
        <label>Save as<input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder={`${lensLabel}: ${selectedRecent.state.query || "Discovery"}`} /></label>
        <button type="button" onClick={() => { void onSave(newName.trim() || undefined, selectedRecent.state); setNewName(""); }}>Save search</button>
      </div>;
    }

    if (id === "saved") {
      return <div className={styles.section}>{savedSearches.length ? savedSearches.map((saved) => (
        <button className={`${styles.option} ${styles.compact}`} key={saved.id} type="button" onClick={() => { setSavedName(saved.name); navigate("saved-detail", { savedId: saved.id }); }}>
          <span className={styles.kind}>☆</span><span><strong>{saved.name}</strong><small>{saved.alertEnabled ? "Alerts on" : saved.state.query || "Browse all"}</small></span>
        </button>
      )) : <p className={styles.empty}>{libraryNotice ?? `No saved searches are available for ${lensLabel}.`}</p>}</div>;
    }

    if (id === "saved-detail") {
      if (!selectedSaved) return <p className={styles.empty}>That saved search is no longer available.</p>;
      return <div className={styles.formStack}>
        <label>Name<input value={savedName} onChange={(event) => setSavedName(event.target.value)} /></label>
        <div className={styles.inlineActions}><button type="button" onClick={() => { void onUpdateSaved(selectedSaved.id, { name: savedName }); }}>Rename</button><button className={styles.primaryAction} type="button" onClick={() => { onRunState(selectedSaved.state); closePanel(); }}>Run</button></div>
        <button type="button" onClick={() => { onStateChange(selectedSaved.state); setNav((current) => ({ ...current, path: ["root", "refine"] })); }}>Edit criteria</button>
        <label className={styles.toggleRow}><input type="checkbox" checked={selectedSaved.alertEnabled} onChange={(event) => { void onUpdateSaved(selectedSaved.id, { alertEnabled: event.target.checked }); }} />Alert on new or changed results</label>
        <button className={styles.dangerAction} type="button" onClick={() => { void onDeleteSaved(selectedSaved.id); setNav({ path: ["root", "discover", "saved"] }); }}>Delete saved search</button>
      </div>;
    }

    if (id === "shared-filters") {
      return <div className={styles.formStack}>
        <label>Map presence<select value={state.filters.location} onChange={(event) => patchFilters({ location: event.target.value as ExchangeSearchState["filters"]["location"] })}><option value="all">All records</option><option value="mapped">Mapped</option><option value="off-map">Off-map</option></select></label>
        <label>Organization relationship<select value={state.filters.ownership} onChange={(event) => patchFilters({ ownership: event.target.value as ExchangeSearchState["filters"]["ownership"] })}><option value="all">All organizations</option><option value="mine">My organization</option><option value="others">Other organizations</option></select></label>
        <label>Shared metadata<input value={state.filters.metadata.join(", ")} onChange={(event) => patchFilters({ metadata: commaValues(event.target.value) })} placeholder="Comma-separated facets" /></label>
        <button type="button" onClick={() => patchFilters({ location: "all", ownership: "all", metadata: [] })}>Clear shared filters</button>
        {editingSaved ? <button className={styles.primaryAction} type="button" onClick={saveEditingCriteria}>Update saved search</button> : null}
      </div>;
    }

    if (id === "lens-filters") {
      return <div className={styles.formStack}>{lensSearchFacetDefinitions[lens].map((facet) => (
        <label key={facet.key}>{facet.label}<small>{facet.description}</small><input value={(state.filters.facets[facet.key] ?? []).join(", ")} onChange={(event) => patchFilters({ facets: { ...state.filters.facets, [facet.key]: commaValues(event.target.value) } })} placeholder="Comma-separated values" /></label>
      ))}{editingSaved ? <button className={styles.primaryAction} type="button" onClick={saveEditingCriteria}>Update saved search</button> : null}</div>;
    }

    if (id === "exchange-geography") {
      return <div className={styles.formStack}><p className={styles.help}>Use the Exchange geography already governing this view.</p><button className={styles.primaryAction} type="button" onClick={() => { const next = leafState(state, { geographyMode: "exchange", geography: exchangeGeography, center: undefined, bounds: undefined, radiusMiles: undefined }); onStateChange(next); onCommit(next); }}>Use {exchangeGeography}</button>{editingSaved ? <button type="button" onClick={saveEditingCriteria}>Update saved search</button> : null}</div>;
    }

    if (id === "place") {
      return <div className={styles.formStack}><label>City, county, state, ZIP, or locality<input value={state.filters.geography} onChange={(event) => patchFilters({ geography: event.target.value, geographyMode: "place", center: undefined, bounds: undefined, radiusMiles: undefined })} placeholder="Norfolk, VA" /></label><button className={styles.primaryAction} type="button" onClick={() => onCommit(state)}>Search place</button>{editingSaved ? <button type="button" onClick={saveEditingCriteria}>Update saved search</button> : null}</div>;
    }

    if (id === "radius") {
      return <div className={styles.formStack}><label>Radius in miles<input type="number" min="1" max="500" value={state.filters.radiusMiles ?? 25} onChange={(event) => patchFilters({ geographyMode: "radius", radiusMiles: Math.max(1, Number(event.target.value) || 25), center: mapCenter, bounds: undefined })} /></label><p className={styles.help}>Center: {mapCenter.lat.toFixed(3)}, {mapCenter.lng.toFixed(3)}</p><button className={styles.primaryAction} type="button" onClick={() => { const next = leafState(state, { geographyMode: "radius", center: mapCenter, radiusMiles: state.filters.radiusMiles ?? 25, bounds: undefined }); onStateChange(next); onCommit(next); }}>Search radius</button>{editingSaved ? <button type="button" onClick={saveEditingCriteria}>Update saved search</button> : null}</div>;
    }

    if (id === "viewport") {
      return <div className={styles.formStack}><p className={styles.help}>Use the current visible map bounds as the query geography.</p><button className={styles.primaryAction} type="button" onClick={() => { const next = leafState(state, { geographyMode: "viewport", bounds: mapBounds, center: undefined, radiusMiles: undefined }); onStateChange(next); onCommit(next); }}>Search current map area</button>{editingSaved ? <button type="button" onClick={saveEditingCriteria}>Update saved search</button> : null}</div>;
    }

    if (id === "service-area" || id === "performance-area") {
      const service = id === "service-area";
      return <div className={styles.formStack}><p className={styles.help}>{service ? "Find service areas covering the current map center." : "Find RFx performance areas covering the current map center."}</p><button className={styles.primaryAction} type="button" onClick={() => { const next = leafState(state, { geographyMode: id, center: mapCenter, bounds: undefined, radiusMiles: undefined }); onStateChange(next); onCommit(next); }}>{service ? "Search service geography" : "Search performance geography"}</button>{editingSaved ? <button type="button" onClick={saveEditingCriteria}>Update saved search</button> : null}</div>;
    }

    if (id === "sort") {
      return <div className={styles.formStack}><label>Sort results<select value={state.sort} onChange={(event) => patch({ sort: event.target.value as ExchangeSearchState["sort"] })}><option value="relevance">Best match</option><option value="recent">Most recent</option><option value="title">Title</option><option value="geography">Geography</option></select></label>{editingSaved ? <button className={styles.primaryAction} type="button" onClick={saveEditingCriteria}>Update saved search</button> : null}</div>;
    }

    return currentNode ? renderNodeList(currentNode) : <p className={styles.empty}>This search workflow is unavailable.</p>;
  }

  const statusText = serviceMode === "preview" ? "Static preview" : serviceMode === "unavailable" ? "Search service unavailable" : searchStatus === "loading" ? "Searching…" : searchStatus === "refreshing" ? "Refreshing…" : "Live search";

  return (
    <div className="floating-controls search-controls" onKeyDown={(event) => { if (event.key === "Escape") closePanel(); }}>
      <form className="search-surface" role="search" onSubmit={(event) => { event.preventDefault(); onCommit(state); closePanel(); }}>
        <button className={styles.scopeButton} type="button" onClick={openRoot} aria-label="Open Universal Search workflows" aria-expanded={open}>⌕</button>
        <label className="sr-only" htmlFor="exchange-universal-search">Search {lensLabel}</label>
        <input id="exchange-universal-search" value={state.query} onChange={(event) => { patch({ query: event.target.value }); openSuggestions(); }} onFocus={() => state.query.trim() ? openSuggestions() : openRoot()} placeholder={placeholder} autoComplete="off" aria-autocomplete="list" aria-expanded={open} aria-controls="exchange-search-navigation" />
        {state.query ? <button aria-label="Clear search" className="inline-clear" onClick={() => patch({ query: "" })} type="button">×</button> : null}
        {filterCount ? <button className={styles.filterBadge} type="button" onClick={() => { setOpen(true); setNav({ path: ["root", "refine"] }); }} aria-label={`${filterCount} active search refinements`}>{filterCount}</button> : null}
      </form>

      {open ? <section className={styles.panel} id="exchange-search-navigation" aria-label="Universal Search navigation">
        <header className={styles.panelHeader}>
          <div>{nav.path.length > 1 ? <button className={styles.backButton} type="button" onClick={back}>‹ Back</button> : null}<strong>{currentId === "saved-detail" ? selectedSaved?.name ?? "Saved search" : currentId === "recent-detail" ? "Recent search" : currentNode?.label ?? "Universal Search"}</strong><small>{statusText}</small></div>
          <button className={styles.closeButton} type="button" onClick={closePanel} aria-label="Close search navigation">×</button>
        </header>
        {libraryNotice ? <p className={styles.notice}>{libraryNotice}</p> : null}
        {currentId === "root" && (state.query.trim() || filterCount) ? <div className={styles.quickSave}><span><strong>Current search</strong><small>{state.query.trim() || `${filterCount} refinements`}</small></span><button type="button" onClick={() => { void onSave(); }}>Save</button></div> : null}
        {currentNode?.description && currentId !== "root" ? <p className={styles.nodeDescription}>{currentNode.description}</p> : null}
        {renderLeaf(currentId)}
        <footer className={styles.panelFooter}><button type="button" onClick={() => { const next = { query: state.query, filters: createDefaultSearchFilters(), sort: "relevance" as const }; onStateChange(next); onCommit(next); }}>Reset refinements</button><span>{lensLabel}</span></footer>
      </section> : null}
    </div>
  );
}
