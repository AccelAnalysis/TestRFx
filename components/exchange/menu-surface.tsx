"use client";

import { useEffect, useMemo, useState } from "react";
import {
  canNavigateMenuNode,
  describeMenuDestination,
  destructiveImpactChecks,
  isMenuNodeOperational,
  menuNodeById,
  menuSectionById,
  menuSignOutNode,
  referenceMenuContext,
  type MenuNode,
  type MenuSectionId,
  type MenuViewerContext,
} from "@/lib/exchange/menu";
import styles from "./menu-surface.module.css";

const sectionGroups: { label: string; ids: MenuSectionId[] }[] = [
  { label: "Identity & organization", ids: ["organization", "profile", "security", "settings"] },
  { label: "Exchange activity", ids: ["referrals", "communications", "saved"] },
  { label: "Membership & data", ids: ["billing", "privacy"] },
  { label: "Support", ids: ["support", "about"] },
];

function scopeLabel(scope: string) {
  if (scope === "cross-lens") return "Cross-lens";
  if (scope === "organization") return "Organization";
  if (scope === "user") return "Personal";
  return "Platform";
}

function kindLabel(node: MenuNode) {
  if (node.kind === "workflow") return "Workflow";
  if (node.kind === "confirmation") return "Confirmation";
  if (node.kind === "handoff") return "Connected handoff";
  if (node.kind === "submenu") return "Submenu";
  if (node.kind === "section") return "Menu section";
  return "Task surface";
}

function childStatus(node: MenuNode) {
  if (node.children?.length) return node.kind === "workflow" ? `${node.children.length} steps` : `${node.children.length} options`;
  return isMenuNodeOperational(node) ? "Available" : "Defined";
}

