"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  ExchangeFilters,
  ExchangeLens,
  ExchangeRecord,
  FloatingControlRoute,
  GeolocationStatus,
  MapDisplayMode,
  SearchLocationMode,
} from "@/lib/exchange/contracts";
import {
  applyExchangeFilters,
  countActiveFilters,
  createExchangeFilters,
  getLensFilterOptions,
} from "@/lib/exchange/filter";
import styles from "./floating-controls.module.css";

const locationLabels: Record<GeolocationStatus, string> = {
  idle: "Use my location",
  requesting: "Finding your location",
  located: "Recenter on my location",
  denied: "Location permission denied; try again after changing browser permissions",
  unavailable: "Location unavailable; try again",
};

const relationshipLabels: Record<ExchangeFilters["relationship"], string> = {
  all: "All organizations",
  mine: "My organization",
  others: "Other organizations",
};

const locationFilterLabels: Record<SearchLocationMode, string> = {
  all: "Mapped + off-map",
  mapped: "Mapped only",
  "off-map": "Off-map only",
};

function lensLabel(lens: ExchangeLens) {
  if (lens === "rfx") return "RFx";
  return lens[0].toUpperCase() + lens.slice(1);
}

function SlidersIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={styles.icon}>
      <path d="M4 6h10M18 6h2M4 12h3M11 12h9M4 18h8M16 18h4" />
      <circle cx="16" cy="6" r="2" /><circle cx="9" cy="12" r="2" /><circle cx="14" cy="18" r="2" />
    </svg>
  );
}

function LocateIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={styles.icon}>
      <circle cx="12" cy="12" r={active ? "4" : "3"} />
      <circle cx="12" cy="12" r="7" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </svg>
  );
}

function MapIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={styles.icon}>
      <path d="m3 5 5-2 8 3 5-2v15l-5 2-8-3-5 2Z" /><path d="M8 3v15M16 6v15" />
    </svg>
  );
}

function MenuRow({ label, summary, onClick, disabled = false }: { label: string; summary?: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button className={styles.menuRow} type="button" onClick={onClick} disabled={disabled}>
      <span><strong>{label}</strong>{summary ? <small>{summary}</small> : null}</span><span aria-hidden>›</span>
    </button>
  );
}

function ChoiceRow({ label, selected, onClick, disabled = false }: { label: string; selected: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button className={styles.choiceRow} type="button" aria-pressed={selected} onClick={onClick} disabled={disabled}>
      <span>{label}</span><span aria-hidden>{selected ? "✓" : ""}</span>
    </button>
  );
}

