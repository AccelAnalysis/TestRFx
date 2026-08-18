"use client";

const items = ["Organization Profile", "Account", "Membership", "Notifications", "Saved", "Referrals", "Settings", "Help & Support"];

export function MenuSurface({ onClose }: { onClose: () => void }) {
  return (
    <div className="menu-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <section className="menu-surface" role="dialog" aria-modal="true" aria-label="Menu">
        <header><div><p className="eyebrow">Cross-lens utilities</p><h2>Menu</h2></div><button type="button" onClick={onClose} aria-label="Close menu">×</button></header>
        <div className="menu-profile"><span>YO</span><div><strong>Your Organization</strong><small>Reference member context</small></div></div>
        <nav>{items.map((item) => <button type="button" key={item}><span>{item}</span><span aria-hidden>›</span></button>)}</nav>
        <button className="button button-secondary button-full" type="button">Log out</button>
      </section>
    </div>
  );
}
