"use client";

import type { LensAction } from "@/lib/exchange/contracts";

export function ActionRail({ actions }: { actions: LensAction[] }) {
  return (
    <div className="action-rail" aria-label="Lens actions">
      {actions.filter((item) => item.visible).map((item) => (
        <button
          key={item.id}
          type="button"
          disabled={!item.operational || !item.authorized || !item.applicable}
          title={!item.operational ? item.unavailableReason : item.label}
        >
          <span aria-hidden>{item.icon}</span>
          <small>{item.label}</small>
        </button>
      ))}
    </div>
  );
}
