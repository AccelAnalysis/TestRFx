"use client";

import { useEffect, useId, useRef } from "react";
import type { KeyboardEvent } from "react";
import type { DrawerQueryState, DrawerResultStatus, DrawerState, ExchangeLens, ExchangeRecord, LensAction } from "@/lib/exchange/contracts";
import { getDrawerResultBreakdown, higherDrawerState, lowerDrawerState, nextDrawerState } from "@/lib/exchange/drawer";
import { ActionRail } from "./action-rail";
import { RecordCard } from "./record-card";
import styles from "./results-drawer.module.css";

const stateLabel: Record<DrawerState, string> = { peek: "Expand results", mid: "Expand results", expanded: "Collapse results" };

export interface ResultsDrawerProps {
  state: DrawerState; onStateChange: (state: DrawerState) => void; lens: ExchangeLens; lensLabel: string;
  records: ExchangeRecord[]; totalAvailableCount?: number; selectedRecordId?: string; actions: LensAction[];
  activeActionIds?: string[]; onAction?: (action: LensAction) => void; emptyMessage: string; resultContext?: string;
  query: DrawerQueryState; onQueryChange: (query: DrawerQueryState) => void; onSelect: (id: string) => void;
  onOpen: (id: string) => void; onToggleSave: (id: string) => void; resultStatus?: DrawerResultStatus;
  hasMore?: boolean; loadingMore?: boolean; onLoadMore?: () => void; onRetry?: () => void;
}

export function ResultsDrawer({
  state, onStateChange, lens, lensLabel, records, totalAvailableCount, selectedRecordId, actions, activeActionIds = [], onAction,
  emptyMessage, resultContext, query, onQueryChange, onSelect, onOpen, onToggleSave, resultStatus = "ready", hasMore = false,
  loadingMore = false, onLoadMore, onRetry,
}: ResultsDrawerProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<number | null>(null);
  const scrollByLens = useRef<Partial<Record<ExchangeLens, number>>>({});
  const listId = useId();
  const breakdown = getDrawerResultBreakdown(records);
  const filteredFrom = totalAvailableCount ?? records.length;

  useEffect(() => {
    const list = listRef.current; if (!list) return;
    const frame = window.requestAnimationFrame(() => { list.scrollTop = scrollByLens.current[lens] ?? 0; });
    return () => window.cancelAnimationFrame(frame);
  }, [lens]);
  useEffect(() => {
    if (!selectedRecordId || !listRef.current) return;
    const escapedId = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(selectedRecordId) : selectedRecordId;
    listRef.current.querySelector(`[data-record-id="${escapedId}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedRecordId]);
  useEffect(() => {
    const root = listRef.current; const target = loadMoreRef.current;
    if (!root || !target || !hasMore || loadingMore || !onLoadMore || resultStatus !== "ready") return;
    const observer = new IntersectionObserver((entries) => { if (entries.some((entry) => entry.isIntersecting)) onLoadMore(); }, { root, rootMargin: "180px 0px" });
    observer.observe(target); return () => observer.disconnect();
  }, [hasMore, loadingMore, onLoadMore, resultStatus, records.length]);

  function finishDrag(y: number) { if (dragStart.current === null) return; const delta = y - dragStart.current; dragStart.current = null; if (delta < -42) onStateChange(higherDrawerState[state]); if (delta > 42) onStateChange(lowerDrawerState[state]); }
  function handleGrabberKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowUp") { event.preventDefault(); onStateChange(higherDrawerState[state]); }
    if (event.key === "ArrowDown") { event.preventDefault(); onStateChange(lowerDrawerState[state]); }
    if (event.key === "Home") { event.preventDefault(); onStateChange("peek"); }
    if (event.key === "End") { event.preventDefault(); onStateChange("expanded"); }
  }

  const showSkeletons = resultStatus === "loading" && records.length === 0;
  const showFailure = (resultStatus === "error" || resultStatus === "offline") && records.length === 0;
  const resultHeading = records.length === filteredFrom ? `${records.length} result${records.length === 1 ? "" : "s"}` : `${records.length} of ${filteredFrom} results`;

  return (
    <section className={`${styles.drawer} ${styles[state]}`} aria-label={`${lensLabel} results`} data-drawer-state={state}>
      <button className={styles.grabber} type="button" onClick={() => onStateChange(nextDrawerState[state])} onKeyDown={handleGrabberKeyDown}
        onPointerDown={(event) => { dragStart.current = event.clientY; event.currentTarget.setPointerCapture(event.pointerId); }}
        onPointerUp={(event) => finishDrag(event.clientY)} onPointerCancel={() => { dragStart.current = null; }}
        aria-label={stateLabel[state]} aria-controls={listId} aria-expanded={state !== "peek"}><span /></button>
      <div className={styles.header}>
        <div className={styles.headingBlock}><h2>{resultHeading}</h2><p className={styles.resultContext} aria-live="polite">{resultContext ?? `${breakdown.mapped} mapped · ${breakdown.offMap} off-map`}{resultStatus === "refreshing" ? " · Refreshing…" : ""}</p></div>
        <div className={styles.headerActions}><label className={styles.sortControl}><span className="sr-only">Sort results</span><select value={query.sort} onChange={(event) => onQueryChange({ ...query, sort: event.target.value as DrawerQueryState["sort"] })} aria-label="Sort results"><option value="relevance">Sort: Relevance</option><option value="title">Sort: Title</option><option value="organization">Sort: Organization</option><option value="geography">Sort: Geography</option></select></label></div>
      </div>
      {records.length > 0 ? <ActionRail actions={actions} activeActionIds={activeActionIds} onAction={onAction} /> : null}
      <div className={styles.list} id={listId} ref={listRef} role="feed" aria-busy={resultStatus === "loading" || resultStatus === "refreshing" || loadingMore} onScroll={(event) => { scrollByLens.current[lens] = event.currentTarget.scrollTop; }}>
        {showSkeletons ? <div className={styles.skeletonStack} aria-label="Loading results"><div className={styles.skeletonCard} /><div className={styles.skeletonCard} /><div className={styles.skeletonCard} /></div> : null}
        {showFailure ? <div className={styles.stateMessage} role="status"><strong>{resultStatus === "offline" ? "You appear to be offline" : "Results could not be loaded"}</strong><p>{resultStatus === "offline" ? "Reconnect to refresh this Exchange view." : "Try loading the results again."}</p>{onRetry ? <button type="button" onClick={onRetry}>Retry</button> : null}</div> : null}
        {!showSkeletons && !showFailure && records.length ? records.map((record) => <RecordCard key={record.id} record={record} selected={record.id === selectedRecordId} onSelect={() => onSelect(record.id)} onOpen={() => onOpen(record.id)} onToggleSave={() => onToggleSave(record.id)} />) : null}
        {!showSkeletons && !showFailure && records.length === 0 ? <div className={styles.stateMessage}><strong>No results</strong><p>{emptyMessage}</p></div> : null}
        {records.length > 0 && (hasMore || loadingMore) ? <div className={styles.loadSentinel} ref={loadMoreRef} aria-live="polite">{loadingMore ? "Loading more results…" : "More results load as you scroll"}</div> : null}
        {records.length > 0 && !hasMore && !loadingMore ? <p className={styles.endOfResults}>End of results</p> : null}
      </div>
    </section>
  );
}
