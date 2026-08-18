"use client";

import { useEffect, useMemo, useState } from "react";
import type { DrawerState, ExchangeLens } from "@/lib/exchange/contracts";
import { exchangeSeed } from "@/lib/exchange/seed";
import { filterExchangeRecords } from "@/lib/exchange/filter";
import { lensDefinitions } from "@/lib/exchange/lenses";
import { createDefaultMapView } from "@/lib/exchange/map-model";
import { PersistentMap } from "./persistent-map";
import { SearchControls } from "./search-controls";
import { ResultsDrawer } from "./results-drawer";
import { BottomNav } from "./bottom-nav";
import { DetailSurface } from "./detail-surface";
import { MenuSurface } from "./menu-surface";

export function ExchangeShell({ initialLens = "rfx", initialRecordId }: { initialLens?: ExchangeLens; initialRecordId?: string }) {
  const [lens, setLens] = useState<ExchangeLens>(initialLens);
  const [search, setSearch] = useState("");
  const [drawer, setDrawer] = useState<DrawerState>("mid");
  const [mapView, setMapView] = useState(createDefaultMapView);
  const [selectedRecordId, setSelectedRecordId] = useState<string | undefined>(initialRecordId);
  const [detailRecordId, setDetailRecordId] = useState<string | undefined>(initialRecordId);
  const [menuOpen, setMenuOpen] = useState(false);

  const definition = lensDefinitions[lens];
  const records = useMemo(() => filterExchangeRecords(exchangeSeed, lens, search), [lens, search]);
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

  function selectRecord(id: string) {
    setSelectedRecordId(id);
    if (drawer === "peek") setDrawer("mid");
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

  return (
    <main className="exchange-shell">
      <PersistentMap
        lens={lens}
        records={records}
        selectedRecordId={selectedRecordId}
        drawerState={drawer}
        view={mapView}
        onViewChange={setMapView}
        onSelect={selectRecord}
      />
      <SearchControls
        value={search}
        placeholder={definition.searchPlaceholder}
        onChange={setSearch}
        onResetView={() => setMapView(createDefaultMapView())}
      />
      <ResultsDrawer
        state={drawer}
        onStateChange={setDrawer}
        lensLabel={definition.label}
        records={records}
        selectedRecordId={selectedRecordId}
        actions={actions}
        emptyMessage={definition.emptyMessage}
        onSelect={selectRecord}
        onOpen={openDetail}
      />
      <BottomNav activeLens={lens} onLensChange={changeLens} onMenu={() => setMenuOpen(true)} />
      {detailRecord ? <DetailSurface record={detailRecord} actions={definition.actions(detailRecord)} onClose={closeDetail} /> : null}
      {menuOpen ? <MenuSurface onClose={() => setMenuOpen(false)} /> : null}
    </main>
  );
}
