"use client";

import styles from "./floating-controls.module.css";

export function SearchControls({ value, placeholder, onChange }: { value: string; placeholder: string; onChange: (value: string) => void }) {
  return (
    <div className={styles.searchDock}>
      <label className="search-surface">
        <span aria-hidden>⌕</span>
        <span className="sr-only">Search Exchange</span>
        <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
        {value ? <button aria-label="Clear search" className="inline-clear" onClick={() => onChange("")} type="button">×</button> : null}
      </label>
    </div>
  );
}
