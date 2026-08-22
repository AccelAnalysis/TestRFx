"use client";

import { Blocks, FileSearch, Layers3, Menu, Radar, type LucideIcon } from "lucide-react";
import type { ExchangeLensIconId } from "@/lib/exchange/contracts";

type ExchangeNavIconId = ExchangeLensIconId | "menu";

const iconComponents = {
  "opportunity-document": FileSearch,
  "resource-ecosystem": Blocks,
  "intelligence-signal": Radar,
  "capability-stack": Layers3,
  menu: Menu,
} satisfies Record<ExchangeNavIconId, LucideIcon>;

export function ExchangeNavIcon({
  icon,
  size = 23,
  strokeWidth = 1.9,
}: {
  icon: ExchangeNavIconId;
  size?: number;
  strokeWidth?: number;
}) {
  const Icon = iconComponents[icon];

  return (
    <Icon
      data-exchange-nav-icon={icon}
      width={size}
      height={size}
      strokeWidth={strokeWidth}
      aria-hidden="true"
      focusable="false"
    />
  );
}
