"use client";

import { lensDefinitions, lensOrder } from "@/lib/exchange/lenses";
import type { ExchangeLens } from "@/lib/exchange/contracts";

export function BottomNav({
  activeLens,
  menuOpen,
  onLensChange,
  onMenu,
}: {
  activeLens: ExchangeLens;
  menuOpen?: boolean;
  onLensChange: (lens: ExchangeLens) => void;
  onMenu: () => void;
}) {
  return (
    <nav className="bottom-nav" aria-label="Exchange navigation">
      {lensOrder.map((lens) => {
        const definition = lensDefinitions[lens];
        return (
          <button key={lens} className={activeLens === lens ? "active" : ""} aria-current={activeLens === lens ? "page" : undefined} onClick={() => onLensChange(lens)}>
            <span className="nav-icon" aria-hidden>{definition.icon}</span>
            <span>{definition.label}</span>
          </button>
        );
      })}
      <button onClick={onMenu} aria-haspopup="dialog" aria-expanded={menuOpen} aria-label="Open Menu utilities">
        <span className="nav-icon" aria-hidden>☰</span>
        <span>Menu</span>
      </button>
    </nav>
  );
}
