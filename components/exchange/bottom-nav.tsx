"use client";

import { lensDefinitions, lensOrder } from "@/lib/exchange/lenses";
import type { ExchangeLens } from "@/lib/exchange/contracts";
import styles from "./bottom-nav.module.css";

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
    <nav className={styles.nav} aria-label="Exchange navigation">
      {lensOrder.map((lens) => {
        const definition = lensDefinitions[lens];
        return (
          <button key={lens} className={activeLens === lens ? styles.active : ""} aria-current={activeLens === lens ? "page" : undefined} onClick={() => onLensChange(lens)}>
            <span className={styles.icon} aria-hidden>{definition.icon}</span>
            <span>{definition.label}</span>
          </button>
        );
      })}
      <button onClick={onMenu} aria-haspopup="dialog" aria-expanded={menuOpen} aria-label="Open Menu utilities">
        <span className={styles.icon} aria-hidden>☰</span>
        <span>Menu</span>
      </button>
    </nav>
  );
}
