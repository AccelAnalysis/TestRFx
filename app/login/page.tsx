import Link from "next/link";

export default function LoginPage() {
  return (
    <main className="identity-shell">
      <section className="identity-card">
        <p className="eyebrow">RFxchange</p>
        <h1>Welcome back</h1>
        <p className="muted">Reference identity shell. Authentication is intentionally not wired in this chassis PR.</p>
        <label>Email<input type="email" placeholder="you@company.com" /></label>
        <label>Password<input type="password" placeholder="••••••••" /></label>
        <Link className="button button-primary button-full" href="/exchange">Continue to Exchange</Link>
        <p className="identity-footer">New here? <Link href="/register">Create an account</Link></p>
      </section>
    </main>
  );
}
