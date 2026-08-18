"use client";

import { useState } from "react";
import type { ExchangeSearchState, RecentSearch, SavedSearch, SearchSuggestion } from "@/lib/exchange/contracts";
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
}) {
  const [panel, setPanel] = useState<"discover" | null>(null);

  function patch(next: Partial<ExchangeSearchState>) {
    onStateChange({ ...state, ...next });
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

          {(state.query.trim() || state.filters.geography || state.filters.location !== "all" || state.filters.ownership !== "all" || state.filters.metadata.length) ? (
            <div className={styles.section}>
              <div className={styles.heading}><strong>Search state</strong><span>Universal</span></div>
              <button className={`${styles.option} ${styles.compact}`} type="button" onClick={onSave}>
                <span className={styles.kind}>☆</span><span><strong>Save this search</strong><small>Preserve this query and its search-service filters.</small></span>
              </button>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
