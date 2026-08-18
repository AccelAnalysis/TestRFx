"use client";

import { useMemo, useState } from "react";
import type { ExchangeRecord } from "@/lib/exchange/contracts";
import { findWorkflowNode, workflowBreadcrumbs, type LensActionWorkflow, type LensWorkflowNode, type LensWorkflowTarget } from "@/lib/exchange/action-workflows";
import styles from "./lens-action-workflow-surface.module.css";

function kindLabel(node: LensWorkflowNode) {
  if (node.kind === "decision") return "Decision";
  if (node.kind === "outcome") return "Outcome";
  if (node.kind === "handoff") return "Handoff";
  return node.children?.length ? "Workflow" : "Action";
}

export function LensActionWorkflowSurface({ workflow, record, onClose, onTarget }: {
  workflow: LensActionWorkflow;
  record?: ExchangeRecord;
  onClose: () => void;
  onTarget: (target: LensWorkflowTarget, node: LensWorkflowNode) => void;
}) {
  const [path, setPath] = useState<string[]>([]);
  const current = useMemo(() => findWorkflowNode(workflow.root, path) ?? workflow.root, [workflow, path]);
  const breadcrumbs = useMemo(() => workflowBreadcrumbs(workflow.root, path), [workflow, path]);

  function openNode(node: LensWorkflowNode) {
    if (node.children?.length) {
      setPath((currentPath) => [...currentPath, node.id]);
      return;
    }
    if (node.target) onTarget(node.target, node);
  }

  function goBack() {
    if (path.length) setPath((currentPath) => currentPath.slice(0, -1));
    else onClose();
  }

  return (
    <div className={styles.backdrop} role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <section className={styles.surface} role="dialog" aria-modal="true" aria-label={`${workflow.title} workflow`}>
        <header className={styles.header}>
          <button className={styles.back} type="button" onClick={goBack}>{path.length ? "← Back" : "← Exchange"}</button>
          <div>
            <p className={styles.eyebrow}>{workflow.lens} · {workflow.ownership === "own" ? "Own organization" : "Other organization"}</p>
            <h2>{current.label}</h2>
          </div>
          <button className={styles.close} type="button" onClick={onClose} aria-label="Close workflow">×</button>
        </header>

        <nav className={styles.breadcrumbs} aria-label="Workflow path">
          {breadcrumbs.map((crumb, index) => <span key={`${crumb.id}-${index}`}>{index ? "›" : ""} {crumb.label}</span>)}
        </nav>

        {record ? <div className={styles.context}><strong>{record.title}</strong><span>{record.organization} · {record.geography}</span></div> : null}
        {current.description ? <p className={styles.description}>{current.description}</p> : null}

        {current.children?.length ? (
          <div className={styles.tree}>
            {current.children.map((child, index) => (
              <button className={styles.node} type="button" key={child.id} onClick={() => openNode(child)}>
                <span className={styles.index}>{index + 1}</span>
                <span className={styles.nodeCopy}>
                  <small>{kindLabel(child)}</small>
                  <strong>{child.label}</strong>
                  {child.description ? <em>{child.description}</em> : null}
                </span>
                <span className={styles.chevron}>{child.children?.length ? "›" : "→"}</span>
              </button>
            ))}
          </div>
        ) : current.target ? (
          <div className={styles.leaf}>
            <p>This step is ready to hand off to its owning RFxchange service without leaving the mounted Exchange shell.</p>
            <button className={styles.primary} type="button" onClick={() => onTarget(current.target!, current)}>Continue: {current.label}</button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
