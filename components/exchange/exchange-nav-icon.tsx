"use client";

import {
  Blocks,
  Eye,
  FileSearch,
  History,
  KeyRound,
  Layers3,
  Menu,
  Radar,
  RefreshCcw,
  SearchCheck,
  SlidersHorizontal,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import type { ExchangeLensIconId } from "@/lib/exchange/contracts";

export type ExchangeUiIconId =
  | ExchangeLensIconId
  | "menu"
  | "my-records"
  | "match-rfx"
  | "personal-profile"
  | "security-key"
  | "application-preferences"
  | "timeline"
  | "membership-lifecycle"
  | "watching";

const iconComponents = {
  "opportunity-document": FileSearch,
  "resource-ecosystem": Blocks,
  "intelligence-signal": Radar,
  "capability-stack": Layers3,
  menu: Menu,
  "my-records": UserRound,
  "match-rfx": SearchCheck,
  "personal-profile": UserRound,
  "security-key": KeyRound,
  "application-preferences": SlidersHorizontal,
  timeline: History,
  "membership-lifecycle": RefreshCcw,
  watching: Eye,
} satisfies Record<ExchangeUiIconId, LucideIcon>;

export function isExchangeUiIconId(value: string): value is ExchangeUiIconId {
  return value in iconComponents;
}

export function ExchangeIcon({
  icon,
  size = 23,
  strokeWidth = 1.9,
}: {
  icon: ExchangeUiIconId;
  size?: number;
  strokeWidth?: number;
}) {
  const Icon = iconComponents[icon];

  return (
    <Icon
      data-exchange-icon={icon}
      data-exchange-nav-icon={icon}
      width={size}
      height={size}
      strokeWidth={strokeWidth}
      aria-hidden="true"
      focusable="false"
    />
  );
}

export function ExchangeNavIcon(props: Parameters<typeof ExchangeIcon>[0]) {
  return <ExchangeIcon {...props} />;
}
