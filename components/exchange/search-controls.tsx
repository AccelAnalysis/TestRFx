"use client";

export function SearchControls({ value, placeholder, onChange, onResetView }: { value: string; placeholder: string; onChange: (value: string) => void; onResetView: () => void }) {
  return (
    <div className="floating-controls">
      <label className="search-surface">
        <span aria-hidden>⌕</span>
        <span className="sr-only">Search Exchange</span>
        <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
        {value ? <button aria-label="Clear search" className="inline-clear" onClick={() => onChange("")} type="button">×</button> : null}
      </label>
      <button className="glass-button" type="button" aria-label="Filters">≡</button>
      <button className="glass-button" type="button" aria-label="Reset map view" onClick={onResetView}>◎</button>
    </div>
  );
}
