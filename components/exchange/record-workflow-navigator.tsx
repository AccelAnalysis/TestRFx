"use client";

import type { ExchangeRecord } from "@/lib/exchange/contracts";
import { getChildrenAtPath, getNodeAtPath, getRecordNavigationTree, type RecordNavigationNode } from "@/lib/exchange/record-navigation";
import { isRecordNavigationCommandOperational, recordNavigationUnavailableReason } from "@/lib/exchange/record-navigation-runtime";
import styles from "./record-workflow-navigator.module.css";

export function RecordWorkflowNavigator({
  record,
  path,
  onPathChange,
  onExecute,
}: {
  record: ExchangeRecord;
  path: string[];
  onPathChange: (path: string[]) => void;
  onExecute: (node: RecordNavigationNode) => void;
}) {
  const tree = getRecordNavigationTree(record);
  const current = path.length ? getNodeAtPath(tree, path) : undefined;
  const children = getChildrenAtPath(tree, path);
  const unavailable = current ? recordNavigationUnavailableReason(current) : undefined;
  const operational = current ? isRecordNavigationCommandOperational(current) : false;

  return (
    <section className={styles.navigator} aria-label="Record workflow navigation">
      <div className={styles.header}>
        <div>
          <p>{tree.ownership === "own" ? "Own organization" : "Other organization"}</p>
          <h2>Record workflows</h2>
        </div>
        <span className={styles.kind}>{record.type}</span>
      </div>

      <nav className={styles.breadcrumbs} aria-label="Workflow path">
        <button type="button" onClick={() => onPathChange([])}>Record</button>
        {path.map((id, index) => {
          const node = getNodeAtPath(tree, path.slice(0, index + 1));
          if (!node) return null;
          return <span key={id}><span className={styles.separator} aria-hidden>›</span><button type="button" onClick={() => onPathChange(path.slice(0, index + 1))}>{node.label}</button></span>;
        })}
      </nav>

      {current ? (
        <div className={styles.current}>
          <h3>{current.label}</h3>
          {current.description ? <p>{current.description}</p> : null}
          {current.kind === "outcome" && !current.children?.length ? <div className={styles.outcome}>This is a source-defined workflow outcome, not a separate action.</div> : null}
          {unavailable ? <div className={styles.unavailable} role="status">{unavailable}</div> : null}
          {operational ? <div className={styles.actions}><button className={styles.primary} type="button" onClick={() => onExecute(current)}>Open workflow</button></div> : null}
        </div>
      ) : null}

      {children.length ? (
        <div className={styles.grid}>
          {children.map((node) => (
            <button key={node.id} className={styles.node} type="button" onClick={() => onPathChange([...path, node.id])}>
              <span><strong>{node.label}</strong>{node.description ? <small>{node.description}</small> : null}</span>
              <span className={styles.kind}>{node.children?.length ? `${node.children.length} child${node.children.length === 1 ? "" : "ren"}` : node.kind}</span>
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
