"use client";

import { useEffect, useRef } from "react";
import type { DrawerState, ExchangeRecord, LensAction } from "@/lib/exchange/contracts";
import { ActionRail } from "./action-rail";
import { RecordCard } from "./record-card";

const nextState: Record<DrawerState, DrawerState> = { peek: "mid", mid: "expanded", expanded: "peek" };
const upState: Record<DrawerState, DrawerState> = { peek: "mid", mid: "expanded", expanded: "expanded" };
const downState: Record<DrawerState, DrawerState> = { peek: "peek", mid: "peek", expanded: "mid" };
const stateLabel: Record<DrawerState, string> = { peek: "Expand results", mid: "Expand results", expanded: "Collapse results" };

export function ResultsDrawer({ state, onStateChange, lensLabel, records, selectedRecordId, actions, emptyMessage, resultContext, onSelect, onOpen }: {
  state: DrawerState;
  onStateChange: (state: DrawerState) => void;
  lensLabel: string;
  records: ExchangeRecord[];
  selectedRecordId?: string;
  actions: LensAction[];
  emptyMessage: string;
  resultContext?: string;
  onSelect: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<number | null>(null);

  useEffect(() => {
    if (!selectedRecordId || !listRef.current) return;
    listRef.current.querySelector(`[data-record-id="${selectedRecordId}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedRecordId]);

  function finishDrag(y: number) {
    if (dragStart.current === null) return;
    const delta = y - dragStart.current;
    dragStart.current = null;
    if (delta < -42) onStateChange(upState[state]);
    if (delta > 42) onStateChange(downState[state]);
  }

  return (
    <section className={`results-drawer drawer-${state}`} aria-label={`${lensLabel} results`}>
      <button
        className="drawer-grabber"
        type="button"
        onClick={() => onStateChange(nextState[state])}
        onPointerDown={(event) => { dragStart.current = event.clientY; event.currentTarget.setPointerCapture(event.pointerId); }}
        onPointerUp={(event) => finishDrag(event.clientY)}
        onPointerCancel={() => { dragStart.current = null; }}
        aria-label={stateLabel[state]}
      ><span /></button>
      <div className="drawer-header">
        <div><p className="eyebrow">{lensLabel}</p><h2>{records.length} result{records.length === 1 ? "" : "s"}</h2>{resultContext ? <p className="drawer-result-context">{resultContext}</p> : null}</div>
        <div className="drawer-header-actions"><button type="button">Sort</button></div>
      </div>
      <ActionRail actions={actions} />
      <div className="result-list" ref={listRef} aria-live="polite">
        {records.length ? records.map((record) => (
          <RecordCard key={record.id} record={record} selected={record.id === selectedRecordId} onSelect={() => onSelect(record.id)} onOpen={() => onOpen(record.id)} />
        )) : <div className="empty-state"><strong>No results</strong><p>{emptyMessage}</p></div>}
      </div>
    </section>
  );
}
