"use client";

import type { LensAction } from "@/lib/exchange/contracts";
import { getLensActionUnavailableReason, isLensActionEnabled } from "@/lib/exchange/action-registry";
import styles from "./action-rail.module.css";

function statusLabel(action: LensAction, active: boolean) {
  if (active) {
    if (!action.toggle) return "Active";
    return action.toggle === "save" ? "Saved" : action.toggle === "watch" ? "Watching" : action.toggle === "track" ? "Tracking" : "Following";
  }
  if (!action.operational) return "Soon";
  if (!action.applicable) return "Select";
  if (!action.authorized) return "Locked";
  if (!action.prerequisitesSatisfied) return "Setup";
  if (action.toggle) return action.toggle === "save" ? "Save" : action.toggle === "watch" ? "Watch" : action.toggle === "track" ? "Track" : "Follow";
  return "";
}

export function ActionRail({
  actions,
  activeActionIds = [],
  onAction,
  label = "Lens controls",
}: {
  actions: LensAction[];
  activeActionIds?: string[];
  onAction?: (action: LensAction) => void;
  label?: string;
}) {
  const ordered = [...actions].sort((a, b) => a.position - b.position);
  const slots = [1, 2, 3, 4] as const;

  return (
    <div className={styles.railShell}>
      <div className={styles.rail} aria-label={label}>
        {slots.map((position) => {
          const item = ordered.find((action) => action.position === position);
          if (!item || !item.visible) return <span key={position} className={styles.placeholder} aria-hidden="true" />;

          const enabled = isLensActionEnabled(item);
          const active = activeActionIds.includes(item.id);
          const unavailableReason = getLensActionUnavailableReason(item);
          const accessibleLabel = unavailableReason ? `${item.label}. ${unavailableReason}` : item.label;

          return (
            <button
              key={`${position}-${item.id}`}
              className={`${styles.action}${active ? ` ${styles.active}` : ""}`}
              type="button"
              disabled={!enabled}
              title={unavailableReason ?? item.label}
              aria-label={accessibleLabel}
              aria-pressed={active ? true : undefined}
              onClick={() => onAction?.(item)}
            >
              <span className={styles.icon} aria-hidden>{active && item.toggle ? "★" : item.icon}</span>
              <span className={styles.label}>{item.label}</span>
              <span className={styles.state} aria-hidden>{statusLabel(item, active)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
