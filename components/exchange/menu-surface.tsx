"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  canNavigateMenuNode,
  isMenuNodeOperational,
  menuNodeById,
  menuSectionById,
  menuSignOutNode,
  referenceMenuContext,
  type MenuNode,
  type MenuSectionId,
  type MenuViewerContext,
} from "@/lib/exchange/menu";
import { ExchangeIcon, isExchangeUiIconId } from "./exchange-nav-icon";
import { ReferralTrackingPanel } from "./referral-tracking-panel";
import styles from "./menu-surface.module.css";

const sectionGroups: { label: string; ids: MenuSectionId[] }[] = [
  { label: "Organization", ids: ["organization"] },
  { label: "Account", ids: ["profile", "security", "settings"] },
  { label: "Activity", ids: ["referrals", "communications", "saved"] },
  { label: "Membership & data", ids: ["billing", "privacy"] },
  { label: "Support", ids: ["support", "about"] },
];

function menuIcon(node: MenuNode) {
  return isExchangeUiIconId(node.icon) ? <ExchangeIcon icon={node.icon} size={19} /> : node.icon;
}

function displayLabel(node: MenuNode) {
  return node.id === "organization-logo-branding" ? "Logo & Media" : node.label;
}

function destinationHref(node: MenuNode) {
  if (node.id === "organization-logo-branding") return "/onboarding/organization-profile/organization-details/logo-branding";
  const destination = node.destination;
  if (!destination) return undefined;
  if (destination.type === "public-shell" && destination.target.startsWith("/")) return destination.target;
  if (destination.type === "exchange") return `/exchange/${destination.target.replace(/^\/+/, "")}`;
  if (destination.type === "identity-shell" && destination.target === "login") return "/login";
  return undefined;
}

function leafActionLabel(node: MenuNode) {
  if (!isMenuNodeOperational(node) && node.destination?.type === "service" && node.id !== "organization-logo-branding") return "Coming soon";
  if (node.kind === "confirmation") return "Confirm";
  if (node.kind === "handoff") return "Open";
  return "Continue";
}

export function MenuSurface({
  onClose,
  context = referenceMenuContext,
  initialSectionId,
}: {
  onClose: () => void;
  context?: MenuViewerContext;
  initialSectionId?: MenuSectionId;
}) {
  const [navigationStack, setNavigationStack] = useState<string[]>(() => initialSectionId ? [initialSectionId] : []);
  const activeNode = navigationStack.length ? menuNodeById[navigationStack[navigationStack.length - 1]] : undefined;

  useEffect(() => {
    if (initialSectionId) setNavigationStack([initialSectionId]);
  }, [initialSectionId]);

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

  function renderRow(node: MenuNode) {
    return (
      <button
        className={node.destructive ? `${styles.row} ${styles.destructiveRow}` : styles.row}
        type="button"
        key={node.id}
        onClick={() => navigate(node)}
      >
        <span className={styles.icon} aria-hidden>{menuIcon(node)}</span>
        <span className={styles.rowLabel}>{displayLabel(node)}</span>
        <span className={styles.chevron} aria-hidden>›</span>
      </button>
    );
  }

  const href = activeNode ? destinationHref(activeNode) : undefined;
  const executeEnabled = Boolean(activeNode && (isMenuNodeOperational(activeNode) || href));
  const isReferralSummary = activeNode?.id === "referral-summary";

  return (
    <div className={styles.backdrop} role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <section className={styles.surface} role="dialog" aria-modal="true" aria-labelledby="exchange-menu-title">
        <header className={styles.header}>
          {activeNode ? (
            <button className={styles.backButton} type="button" onClick={goBack} aria-label="Back">
              <span aria-hidden>‹</span>
            </button>
          ) : <span className={styles.headerSpacer} />}
          <h2 id="exchange-menu-title">{activeNode ? displayLabel(activeNode) : "Menu"}</h2>
          <button className={styles.closeButton} type="button" onClick={onClose} aria-label="Close Menu">×</button>
        </header>

        <div className={styles.scroll}>
          {!activeNode ? (
            <>
              <div className={styles.identityRow}>
                <span className={styles.avatar} aria-hidden>{context.organizationInitials}</span>
                <div>
                  <strong>{context.organizationName}</strong>
                  {context.userName && context.userName !== "Reference Member" ? <span>{context.userName}</span> : null}
                </div>
                {context.organizationCount > 1 ? (
                  <button type="button" className={styles.switchButton} onClick={() => navigate(menuNodeById["switch-active-organization"])}>Switch</button>
                ) : null}
              </div>

              {sectionGroups.map((group) => (
                <section className={styles.group} key={group.label} aria-labelledby={`menu-${group.label.replace(/\W+/g, "-").toLowerCase()}`}>
                  <h3 id={`menu-${group.label.replace(/\W+/g, "-").toLowerCase()}`}>{group.label}</h3>
                  <div className={styles.rows}>
                    {group.ids.map((id) => renderRow(menuSectionById[id]))}
                  </div>
                </section>
              ))}

              <button className={styles.signOutRow} type="button" onClick={() => navigate(menuSignOutNode)}>
                <span className={styles.icon} aria-hidden>{menuIcon(menuSignOutNode)}</span>
                <span className={styles.rowLabel}>{menuSignOutNode.label}</span>
                <span className={styles.chevron} aria-hidden>›</span>
              </button>
            </>
          ) : null}

          {activeNode?.children?.length ? (
            <div className={styles.rows}>
              {activeNode.children.map(renderRow)}
            </div>
          ) : null}

          {isReferralSummary ? <ReferralTrackingPanel /> : null}

          {activeNode && !activeNode.children?.length && !isReferralSummary ? (
            <div className={activeNode.destructive ? `${styles.leaf} ${styles.leafDanger}` : styles.leaf}>
              <div className={styles.leafIcon} aria-hidden>{menuIcon(activeNode)}</div>
              <h3>{displayLabel(activeNode)}</h3>
              {activeNode.details?.length ? (
                <ul>
                  {activeNode.details.map((detail) => <li key={detail}>{detail}</li>)}
                </ul>
              ) : null}

              {href ? (
                <Link className={styles.primaryAction} href={href}>{leafActionLabel(activeNode)}</Link>
              ) : (
                <button className={styles.primaryAction} type="button" disabled={!executeEnabled}>{leafActionLabel(activeNode)}</button>
              )}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
