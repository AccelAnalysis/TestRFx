"use client";

import { useEffect, useState } from "react";
import {
  isMenuActionEnabled,
  menuSectionById,
  menuSignOutAction,
  referenceMenuContext,
  type MenuSectionId,
  type MenuViewerContext,
} from "@/lib/exchange/menu";
import styles from "./menu-surface.module.css";

const menuSectionHandoffKey = "rfxchange:menu-section-handoff";
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

export function MenuSurface({
  onClose,
  context = referenceMenuContext,
  initialSectionId,
}: {
  onClose: () => void;
  context?: MenuViewerContext;
  initialSectionId?: MenuSectionId;
}) {
  const [activeSectionId, setActiveSectionId] = useState<MenuSectionId | undefined>(initialSectionId);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const activeSection = activeSectionId ? menuSectionById[activeSectionId] : undefined;

  useEffect(() => {
    if (initialSectionId) {
      setActiveSectionId(initialSectionId);
      return;
    }
    try {
      const handoff = sessionStorage.getItem(menuSectionHandoffKey) as MenuSectionId | null;
      if (handoff && menuSectionById[handoff]) {
        setActiveSectionId(handoff);
        sessionStorage.removeItem(menuSectionHandoffKey);
      }
    } catch {}
  }, [initialSectionId]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (confirmSignOut) {
        setConfirmSignOut(false);
        return;
      }
      if (activeSectionId) {
        setActiveSectionId(undefined);
        return;
      }
      onClose();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeSectionId, confirmSignOut, onClose]);

  function goBack() {
    if (confirmSignOut) {
      setConfirmSignOut(false);
      return;
    }
    setActiveSectionId(undefined);
  }

  const title = confirmSignOut ? "Sign out" : activeSection?.label ?? "Menu";
  const eyebrow = activeSection ? scopeLabel(activeSection.scope) : "Cross-lens utilities";

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
          {activeSection || confirmSignOut ? (
            <button className={styles.backButton} type="button" onClick={goBack} aria-label="Back to Menu">
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

        <div className={styles.scroll}>
          {!activeSection && !confirmSignOut ? (
            <>
              <div className={styles.contextCard}>
                <span className={styles.avatar} aria-hidden>{context.organizationInitials}</span>
                <div className={styles.contextCopy}>
                  <strong>{context.organizationName}</strong>
                  <span>{context.organizationRole}</span>
                  <small>{context.membershipLabel}</small>
                </div>
                <button className={styles.contextAction} type="button" disabled={context.organizationCount < 2} title={context.organizationCount < 2 ? "Organization switching becomes available when the member belongs to multiple organizations." : undefined}>
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
                        <button className={styles.sectionButton} type="button" key={section.id} onClick={() => setActiveSectionId(section.id)}>
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

              <button className={styles.signOutButton} type="button" onClick={() => setConfirmSignOut(true)}>
                <span className={styles.icon} aria-hidden>{menuSignOutAction.icon}</span>
                <span className={styles.sectionCopy}>
                  <strong>{menuSignOutAction.label}</strong>
                  <small>{menuSignOutAction.description}</small>
                </span>
                <span className={styles.chevron} aria-hidden>›</span>
              </button>

              <p className={styles.notice}>
                Menu is a utility overlay, not an Exchange lens. Opening and closing it leaves the active lens, map, search, drawer, selection, and detail state mounted underneath. Utility workflows remain visible as governed integration points until their production services are connected.
              </p>
            </>
          ) : null}

          {activeSection && !confirmSignOut ? (
            <>
              <div className={styles.sectionIntro}>
                <span className={styles.scope}>{scopeLabel(activeSection.scope)} utility</span>
                <p>{activeSection.description}</p>
              </div>
              <div className={styles.actionList}>
                {activeSection.actions.map((actionDefinition) => {
                  const enabled = isMenuActionEnabled(actionDefinition);
                  const className = actionDefinition.destructive
                    ? `${styles.actionButton} ${styles.destructive}`
                    : styles.actionButton;
                  return (
                    <button
                      className={className}
                      type="button"
                      key={actionDefinition.id}
                      disabled={!enabled}
                      aria-disabled={!enabled}
                      title={!enabled ? "Production workflow integration point" : undefined}
                    >
                      <span className={styles.icon} aria-hidden>{actionDefinition.icon}</span>
                      <span className={styles.actionCopy}>
                        <strong>{actionDefinition.label}</strong>
                        <small>{actionDefinition.description}</small>
                      </span>
                      <span className={enabled ? `${styles.status} ${styles.statusLive}` : styles.status}>
                        {enabled ? "Available" : "Integration point"}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className={styles.notice}>
                This surface defines the stable Menu contract. Identity, organization, referral, billing, notification, relationship, privacy, support, and audit services should replace these integration boundaries without adding new persistent bottom-navigation destinations.
              </p>
            </>
          ) : null}

          {confirmSignOut ? (
            <div className={styles.confirmCard}>
              <span className={styles.scope}>Identity service boundary</span>
              <h3>End this RFxchange session?</h3>
              <p>
                Sign out is intentionally not simulated by the reference chassis. Production must invalidate the authenticated session server-side before returning to the Identity shell.
              </p>
              <div className={styles.confirmActions}>
                <button type="button" onClick={() => setConfirmSignOut(false)}>Cancel</button>
                <button type="button" disabled title="Connect the production identity/session service to enable sign out.">Sign out</button>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
