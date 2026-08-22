"use client";

import type { LensAction } from "@/lib/exchange/contracts";
import { getLensActionUnavailableReason, isLensActionEnabled } from "@/lib/exchange/action-registry";
import { ExchangeIcon, isExchangeUiIconId } from "./exchange-nav-icon";
import styles from "./record-actions.module.css";

function actionIcon(action: LensAction) {
  return isExchangeUiIconId(action.icon) ? <ExchangeIcon icon={action.icon} size={14} /> : action.icon;
}

export function RecordActionRow({
  actions,
  onAction,
  label = "Record actions",
  maxVisible = 3,
}: {
  actions: LensAction[];
  onAction: (action: LensAction) => void;
  label?: string;
  maxVisible?: number;
}) {
  const visible = [...actions]
    .filter((action) => action.visible)
    .sort((left, right) => left.position - right.position)
    .slice(0, maxVisible);

  if (!visible.length) return null;

  return (
    <div className={styles.row} aria-label={label}>
      {visible.map((action, index) => {
        const enabled = isLensActionEnabled(action);
        const unavailableReason = getLensActionUnavailableReason(action);
        const accessibleLabel = unavailableReason ? `${action.label}. ${unavailableReason}` : action.label;
        return (
          <button
            key={action.id}
            type="button"
            className={`${styles.action}${index === 0 ? ` ${styles.primary}` : ""}`}
            disabled={!enabled}
            title={unavailableReason ?? action.label}
            aria-label={accessibleLabel}
            onClick={() => onAction(action)}
          >
            <span className={styles.icon} aria-hidden>{actionIcon(action)}</span>
            <span>{action.label}</span>
          </button>
        );
      })}
    </div>
  );
}
