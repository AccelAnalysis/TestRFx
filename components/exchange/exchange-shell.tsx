"use client";

import { useEffect, useMemo, useState } from "react";
import type { DrawerState, ExchangeLens } from "@/lib/exchange/contracts";
import { exchangeSeed } from "@/lib/exchange/seed";
import { filterExchangeRecords } from "@/lib/exchange/filter";
import { lensDefinitions } from "@/lib/exchange/lenses";
import { MapCanvas } from "./map-canvas";
import { SearchControls } from "./search-controls";
import { ResultsDrawer } from "./results-drawer";
import { BottomNav } from "./bottom-nav";
import { DetailSurface } from "./detail-surface";
import { MenuSurface } from "./menu-surface";

const initialSavedRecordIds = exchangeSeed.filter((record) => record.saved).map((record) => record.id);

export function ExchangeShell({ initialLens = "rfx", initialRecordId }: { initialLens?: ExchangeLens; initialRecordId?: string }) {
  const [lens, setLens] = useState<ExchangeLens>(initialLens);
  const [search, setSearch] = useState("");
  const [drawer, setDrawer] = useState<DrawerState>("mid");
  const [selectedRecordId, setSelectedRecordId] = useState<string | undefined>(initialRecordId);
  const [detailRecordId, setDetailRecordId] = useState<string | undefined>(initialRecordId);
  const [menuOpen, setMenuOpen] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [savedRecordIds, setSavedRecordIds] = useState<Set<string>>(() => new Set(initialSavedRecordIds));

  const definition = lensDefinitions[lens];
  const allRecords = useMemo(
    () => exchangeSeed.map((record) => ({ ...record, saved: savedRecordIds.has(record.id) })),
    [savedRecordIds],
  );
  const records = useMemo(() => filterExchangeRecords(allRecords, lens, search), [allRecords, lens, search]);
  const selectedRecord = allRecords.find((record) => record.id === selectedRecordId);
  const detailRecord = allRecords.find((record) => record.id === detailRecordId);
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

  function openDetail(id: string) {
    setSelectedRecordId(id);
    setDetailRecordId(id);
    setUrl(lens, id, "push");
  }

  function closeDetail() {
    setDetailRecordId(undefined);
    setUrl(lens);
  }

  function toggleSaved(id: string) {
    setSavedRecordIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <main className="exchange-shell">
      <MapCanvas records={records} selectedRecordId={selectedRecordId} onSelect={(id) => { setSelectedRecordId(id); if (drawer === "peek") setDrawer("mid"); }} resetKey={resetKey} />
      <SearchControls value={search} placeholder={definition.searchPlaceholder} onChange={setSearch} onResetView={() => setResetKey((value) => value + 1)} />
      <ResultsDrawer
        state={drawer}
        onStateChange={setDrawer}
        lensLabel={definition.label}
        records={records}
        selectedRecordId={selectedRecordId}
        actions={actions}
        emptyMessage={definition.emptyMessage}
        onSelect={setSelectedRecordId}
        onOpen={openDetail}
        onToggleSave={toggleSaved}
      />
      <BottomNav activeLens={lens} onLensChange={changeLens} onMenu={() => setMenuOpen(true)} />
      {detailRecord ? <DetailSurface record={detailRecord} actions={definition.actions(detailRecord)} onClose={closeDetail} /> : null}
      {menuOpen ? <MenuSurface onClose={() => setMenuOpen(false)} /> : null}
    </main>
  );
}