export function MenuSurface({
  onClose,
  context = referenceMenuContext,
}: {
  onClose: () => void;
  context?: MenuViewerContext;
}) {
  const [navigationStack, setNavigationStack] = useState<string[]>([]);
  const activeNode = navigationStack.length ? menuNodeById[navigationStack[navigationStack.length - 1]] : undefined;
  const breadcrumbNodes = useMemo(
    () => navigationStack.map((id) => menuNodeById[id]).filter(Boolean),
    [navigationStack],
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (navigationStack.length) {
        setNavigationStack((stack) => stack.slice(0, -1));
        return;
      }
      onClose();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigationStack.length, onClose]);

  function navigate(node: MenuNode) {
    if (!canNavigateMenuNode(node)) return;
    setNavigationStack((stack) => [...stack, node.id]);
  }

  function goBack() {
    setNavigationStack((stack) => stack.slice(0, -1));
  }

  const title = activeNode?.label ?? "Menu";
  const eyebrow = activeNode ? `${scopeLabel(activeNode.scope)} · ${kindLabel(activeNode)}` : "Cross-lens utilities";

  return (
    <div
      className={styles.backdrop}
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section className={styles.surface} role="dialog" aria-modal="true" aria-labelledby="exchange-menu-title">
        <header className={styles.header}>
          {activeNode ? (
            <button className={styles.backButton} type="button" onClick={goBack} aria-label="Back one Menu level">
              ← Back
            </button>
          ) : null}
          <div className={styles.heading}>
            <p className={styles.eyebrow}>{eyebrow}</p>
            <h2 id="exchange-menu-title">{title}</h2>
          </div>
          <button className={styles.headerButton} type="button" onClick={onClose} aria-label="Close Menu">
            ×
          </button>
        </header>

        {breadcrumbNodes.length > 1 ? (
          <div className={styles.breadcrumbs} aria-label="Menu location">
            <button type="button" onClick={() => setNavigationStack([])}>Menu</button>
            {breadcrumbNodes.map((node, index) => (
              <span key={node.id}>
                <span aria-hidden>›</span>
                <button
                  type="button"
                  aria-current={index === breadcrumbNodes.length - 1 ? "page" : undefined}
                  onClick={() => setNavigationStack((stack) => stack.slice(0, index + 1))}
                >
                  {node.label}
                </button>
              </span>
            ))}
          </div>
        ) : null}

        <div className={styles.scroll}>
          {!activeNode ? (
            <>
              <div className={styles.contextCard}>
                <span className={styles.avatar} aria-hidden>{context.organizationInitials}</span>
                <div className={styles.contextCopy}>
                  <strong>{context.organizationName}</strong>
                  <span>{context.organizationRole}</span>
                  <small>{context.membershipLabel}</small>
                </div>
                <button
                  className={styles.contextAction}
                  type="button"
                  disabled={context.organizationCount < 2}
                  title={context.organizationCount < 2 ? "Organization switching becomes available when the member belongs to multiple organizations." : undefined}
                  onClick={() => {
                    if (context.organizationCount > 1) navigate(menuNodeById["switch-active-organization"]);
                  }}
                >
                  {context.organizationCount > 1 ? "Switch" : "Active org"}
                </button>
              </div>

              <div className={styles.memberRow}>
                <span><strong>{context.userName}</strong> · {context.userEmail}</span>
                <span>{context.organizationCount} org{context.organizationCount === 1 ? "" : "s"}</span>
              </div>

              {sectionGroups.map((group) => (
                <div key={group.label}>
                  <p className={styles.groupLabel}>{group.label}</p>
                  <div className={styles.sectionList}>
                    {group.ids.map((id) => {
                      const section = menuSectionById[id];
                      return (
                        <button className={styles.sectionButton} type="button" key={section.id} onClick={() => navigate(section)}>
                          <span className={styles.icon} aria-hidden>{section.icon}</span>
                          <span className={styles.sectionCopy}>
                            <strong>{section.label}</strong>
                            <small>{section.description}</small>
                          </span>
                          <span className={styles.chevron} aria-hidden>›</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              <button className={styles.signOutButton} type="button" onClick={() => navigate(menuSignOutNode)}>
                <span className={styles.icon} aria-hidden>{menuSignOutNode.icon}</span>
                <span className={styles.sectionCopy}>
                  <strong>{menuSignOutNode.label}</strong>
                  <small>{menuSignOutNode.description}</small>
                </span>
                <span className={styles.chevron} aria-hidden>›</span>
              </button>

              <p className={styles.notice}>
                Menu is a utility overlay, not an Exchange lens. Opening and closing it leaves the active lens, map, search, drawer, selection, and detail state mounted underneath.
              </p>
            </>
          ) : null}

          {activeNode ? (
            <>
              <div className={activeNode.destructive ? `${styles.sectionIntro} ${styles.dangerIntro}` : styles.sectionIntro}>
                <div className={styles.introMeta}>
                  <span className={styles.scope}>{scopeLabel(activeNode.scope)}</span>
                  <span className={styles.kind}>{kindLabel(activeNode)}</span>
                  {activeNode.requiredRole ? <span className={styles.role}>{activeNode.requiredRole}</span> : null}
                </div>
                <p>{activeNode.description}</p>
              </div>

              {activeNode.children?.length ? (
                <div className={styles.actionList}>
                  {activeNode.children.map((child) => (
                    <button
                      className={child.destructive ? `${styles.actionButton} ${styles.destructive}` : styles.actionButton}
                      type="button"
                      key={child.id}
                      onClick={() => navigate(child)}
                    >
                      <span className={styles.icon} aria-hidden>{child.icon}</span>
                      <span className={styles.actionCopy}>
                        <strong>{child.label}</strong>
                        <small>{child.description}</small>
                      </span>
                      <span className={child.children?.length ? `${styles.status} ${styles.statusOpen}` : styles.status}>
                        {childStatus(child)}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className={styles.destinationCard}>
                  <div className={styles.destinationHeading}>
                    <span className={styles.icon} aria-hidden>{activeNode.icon}</span>
                    <div>
                      <span className={styles.scope}>{kindLabel(activeNode)}</span>
                      <h3>{activeNode.label}</h3>
                    </div>
                  </div>

                  {activeNode.details?.length ? (
                    <ul className={styles.detailList}>
                      {activeNode.details.map((detail) => <li key={detail}>{detail}</li>)}
                    </ul>
                  ) : (
                    <p className={styles.destinationCopy}>{activeNode.description}</p>
                  )}

                  <div className={styles.destinationMeta}>
                    <span>{describeMenuDestination(activeNode)}</span>
                    <span>{isMenuNodeOperational(activeNode) ? "Operational" : "Production integration point"}</span>
                  </div>

                  {activeNode.destructive ? (
                    <div className={styles.impactChecks}>
                      <strong>Shared destructive-action checks</strong>
                      <ul>
                        {destructiveImpactChecks.map((check) => <li key={check}>{check}</li>)}
                      </ul>
                    </div>
                  ) : null}

                  <div className={styles.destinationActions}>
                    <button type="button" onClick={goBack}>Back</button>
                    <button
                      type="button"
                      disabled={!isMenuNodeOperational(activeNode)}
                      title={!isMenuNodeOperational(activeNode) ? "The destination is structurally defined; connect the production service to execute it." : undefined}
                    >
                      {activeNode.kind === "handoff" ? "Open destination" : activeNode.kind === "confirmation" ? "Confirm" : "Continue"}
                    </button>
                  </div>
                </div>
              )}

              <p className={styles.notice}>
                Structural navigation stays available even while a downstream service is not operational. The final execution control remains disabled until the server-backed service, authorization, and dependency checks are connected.
              </p>
            </>
          ) : null}
        </div>
      </section>
    </div>
  );
}
