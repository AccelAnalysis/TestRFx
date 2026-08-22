"use client";

import { capabilityNavigationPath, capabilityNavigationTree, type CapabilityNavigationNode, type CapabilityNavigationNodeId } from "@/lib/capabilities/navigation";
import styles from "./capabilities.module.css";

function Branch({ node, activeNodeId, selectedOtherAvailable, onNavigate }: {
  node: CapabilityNavigationNode;
  activeNodeId?: CapabilityNavigationNodeId;
  selectedOtherAvailable: boolean;
  onNavigate: (id: CapabilityNavigationNodeId) => void;
}) {
  const activePath = activeNodeId ? capabilityNavigationPath(activeNodeId) : [];
  const disabled = Boolean((node.scope === "own" && selectedOtherAvailable) || (node.requiresSelectedOther && !selectedOtherAvailable));
  return <li className={styles.treeItem}>
    <button type="button" className={`${styles.treeButton} ${node.id === activeNodeId ? styles.treeActive : ""}`} disabled={disabled} onClick={() => onNavigate(node.id)} aria-current={node.id === activeNodeId ? "step" : undefined}>
      <span>{node.label}</span>{activePath.includes(node.id) && node.id !== activeNodeId ? <small>›</small> : null}
    </button>
    {node.children?.length ? <ul className={styles.treeChildren}>{node.children.map((child) => <Branch key={child.id} node={child} activeNodeId={activeNodeId} selectedOtherAvailable={selectedOtherAvailable} onNavigate={onNavigate} />)}</ul> : null}
  </li>;
}

export function CapabilityHierarchy({ activeNodeId, selectedOtherAvailable, onNavigate }: {
  activeNodeId?: CapabilityNavigationNodeId;
  selectedOtherAvailable: boolean;
  onNavigate: (id: CapabilityNavigationNodeId) => void;
}) {
  const branches = capabilityNavigationTree.children ?? [];
  return <nav className={styles.tree} aria-label="Capabilities workflows">
    {branches.map((branch) => <details className={styles.treeBranch} key={branch.id} open={activeNodeId ? capabilityNavigationPath(activeNodeId).includes(branch.id) : branch.scope === (selectedOtherAvailable ? "other" : "own")}>
      <summary>{branch.label}</summary>
      <ul className={styles.treeRoot}>{branch.children?.map((child) => <Branch key={child.id} node={child} activeNodeId={activeNodeId} selectedOtherAvailable={selectedOtherAvailable} onNavigate={onNavigate} />)}</ul>
    </details>)}
  </nav>;
}
