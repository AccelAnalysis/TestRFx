"use client";

import { lensDefinitions, lensOrder } from "@/lib/exchange/lenses";
import type { ExchangeLens } from "@/lib/exchange/contracts";

export function BottomNav({ activeLens, onLensChange, onMenu }: { activeLens: ExchangeLens; onLensChange: (lens: ExchangeLens) => void; onMenu: () => void }) {
  return (
    <nav className="bottom-nav" aria-label="Exchange lenses">
      {lensOrder.map((lens) => {
        const definition = lensDefinitions[lens];
        return (
          <button key={lens} className={activeLens === lens ? "active" : ""} aria-current={activeLens === lens ? "page" : undefined} onClick={() => onLensChange(lens)}>
            <span className="nav-icon" aria-hidden>{definition.icon}</span>
            <span>{definition.label}</span>
          </button>
        );
      })}
      <button onClick={onMenu}>
        <span className="nav-icon" aria-hidden>☰</span>
        <span>Menu</span>
      </button>
    </nav>
  );
}
