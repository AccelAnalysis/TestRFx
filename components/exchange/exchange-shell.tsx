"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  Coordinates,
  DrawerState,
  ExchangeFilters,
  ExchangeLens,
  GeolocationStatus,
  MapDisplayMode,
} from "@/lib/exchange/contracts";
import { exchangeSeed } from "@/lib/exchange/seed";
import { createExchangeFilters, filterExchangeRecords, typeByLens } from "@/lib/exchange/filter";
import { lensDefinitions } from "@/lib/exchange/lenses";
import { MapCanvas } from "./map-canvas";
import { SearchControls } from "./search-controls";
import { FloatingControls } from "./floating-controls";
import { ResultsDrawer } from "./results-drawer";
import { BottomNav } from "./bottom-nav";
import { DetailSurface } from "./detail-surface";
import { MenuSurface } from "./menu-surface";

function createFiltersByLens(): Record<ExchangeLens, ExchangeFilters> {
  return {
    rfx: createExchangeFilters(),
    resources: createExchangeFilters(),
    intelligence: createExchangeFilters(),
    capabilities: createExchangeFilters(),
  };
}

export function ExchangeShell({ initialLens = "rfx", initialRecordId }: { initialLens?: ExchangeLens; initialRecordId?: string }) {
  const [lens, setLens] = useState<ExchangeLens>(initialLens);
  const [search, setSearch] = useState("");
  const [filtersByLens, setFiltersByLens] = useState<Record<ExchangeLens, ExchangeFilters>>(createFiltersByLens);
  const [drawer, setDrawer] = useState<DrawerState>("mid");
  const [selectedRecordId, setSelectedRecordId] = useState<string | undefined>(initialRecordId);
  const [detailRecordId, setDetailRecordId] = useState<string | undefined>(initialRecordId);
  const [menuOpen, setMenuOpen] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [mapDisplayMode, setMapDisplayMode] = useState<MapDisplayMode>("2d");
  const [geolocationStatus, setGeolocationStatus] = useState<GeolocationStatus>("idle");
  const [viewerLocation, setViewerLocation] = useState<Coordinates | undefined>();
  const [viewportDirty, setViewportDirty] = useState(false);

  const definition = lensDefinitions[lens];
  const filters = filtersByLens[lens];
  const lensRecords = useMemo(() => exchangeSeed.filter((record) => record.type === typeByLens[lens]), [lens]);
  const records = useMemo(() => filterExchangeRecords(exchangeSeed, lens, search, filters), [lens, search, filters]);
  const selectedRecord = exchangeSeed.find((record) => record.id === selectedRecordId);
  const detailRecord = exchangeSeed.find((record) => record.id === detailRecordId);
  const actionRecord = selectedRecord && records.some((record) => record.id === selectedRecord.id) ? selectedRecord : records[0];
  const actions = definition.actions(actionRecord);

  useEffect(() => {
    function syncFromUrl() {
      const parts = window.location.pathname.split("/").filter(Boolean);
      const urlLens = parts[1];
      if (urlLens === "rfx" || urlLens === "resources" || urlLens === "intelligence" || urlLens === "capabilities") {
        setLens(urlLens);
        const recordId = parts[2];
        setSelectedRecordId(recordId);
        setDetailRecordId(recordId);
      }
    }
    window.addEventListener("popstate", syncFromUrl);
    return () => window.removeEventListener("popstate", syncFromUrl);
  }, []);

  useEffect(() => {
    if (selectedRecordId && !records.some((record) => record.id === selectedRecordId)) {
      setSelectedRecordId(undefined);
    }
  }, [records, selectedRecordId]);

  function setUrl(nextLens: ExchangeLens, recordId?: string, mode: "push" | "replace" = "replace") {
    const next = recordId ? `/exchange/${nextLens}/${recordId}` : `/exchange/${nextLens}`;
    if (mode === "push") window.history.pushState({}, "", next);
    else window.history.replaceState({}, "", next);
  }

  function changeLens(next: ExchangeLens) {
    setLens(next);
    setSearch("");
    setSelectedRecordId(undefined);
    setDetailRecordId(undefined);
    setUrl(next);
  }

  function openDetail(id: string) {
    setSelectedRecordId(id);
    setDetailRecordId(id);
    setUrl(lens, id, "push");
  }

  function closeDetail() {
    setDetailRecordId(undefined);
    setUrl(lens);
  }

  function updateFilters(next: ExchangeFilters) {
    setFiltersByLens((current) => ({ ...current, [lens]: next }));
  }

  function resetMapView() {
    setResetKey((value) => value + 1);
    setViewportDirty(false);
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
        resetMapView();
      },
      (error) => {
        setGeolocationStatus(error.code === 1 ? "denied" : "unavailable");
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 },
    );
  }

  return (
    <main className="exchange-shell">
      <MapCanvas
        records={records}
        selectedRecordId={selectedRecordId}
        onSelect={(id) => { setSelectedRecordId(id); if (drawer === "peek") setDrawer("mid"); }}
        resetKey={resetKey}
        displayMode={mapDisplayMode}
        viewerLocation={viewerLocation}
      />
      <SearchControls value={search} placeholder={definition.searchPlaceholder} onChange={setSearch} />
      <FloatingControls
        lens={lens}
        records={lensRecords}
        search={search}
        filters={filters}
        onFiltersChange={updateFilters}
        mapDisplayMode={mapDisplayMode}
        onMapDisplayModeChange={setMapDisplayMode}
        geolocationStatus={geolocationStatus}
        onLocate={locateViewer}
        onResetView={resetMapView}
        searchAreaAvailable={viewportDirty}
        onSearchArea={() => setViewportDirty(false)}
      />
      <ResultsDrawer state={drawer} onStateChange={setDrawer} lensLabel={definition.label} records={records} selectedRecordId={selectedRecordId} actions={actions} emptyMessage={definition.emptyMessage} onSelect={setSelectedRecordId} onOpen={openDetail} />
      <BottomNav activeLens={lens} onLensChange={changeLens} onMenu={() => setMenuOpen(true)} />
      {detailRecord ? <DetailSurface record={detailRecord} actions={definition.actions(detailRecord)} onClose={closeDetail} /> : null}
      {menuOpen ? <MenuSurface onClose={() => setMenuOpen(false)} /> : null}
    </main>
  );
}
