export function ExchangeRuntimeUnavailable({ message }: { message: string }) {
  return <main className="identity-shell"><section className="identity-card"><p className="eyebrow">RFxchange runtime</p><h1>Exchange data service unavailable</h1><p className="muted">{message}</p><p className="muted">The production Exchange does not fall back to fixture records. Configure the PostgreSQL runtime and authenticated session service, then reload.</p></section></main>;
}
