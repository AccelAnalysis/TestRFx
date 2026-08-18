"use client";

import { useEffect, useMemo, useState } from "react";
import type { ExchangeRecord } from "@/lib/exchange/contracts";
import { drawerWorkflowPath, type DrawerWorkflowExecution, type DrawerWorkflowNode } from "@/lib/exchange/drawer-workflows";
import styles from "./drawer-workflow-navigator.module.css";

export function DrawerWorkflowNavigator({ root, record, onClose, onExecute, onInspectReferralPolicy }: {
  root: DrawerWorkflowNode;
  record?: ExchangeRecord;
  onClose: () => void;
  onExecute: (execution: DrawerWorkflowExecution, node: DrawerWorkflowNode) => void;
  onInspectReferralPolicy: (node: DrawerWorkflowNode) => void;
}) {
  const [pathIds, setPathIds] = useState<string[]>([]);
  useEffect(() => setPathIds([]), [root.id]);
  const path = useMemo(() => drawerWorkflowPath(root, pathIds), [root, pathIds]);
  const current = path[path.length - 1];

  function choose(node: DrawerWorkflowNode) {
    if (node.children?.length) {
      setPathIds((currentPath) => [...currentPath, node.id]);
      return;
    }
    if (node.execution) {
      onExecute(node.execution, node);
      return;
    }
    if (node.id.endsWith("-policy")) onInspectReferralPolicy(node);
  }

  return (
    <div className={styles.backdrop} role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <section className={styles.panel} role="dialog" aria-modal="true" aria-label={`${root.label} workflow`}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>Exchange workflow</p>
            <h2>{current.label}</h2>
            {record ? <p className={styles.record}>{record.title} · {record.organization}</p> : null}
          </div>
          <button className={styles.close} type="button" onClick={onClose} aria-label="Close workflow">×</button>
        </header>

        <nav className={styles.breadcrumbs} aria-label="Workflow path">
          {path.map((item, index) => (
            <button key={item.id} type="button" aria-current={index === path.length - 1 ? "step" : undefined}
              onClick={() => setPathIds(path.slice(1, index + 1).map((entry) => entry.id))}>{item.label}</button>
          ))}
        </nav>

        {current.description ? <p className={styles.description}>{current.description}</p> : null}
        {current.execution && current.execution.kind !== "outcome" ? (
          <button className={styles.primary} type="button" onClick={() => onExecute(current.execution!, current)}>Continue: {current.label}</button>
        ) : null}

        {current.children?.length ? (
          <div className={styles.tree} role="list" aria-label={`${current.label} next steps`}>
            {current.children.map((child) => (
              <button className={styles.node} type="button" role="listitem" key={child.id} onClick={() => choose(child)}>
                <span className={styles.nodeKind}>{child.kind}</span>
                <strong>{child.label}</strong>
                {child.description ? <small>{child.description}</small> : null}
                <span className={styles.chevron} aria-hidden>{child.children?.length ? "›" : child.execution?.kind === "outcome" ? "✓" : "→"}</span>
              </button>
            ))}
          </div>
        ) : current.execution?.kind === "outcome" ? (
          <div className={styles.outcome} role="status"><strong>{current.label}</strong><span>This is a terminal outcome defined by the source workflow.</span></div>
        ) : !current.execution && !current.id.endsWith("-policy") ? (
          <div className={styles.outcome}><strong>No additional child workflow is defined in the source.</strong></div>
        ) : null}

        {current.id.endsWith("-policy") ? <button className={styles.primary} type="button" onClick={() => onInspectReferralPolicy(current)}>Load recipient policy / fee</button> : null}

        <footer className={styles.footer}>
          {pathIds.length ? <button type="button" onClick={() => setPathIds((currentPath) => currentPath.slice(0, -1))}>← Back</button> : null}
          <button type="button" onClick={onClose}>Close</button>
        </footer>
      </section>
    </div>
  );
}
