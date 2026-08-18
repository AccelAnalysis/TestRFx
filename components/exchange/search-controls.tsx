"use client";

import { useState } from "react";
import type { ExchangeSearchState, RecentSearch, SavedSearch, SearchSuggestion } from "@/lib/exchange/contracts";
import { activeFilterCount } from "@/lib/exchange/search";
import styles from "./search-controls.module.css";

export function SearchControls({
  state,
  placeholder,
  lensLabel,
  suggestions,
  recentSearches,
  savedSearches,
  onStateChange,
  onCommit,
  onRunState,
  onSave,
  onResetView,
}: {
  state: ExchangeSearchState;
  placeholder: string;
  lensLabel: string;
  suggestions: SearchSuggestion[];
  recentSearches: RecentSearch[];
  savedSearches: SavedSearch[];
  onStateChange: (state: ExchangeSearchState) => void;
  onCommit: (state: ExchangeSearchState) => void;
  onRunState: (state: ExchangeSearchState) => void;
  onSave: () => void;
  onResetView: () => void;
}) {
  const [panel, setPanel] = useState<"discover" | "filters" | null>(null);
  const filterCount = activeFilterCount(state);

  function patch(next: Partial<ExchangeSearchState>) {
    onStateChange({ ...state, ...next });
  }

  function patchFilters(next: Partial<ExchangeSearchState["filters"]>) {
    onStateChange({ ...state, filters: { ...state.filters, ...next } });
  }

  function runSuggestion(suggestion: SearchSuggestion) {
    const next = { ...state, query: suggestion.query };
    onStateChange(next);
    onCommit(next);
    setPanel(null);
  }

  return (
    <div className="floating-controls search-controls" onKeyDown={(event) => { if (event.key === "Escape") setPanel(null); }}>
      <form
        className="search-surface"
        role="search"
        onSubmit={(event) => { event.preventDefault(); onCommit(state); setPanel(null); }}
      >
        <span aria-hidden>⌕</span>
        <label className="sr-only" htmlFor="exchange-universal-search">Search {lensLabel}</label>
        <input
          id="exchange-universal-search"
          value={state.query}
          onChange={(event) => patch({ query: event.target.value })}
          onFocus={() => setPanel("discover")}
          placeholder={placeholder}
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={panel === "discover"}
          aria-controls="exchange-search-discovery"
        />
        {state.query ? (
          <button aria-label="Clear search" className="inline-clear" onClick={() => patch({ query: "" })} type="button">×</button>
        ) : null}
      </form>
      <button
        className={`glass-button ${filterCount ? styles.filterActive : ""}`}
        type="button"
        aria-label={`Filters${filterCount ? `, ${filterCount} active` : ""}`}
        aria-expanded={panel === "filters"}
        onClick={() => setPanel((current) => current === "filters" ? null : "filters")}
      >
        ≡{filterCount ? <small>{filterCount}</small> : null}
      </button>
      <button className="glass-button" type="button" aria-label="Reset map view" onClick={onResetView}>◎</button>

      {panel === "discover" ? (
        <section className={styles.panel} id="exchange-search-discovery" aria-label="Search suggestions">
          {state.query.trim() ? (
            <div className={styles.section}>
              <div className={styles.heading}><strong>Suggestions</strong><span>{lensLabel}</span></div>
              {suggestions.length ? suggestions.map((suggestion) => (
                <button className={styles.option} key={suggestion.id} type="button" onClick={() => runSuggestion(suggestion)}>
                  <span className={styles.kind}>{suggestion.kind}</span>
                  <span><strong>{suggestion.label}</strong><small>{suggestion.description}</small></span>
                </button>
              )) : <p className={styles.empty}>Press Enter to search for “{state.query}”.</p>}
            </div>
          ) : null}

          {recentSearches.length ? (
            <div className={styles.section}>
              <div className={styles.heading}><strong>Recent</strong><span>{lensLabel}</span></div>
              {recentSearches.slice(0, 4).map((recent) => (
                <button className={`${styles.option} ${styles.compact}`} key={recent.id} type="button" onClick={() => { onRunState(recent.state); setPanel(null); }}>
                  <span className={styles.kind}>↺</span><span><strong>{recent.state.query || "Browse all"}</strong><small>{recent.state.filters.geography || "All geographies"}</small></span>
                </button>
              ))}
            </div>
          ) : null}

          {savedSearches.length ? (
            <div className={styles.section}>
              <div className={styles.heading}><strong>Saved</strong><span>{savedSearches.length}</span></div>
              {savedSearches.slice(0, 4).map((saved) => (
                <button className={`${styles.option} ${styles.compact}`} key={saved.id} type="button" onClick={() => { onRunState(saved.state); setPanel(null); }}>
                  <span className={styles.kind}>☆</span><span><strong>{saved.name}</strong><small>{saved.state.query || "Browse all"}</small></span>
                </button>
              ))}
            </div>
          ) : null}

          {!state.query.trim() && !recentSearches.length && !savedSearches.length ? (
            <p className={styles.empty}>Search organizations, records, geography, capabilities, and lens metadata from one Exchange surface.</p>
          ) : null}
        </section>
      ) : null}

      {panel === "filters" ? (
        <section className={`${styles.panel} ${styles.filterPanel}`} aria-label="Search filters">
          <div className={styles.heading}><strong>Refine {lensLabel}</strong><button type="button" onClick={() => setPanel(null)}>Done</button></div>
          <label>Geography<input value={state.filters.geography} onChange={(event) => patchFilters({ geography: event.target.value })} placeholder="City, county, state…" /></label>
          <div className={styles.filterGrid}>
            <label>Map presence
              <select value={state.filters.location} onChange={(event) => patchFilters({ location: event.target.value as ExchangeSearchState["filters"]["location"] })}>
                <option value="all">All records</option><option value="mapped">Mapped</option><option value="off-map">Off-map</option>
              </select>
            </label>
            <label>Ownership
              <select value={state.filters.ownership} onChange={(event) => patchFilters({ ownership: event.target.value as ExchangeSearchState["filters"]["ownership"] })}>
                <option value="all">All organizations</option><option value="mine">My organization</option><option value="others">Other organizations</option>
              </select>
            </label>
          </div>
          <label>Metadata / facets<input value={state.filters.metadata.join(", ")} onChange={(event) => patchFilters({ metadata: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })} placeholder="AMACS mapped, RFP…" /></label>
          <label>Sort
            <select value={state.sort} onChange={(event) => patch({ sort: event.target.value as ExchangeSearchState["sort"] })}>
              <option value="relevance">Best match</option><option value="title">Title</option><option value="geography">Geography</option>
            </select>
          </label>
          <div className={styles.actions}>
            <button type="button" onClick={() => onStateChange({ query: state.query, filters: { geography: "", location: "all", ownership: "all", metadata: [] }, sort: "relevance" })}>Reset filters</button>
            <button type="button" onClick={onSave}>Save search</button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