export function FloatingControls({
  lens,
  records,
  facetRecords = records,
  filters,
  onFiltersChange,
  mapDisplayMode,
  mapBearing,
  onMapDisplayModeChange,
  onResetBearing,
  geolocationStatus,
  onLocate,
  onResetView,
  onFitResults,
  canFitResults,
  onRecenterGeography,
  canRecenterGeography,
  searchAreaAvailable = false,
  areaQueryActive = false,
  onSearchArea,
  onClearSearchArea,
  filterRequestKey = 0,
}: {
  lens: ExchangeLens;
  records: ExchangeRecord[];
  facetRecords?: ExchangeRecord[];
  filters: ExchangeFilters;
  onFiltersChange: (filters: ExchangeFilters) => void;
  mapDisplayMode: MapDisplayMode;
  mapBearing: number;
  onMapDisplayModeChange: (mode: MapDisplayMode) => void;
  onResetBearing: () => void;
  geolocationStatus: GeolocationStatus;
  onLocate: () => void;
  onResetView: () => void;
  onFitResults: () => void;
  canFitResults: boolean;
  onRecenterGeography: () => void;
  canRecenterGeography: boolean;
  searchAreaAvailable?: boolean;
  areaQueryActive?: boolean;
  onSearchArea: () => void;
  onClearSearchArea: () => void;
  filterRequestKey?: number;
}) {
  const [panelStack, setPanelStack] = useState<FloatingControlRoute[]>([]);
  const [draft, setDraft] = useState<ExchangeFilters>(filters);
  const options = useMemo(() => getLensFilterOptions(facetRecords, lens), [facetRecords, lens]);
  const previewCount = useMemo(() => applyExchangeFilters(records, draft).length, [records, draft]);
  const activeCount = countActiveFilters(filters);
  const route = panelStack.at(-1);
  const filtersOpen = panelStack[0]?.startsWith("filter") ?? false;
  const mapOpen = panelStack[0]?.startsWith("map") ?? false;

  useEffect(() => {
    if (!filtersOpen) setDraft(filters);
  }, [filters, filtersOpen]);

  useEffect(() => {
    setPanelStack([]);
    setDraft(filters);
  }, [lens]);

  useEffect(() => {
    if (!filterRequestKey) return;
    setDraft(filters);
    setPanelStack(["filters"]);
  }, [filterRequestKey]);

  function openFilters() {
    if (filtersOpen) {
      setPanelStack([]);
      return;
    }
    setDraft(filters);
    setPanelStack(["filters"]);
  }

  function openMap() {
    setPanelStack(mapOpen ? [] : ["map"]);
  }

  function push(routeToOpen: FloatingControlRoute) {
    setPanelStack((current) => [...current, routeToOpen]);
  }

  function back() {
    setPanelStack((current) => current.slice(0, -1));
  }

  function close() {
    setPanelStack([]);
  }

  function applyFilters() {
    onFiltersChange(draft);
    close();
  }

  function toggleMetadata(value: string) {
    setDraft((current) => ({
      ...current,
      metadata: current.metadata.includes(value)
        ? current.metadata.filter((item) => item !== value)
        : [...current.metadata, value],
    }));
  }

  function clearAppliedFilter(kind: "geography" | "relationship" | "location" | "featured" | "metadata", value?: string) {
    if (kind === "geography") onFiltersChange({ ...filters, geography: undefined });
    if (kind === "relationship") onFiltersChange({ ...filters, relationship: "all" });
    if (kind === "location") onFiltersChange({ ...filters, location: "all" });
    if (kind === "featured") onFiltersChange({ ...filters, featuredOnly: false });
    if (kind === "metadata" && value) onFiltersChange({ ...filters, metadata: filters.metadata.filter((item) => item !== value) });
  }

  const locateDisabled = geolocationStatus === "requesting";

  function panelTitle() {
    if (route === "filters") return `Filter ${lensLabel(lens)}`;
    if (route === "filter-geography") return "Geography";
    if (route === "filter-relationship") return "Organization relationship";
    if (route === "filter-location") return "Map availability";
    if (route === "filter-placement") return "Placement";
    if (route === "filter-facets") return "Lens facets";
    if (route === "map") return "Map controls";
    if (route === "map-display") return "Map display";
    return "Exchange controls";
  }

  function renderPanelBody() {
    if (route === "filters") {
      return (
        <>
          <div className={styles.menuList}>
            <MenuRow label="Geography" summary={draft.geography ?? "All geographies"} onClick={() => push("filter-geography")} />
            <MenuRow label="Organization relationship" summary={relationshipLabels[draft.relationship]} onClick={() => push("filter-relationship")} />
            <MenuRow label="Map availability" summary={locationFilterLabels[draft.location]} onClick={() => push("filter-location")} />
            {options.supportsFeatured ? <MenuRow label="Placement" summary={draft.featuredOnly ? "Featured only" : "All placements"} onClick={() => push("filter-placement")} /> : null}
            {options.metadata.length ? <MenuRow label="Lens facets" summary={draft.metadata.length ? `${draft.metadata.length} selected` : "Any facet"} onClick={() => push("filter-facets")} /> : null}
          </div>
          <button className={styles.clearAll} type="button" onClick={() => setDraft(createExchangeFilters())} disabled={countActiveFilters(draft) === 0}>Clear all filters</button>
        </>
      );
    }

    if (route === "filter-geography") {
      return (
        <div className={styles.choiceList}>
          <ChoiceRow label="All geographies" selected={!draft.geography} onClick={() => setDraft((current) => ({ ...current, geography: undefined }))} />
          {options.geographies.map((geography) => <ChoiceRow key={geography} label={geography} selected={draft.geography === geography} onClick={() => setDraft((current) => ({ ...current, geography }))} />)}
        </div>
      );
    }

    if (route === "filter-relationship") {
      return (
        <div className={styles.choiceList}>
          {(["all", "mine", "others"] as const).map((value) => <ChoiceRow key={value} label={relationshipLabels[value]} selected={draft.relationship === value} onClick={() => setDraft((current) => ({ ...current, relationship: value }))} />)}
        </div>
      );
    }

    if (route === "filter-location") {
      return (
        <div className={styles.choiceList}>
          <ChoiceRow label="Mapped + off-map" selected={draft.location === "all"} onClick={() => setDraft((current) => ({ ...current, location: "all" }))} />
          <ChoiceRow label="Mapped only" selected={draft.location === "mapped"} disabled={!options.hasMapped} onClick={() => setDraft((current) => ({ ...current, location: "mapped" }))} />
          <ChoiceRow label="Off-map only" selected={draft.location === "off-map"} disabled={!options.hasOffMap} onClick={() => setDraft((current) => ({ ...current, location: "off-map" }))} />
        </div>
      );
    }

    if (route === "filter-placement") {
      return (
        <div className={styles.choiceList}>
          <ChoiceRow label="All placements" selected={!draft.featuredOnly} onClick={() => setDraft((current) => ({ ...current, featuredOnly: false }))} />
          <ChoiceRow label="Featured only" selected={draft.featuredOnly} onClick={() => setDraft((current) => ({ ...current, featuredOnly: true }))} />
        </div>
      );
    }

    if (route === "filter-facets") {
      return (
        <div className={styles.facetList}>
          {options.metadata.map((value) => (
            <button key={value} className={styles.facetButton} type="button" aria-pressed={draft.metadata.includes(value)} onClick={() => toggleMetadata(value)}>{value}</button>
          ))}
        </div>
      );
    }

    if (route === "map") {
      return (
        <div className={styles.menuList}>
          <MenuRow label="Map display" summary={mapDisplayMode.toUpperCase()} onClick={() => push("map-display")} />
          <button className={styles.actionRow} type="button" onClick={() => { onFitResults(); close(); }} disabled={!canFitResults}><span><strong>Fit current results</strong><small>Center the map on legitimate mapped results.</small></span></button>
          {filters.geography ? <button className={styles.actionRow} type="button" onClick={() => { onRecenterGeography(); close(); }} disabled={!canRecenterGeography}><span><strong>Center selected geography</strong><small>{filters.geography}</small></span></button> : null}
          {searchAreaAvailable ? <button className={styles.actionRow} type="button" onClick={() => { onSearchArea(); close(); }}><span><strong>Search this area</strong><small>Use the current viewport as a spatial result constraint.</small></span></button> : null}
          {areaQueryActive ? <button className={styles.actionRow} type="button" onClick={() => { onClearSearchArea(); close(); }}><span><strong>Clear searched area</strong><small>Restore mapped and off-map results outside the viewport constraint.</small></span></button> : null}
          <button className={styles.actionRow} type="button" onClick={() => { onResetView(); close(); }}><span><strong>Reset map view</strong><small>Restore the Exchange default camera and clear map-area search.</small></span></button>
        </div>
      );
    }

    if (route === "map-display") {
      return (
        <div className={styles.choiceList}>
          <ChoiceRow label="2D" selected={mapDisplayMode === "2d"} onClick={() => onMapDisplayModeChange("2d")} />
          <ChoiceRow label="3D" selected={mapDisplayMode === "3d"} onClick={() => onMapDisplayModeChange("3d")} />
          {Math.abs(mapBearing) > 0.5 ? <button className={styles.actionRow} type="button" onClick={onResetBearing}><span><strong>Reset north</strong><small>Return map bearing to 0°.</small></span></button> : null}
        </div>
      );
    }

    return null;
  }

  return (
    <>
      <div className={styles.primaryDock} aria-label="Exchange floating controls">
        <button className={`${styles.controlButton} ${filtersOpen || activeCount ? styles.controlButtonActive : ""}`} type="button"
          aria-label={activeCount ? `Filters, ${activeCount} active` : "Filters"} aria-expanded={filtersOpen} aria-controls="exchange-floating-panel" onClick={openFilters} title="Filters">
          <SlidersIcon />{activeCount ? <span className={styles.badge}>{activeCount}</span> : null}
        </button>
        <button className={`${styles.controlButton} ${geolocationStatus === "located" ? styles.controlButtonActive : ""}`} type="button"
          aria-label={locationLabels[geolocationStatus]} onClick={onLocate} disabled={locateDisabled} title={locationLabels[geolocationStatus]}>
          {geolocationStatus === "requesting" ? <span className={styles.controlGlyph} aria-hidden>…</span> : <LocateIcon active={geolocationStatus === "located"} />}
        </button>
      </div>

      <div className={styles.utilityDock} aria-label="Map utilities">
        <button className={`${styles.controlButton} ${mapOpen ? styles.controlButtonActive : ""}`} type="button" aria-label="Map controls" aria-expanded={mapOpen} aria-controls="exchange-floating-panel" onClick={openMap} title="Map controls"><MapIcon /></button>
        <button className={styles.controlButton} type="button" aria-label="Reset map view" onClick={onResetView} title="Reset map view"><span className={styles.controlGlyph} aria-hidden>↥</span></button>
        {Math.abs(mapBearing) > 0.5 ? <button className={styles.controlButton} type="button" aria-label="Reset map bearing to north" onClick={onResetBearing} title="Reset north"><span className={styles.controlGlyph} aria-hidden>↑</span></button> : null}
      </div>

      {activeCount ? (
        <div className={styles.activeChips} aria-label="Active filters">
          {filters.geography ? <button type="button" onClick={() => clearAppliedFilter("geography")}>{filters.geography}<span aria-hidden>×</span></button> : null}
          {filters.relationship !== "all" ? <button type="button" onClick={() => clearAppliedFilter("relationship")}>{relationshipLabels[filters.relationship]}<span aria-hidden>×</span></button> : null}
          {filters.location !== "all" ? <button type="button" onClick={() => clearAppliedFilter("location")}>{locationFilterLabels[filters.location]}<span aria-hidden>×</span></button> : null}
          {filters.featuredOnly ? <button type="button" onClick={() => clearAppliedFilter("featured")}>Featured<span aria-hidden>×</span></button> : null}
          {filters.metadata.map((value) => <button key={value} type="button" onClick={() => clearAppliedFilter("metadata", value)}>{value}<span aria-hidden>×</span></button>)}
        </div>
      ) : null}

      {searchAreaAvailable ? <button className={styles.searchArea} type="button" onClick={onSearchArea}>Search this area</button> : null}
      {areaQueryActive && !searchAreaAvailable ? <button className={`${styles.searchArea} ${styles.searchAreaActive}`} type="button" onClick={onClearSearchArea}>Map area active · Clear</button> : null}

      {route ? (
        <section id="exchange-floating-panel" className={styles.panel} role="dialog" aria-label={panelTitle()} onKeyDown={(event) => { if (event.key === "Escape") close(); }}>
          <div className={styles.panelHeader}>
            <div className={styles.panelHeaderLeading}>
              {panelStack.length > 1 ? <button className={styles.backButton} type="button" onClick={back} aria-label="Back">‹</button> : null}
              <div><p className="eyebrow">{filtersOpen ? lensLabel(lens) : "Exchange map"}</p><h2>{panelTitle()}</h2></div>
            </div>
            <button className={styles.closeButton} type="button" onClick={close} aria-label="Close controls">×</button>
          </div>

          <div className={styles.panelBody}>{renderPanelBody()}</div>

          {filtersOpen ? (
            <div className={styles.filterActions}>
              <button className={styles.textButton} type="button" onClick={close}>Cancel</button>
              <button className={styles.applyButton} type="button" onClick={applyFilters}>Show {previewCount} result{previewCount === 1 ? "" : "s"}</button>
            </div>
          ) : null}
        </section>
      ) : null}

      <span className={styles.status} aria-live="polite">{locationLabels[geolocationStatus]}</span>
    </>
  );
}
