"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  ExchangeFilters,
  ExchangeLens,
  ExchangeRecord,
  GeolocationStatus,
  MapGeographyOption,
  MapViewState,
} from "@/lib/exchange/contracts";
import {
  countActiveFilters,
  createExchangeFilters,
  filterExchangeRecords,
  getLensFilterOptions,
} from "@/lib/exchange/filter";
import { MapControlMenu } from "./map-control-menu";
import styles from "./floating-controls.module.css";

const locationLabels: Record<GeolocationStatus, string> = {
  idle: "Use my location",
  requesting: "Finding your location",
  located: "Recenter on my location",
  denied: "Location permission denied; try again after changing browser permissions",
  unavailable: "Location unavailable; try again",
};

export function FloatingControls({
  lens,
  records,
  search,
  filters,
  onFiltersChange,
  mapView,
  mapGeographies,
  onMapViewChange,
  onSelectGeography,
  geolocationStatus,
  onLocate,
  onResetView,
  searchAreaAvailable = false,
  onSearchArea,
}: {
  lens: ExchangeLens;
  records: ExchangeRecord[];
  search: string;
  filters: ExchangeFilters;
  onFiltersChange: (filters: ExchangeFilters) => void;
  mapView: MapViewState;
  mapGeographies: MapGeographyOption[];
  onMapViewChange: (view: MapViewState) => void;
  onSelectGeography: (geography?: MapGeographyOption) => void;
  geolocationStatus: GeolocationStatus;
  onLocate: () => void;
  onResetView: () => void;
  searchAreaAvailable?: boolean;
  onSearchArea: () => void;
}) {
  const [filterOpen, setFilterOpen] = useState(false);
  const [mapMenuOpen, setMapMenuOpen] = useState(false);
  const [draft, setDraft] = useState<ExchangeFilters>(filters);
  const options = useMemo(() => getLensFilterOptions(records, lens), [records, lens]);
  const previewCount = useMemo(() => filterExchangeRecords(records, lens, search, draft).length, [records, lens, search, draft]);
  const activeCount = countActiveFilters(filters);

  useEffect(() => { if (!filterOpen) setDraft(filters); }, [filters, filterOpen]);
  useEffect(() => { setFilterOpen(false); setMapMenuOpen(false); }, [lens]);

  function openFilters() {
    setMapMenuOpen(false);
    setDraft(filters);
    setFilterOpen((value) => !value);
  }

  function toggleMetadata(value: string) {
    setDraft((current) => ({ ...current, metadata: current.metadata.includes(value) ? current.metadata.filter((item) => item !== value) : [...current.metadata, value] }));
  }

  function applyFilters() { onFiltersChange(draft); setFilterOpen(false); }

  const locateDisabled = geolocationStatus === "requesting";
  const locateGlyph = geolocationStatus === "requesting" ? "…" : geolocationStatus === "located" ? "●" : "◎";

  return (
    <>
      <div className={styles.primaryDock} aria-label="Exchange floating controls">
        <button className={`${styles.controlButton} ${filterOpen || activeCount ? styles.controlButtonActive : ""}`} type="button" aria-label={activeCount ? `Filters, ${activeCount} active` : "Filters"} aria-expanded={filterOpen} aria-controls="exchange-filter-panel" onClick={openFilters} title="Filters">
          <span className={styles.controlGlyph} aria-hidden>≡</span>{activeCount ? <span className={styles.badge}>{activeCount}</span> : null}
        </button>
        <button className={`${styles.controlButton} ${geolocationStatus === "located" ? styles.controlButtonActive : ""}`} type="button" aria-label={locationLabels[geolocationStatus]} onClick={onLocate} disabled={locateDisabled} title={locationLabels[geolocationStatus]}>
          <span className={styles.controlGlyph} aria-hidden>{locateGlyph}</span>
        </button>
      </div>

      <div className={styles.utilityDock} aria-label="Map utilities">
        <button className={`${styles.controlButton} ${mapMenuOpen ? styles.controlButtonActive : ""}`} type="button" aria-label="Map controls" aria-expanded={mapMenuOpen} onClick={() => { setFilterOpen(false); setMapMenuOpen((value) => !value); }} title="Map controls">
          <span className={styles.controlText}>MAP</span>
        </button>
      </div>

      {searchAreaAvailable && mapView.currentBounds ? <button className={styles.searchArea} type="button" onClick={onSearchArea}>Search this area</button> : null}

      <MapControlMenu open={mapMenuOpen} lens={lens} view={mapView} geographies={mapGeographies} geolocationStatus={geolocationStatus} searchAreaAvailable={searchAreaAvailable} onClose={() => setMapMenuOpen(false)} onViewChange={onMapViewChange} onResetView={onResetView} onSelectGeography={onSelectGeography} onLocate={onLocate} onSearchArea={onSearchArea} />

      {filterOpen ? (
        <section id="exchange-filter-panel" className={styles.filterPanel} role="dialog" aria-label="Filter Exchange results">
          <div className={styles.filterHeader}><div><p className="eyebrow">Current lens</p><h2>Filter {lens === "rfx" ? "RFx" : lens[0].toUpperCase() + lens.slice(1)}</h2></div><button className={styles.textButton} type="button" onClick={() => setDraft(createExchangeFilters())}>Clear</button></div>
          <label className={styles.filterGroup}><span>Geography</span><select value={draft.geography ?? ""} onChange={(event) => setDraft((current) => ({ ...current, geography: event.target.value || undefined }))}><option value="">All geographies</option>{options.geographies.map((geography) => <option key={geography} value={geography}>{geography}</option>)}</select></label>
          <label className={styles.filterGroup}><span>Organization relationship</span><select value={draft.relationship} onChange={(event) => setDraft((current) => ({ ...current, relationship: event.target.value as ExchangeFilters["relationship"] }))}><option value="all">All organizations</option><option value="mine">My organization</option><option value="others">Other organizations</option></select></label>
          <div className={styles.filterGroup}><span>Map availability</span><label className={styles.toggleRow}><input type="checkbox" checked={draft.mappedOnly} onChange={(event) => setDraft((current) => ({ ...current, mappedOnly: event.target.checked }))} />Show only records with legitimate map coordinates</label></div>
          {options.supportsFeatured ? <div className={styles.filterGroup}><span>Placement</span><label className={styles.toggleRow}><input type="checkbox" checked={draft.featuredOnly} onChange={(event) => setDraft((current) => ({ ...current, featuredOnly: event.target.checked }))} />Featured records only</label></div> : null}
          {options.metadata.length ? <fieldset className={styles.filterGroup}><legend>Lens facets</legend><div className={styles.facetList}>{options.metadata.map((value) => <button key={value} className={styles.facetButton} type="button" aria-pressed={draft.metadata.includes(value)} onClick={() => toggleMetadata(value)}>{value}</button>)}</div></fieldset> : null}
          <div className={styles.filterActions}><button className={styles.textButton} type="button" onClick={() => setFilterOpen(false)}>Cancel</button><button className={styles.applyButton} type="button" onClick={applyFilters}>Show {previewCount} result{previewCount === 1 ? "" : "s"}</button></div>
        </section>
      ) : null}

      <span className={styles.status} aria-live="polite">{locationLabels[geolocationStatus]}</span>
    </>
  );
}
