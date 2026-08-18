"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  findPublicNavigationPath,
  PUBLIC_FOOTER_NAVIGATION_TREE,
  type PublicNavigationNode,
} from "@/lib/public/navigation";
import styles from "./public-shell.module.css";

function initialHash() {
  return typeof window === "undefined" ? "" : window.location.hash;
}

export function PublicHierarchyNav() {
  const pathname = usePathname();
  const [hash, setHash] = useState(initialHash);
  const activePath = useMemo(
    () => findPublicNavigationPath(pathname, hash),
    [pathname, hash],
  );
  const activeIds = useMemo(() => new Set(activePath.map((node) => node.id)), [activePath]);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash);
    setHash(window.location.hash);
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [pathname]);

  useEffect(() => {
    setExpanded((current) => {
      const next = new Set(current);
      for (const node of activePath) {
        if (node.children?.length) next.add(node.id);
      }
      return next;
    });
  }, [activePath]);

  function toggle(nodeId: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }

  function renderNode(node: PublicNavigationNode, depth: number) {
    const hasChildren = Boolean(node.children?.length);
    const isExpanded = expanded.has(node.id);
    const isActive = activeIds.has(node.id);
    const isLeafActive = activePath.at(-1)?.id === node.id;

    return (
      <li className={styles.treeItem} data-depth={depth} key={node.id}>
        <div className={`${styles.treeRow} ${isActive ? styles.treeRowActive : ""}`}>
          {node.href ? (
            <Link
              className={styles.treeLink}
              href={node.href}
              aria-current={isLeafActive ? "location" : undefined}
            >
              {node.label}
            </Link>
          ) : (
            <span className={styles.treeLabel}>{node.label}</span>
          )}
          {hasChildren ? (
            <button
              className={styles.treeToggle}
              type="button"
              onClick={() => toggle(node.id)}
              aria-expanded={isExpanded}
              aria-label={`${isExpanded ? "Collapse" : "Expand"} ${node.label}`}
            >
              {isExpanded ? "−" : "+"}
            </button>
          ) : null}
        </div>
        {hasChildren && isExpanded ? (
          <ul className={styles.treeChildren}>
            {node.children?.map((child) => renderNode(child, depth + 1))}
          </ul>
        ) : null}
      </li>
    );
  }

  return (
    <nav className={styles.hierarchyNav} aria-label="Public acquisition hierarchy">
      <div className={styles.hierarchyHeader}>
        <p className={styles.eyebrow}>Navigation hierarchy</p>
        <h2>{PUBLIC_FOOTER_NAVIGATION_TREE.label}</h2>
      </div>
      <ul className={styles.treeRoot}>
        {PUBLIC_FOOTER_NAVIGATION_TREE.children?.map((child) => renderNode(child, 0))}
      </ul>
    </nav>
  );
}
