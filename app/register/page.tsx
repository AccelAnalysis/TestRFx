import Link from "next/link";

export default function RegisterPage() {
  return (
    <main className="identity-shell">
      <section className="identity-card">
        <p className="eyebrow">RFxchange registration</p>
        <h1>Create your account</h1>
        <label>Work email<input type="email" placeholder="you@company.com" /></label>
        <label>Full name<input type="text" placeholder="Your name" /></label>
        <label>Password<input type="password" placeholder="Create a password" /></label>
        <Link className="button button-primary button-full" href="/onboarding">Create account</Link>
        <p className="identity-footer">Already registered? <Link href="/login">Log in</Link></p>
      </section>
    </main>
  );
}
