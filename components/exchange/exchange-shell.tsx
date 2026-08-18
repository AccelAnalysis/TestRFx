"use client";

import { useMemo, useState } from "react";
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

export function ExchangeShell({ initialLens = "rfx", initialRecordId }: { initialLens?: ExchangeLens; initialRecordId?: string }) {
  const [lens, setLens] = useState<ExchangeLens>(initialLens);
  const [search, setSearch] = useState("");
  const [drawer, setDrawer] = useState<DrawerState>("mid");
  const [selectedRecordId, setSelectedRecordId] = useState<string | undefined>(initialRecordId);
  const [detailRecordId, setDetailRecordId] = useState<string | undefined>(initialRecordId);
  const [menuOpen, setMenuOpen] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  const definition = lensDefinitions[lens];
  const records = useMemo(() => filterExchangeRecords(exchangeSeed, lens, search), [lens, search]);
  const selectedRecord = exchangeSeed.find((record) => record.id === selectedRecordId);
  const detailRecord = exchangeSeed.find((record) => record.id === detailRecordId);
  const actionRecord = selectedRecord && records.some((record) => record.id === selectedRecord.id) ? selectedRecord : records[0];
  const actions = definition.actions(actionRecord);

  function setUrl(nextLens: ExchangeLens, recordId?: string) {
    const next = recordId ? `/exchange/${nextLens}/${recordId}` : `/exchange/${nextLens}`;
    window.history.replaceState({}, "", next);
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
    setUrl(lens, id);
  }

  function closeDetail() {
    setDetailRecordId(undefined);
    setUrl(lens);
  }

  return (
    <main className="exchange-shell">
      <MapCanvas records={records} selectedRecordId={selectedRecordId} onSelect={(id) => { setSelectedRecordId(id); if (drawer === "peek") setDrawer("mid"); }} resetKey={resetKey} />
      <SearchControls value={search} placeholder={definition.searchPlaceholder} onChange={setSearch} onResetView={() => setResetKey((value) => value + 1)} />
      <ResultsDrawer state={drawer} onStateChange={setDrawer} lensLabel={definition.label} records={records} selectedRecordId={selectedRecordId} actions={actions} emptyMessage={definition.emptyMessage} onSelect={setSelectedRecordId} onOpen={openDetail} />
      <BottomNav activeLens={lens} onLensChange={changeLens} onMenu={() => setMenuOpen(true)} />
      {detailRecord ? <DetailSurface record={detailRecord} actions={definition.actions(detailRecord)} onClose={closeDetail} /> : null}
      {menuOpen ? <MenuSurface onClose={() => setMenuOpen(false)} /> : null}
    </main>
  );
}
