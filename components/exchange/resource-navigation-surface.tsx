"use client";

import type { ExchangeRecord } from "@/lib/exchange/contracts";
import {
  resourceNavigationChildren,
  resourceNavigationEnabled,
  resourceNavigationTrail,
  type ResourceNavigationAction,
  type ResourceNavigationState,
} from "@/lib/exchange/resource-navigation";
import styles from "./resource-navigation.module.css";

export function ResourceNavigationSurface({ state, record, onStateChange, onAction, onClose }: {
  state: ResourceNavigationState;
  record?: ExchangeRecord;
  onStateChange: (state: ResourceNavigationState) => void;
  onAction: (action: ResourceNavigationAction) => void;
  onClose: () => void;
}) {
  const trail = resourceNavigationTrail(state);
  const children = resourceNavigationChildren(state);
  const current = trail.at(-1);
  const currentEnabled = current ? resourceNavigationEnabled(current, record) : true;

  return (
    <div className={styles.backdrop} role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <section className={styles.surface} role="dialog" aria-modal="true" aria-label="Resources workflow hierarchy">
        <header className={styles.header}>
          {state.path.length ? <button type="button" onClick={() => onStateChange({ path: state.path.slice(0, -1) })}>← Back</button> : <span />}
          <div className={styles.heading}><p>Resources workflow tree</p><h2>{current?.label ?? "Resources"}</h2></div>
          <button className={styles.close} type="button" onClick={onClose} aria-label="Close Resources workflows">×</button>
        </header>
        <nav className={styles.breadcrumbs} aria-label="Resources workflow breadcrumb">
          <button type="button" onClick={() => onStateChange({ path: [] })}>Resources</button>
          {trail.map((node, index) => <span key={node.id}>› <button type="button" onClick={() => onStateChange({ path: state.path.slice(0, index + 1) })}>{node.label}</button></span>)}
        </nav>
        {record?.type === "resource" ? <div className={styles.context}><strong>{record.title}</strong><span>{record.organization} · {record.ownedByViewer ? "My organization" : "Other organization"}</span></div> : null}
        {current?.action ? <div className={styles.currentAction}><p>{current.description ?? `Continue to ${current.label}.`}</p><button type="button" disabled={!currentEnabled} onClick={() => onAction(current.action!)}>Open {current.label}</button></div> : null}
        <div className={styles.nodeList}>
          {children.map((node) => {
            const enabled = resourceNavigationEnabled(node, record);
            return <button className={styles.node} type="button" key={node.id} disabled={!enabled} title={!enabled ? "Select a Resource in the matching ownership context." : undefined} onClick={() => { if (node.children?.length) onStateChange({ path: [...state.path, node.id] }); else if (node.action) onAction(node.action); }}>
              <span><strong>{node.label}</strong>{node.description ? <small>{node.description}</small> : null}</span><span className={styles.chevron} aria-hidden>{node.children?.length ? "›" : "→"}</span>
            </button>;
          })}
        </div>
        <p className={styles.notice}>The hierarchy mirrors the source Resources workflow. Search, Filters, Sort, and Geography remain shared shell controls.</p>
      </section>
    </div>
  );
}
