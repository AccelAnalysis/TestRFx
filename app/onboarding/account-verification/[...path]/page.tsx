import { Suspense } from "react";
import { notFound } from "next/navigation";
import { AccountVerificationPanel } from "@/components/identity/AccountVerificationPanel";
import {
  accountVerificationRoutes,
  getAccountVerificationNode,
} from "@/lib/identity/account-verification-navigation";

export function generateStaticParams() {
  return accountVerificationRoutes
    .filter((route) => route.path.length > 0)
    .map((route) => ({ path: route.path }));
}

export default async function AccountVerificationWorkflowPage({
  params,
}: {
  params: Promise<{ path: string[] }>;
}) {
  const { path } = await params;
  if (!getAccountVerificationNode(path)) notFound();

  return (
    <main className="identity-shell">
      <Suspense
        fallback={
          <section className="identity-card">
            <p className="eyebrow">Account verification</p>
            <h1>Loading verification…</h1>
            <p className="muted">Preparing your account verification workflow.</p>
          </section>
        }
      >
        <AccountVerificationPanel activePath={path} />
      </Suspense>
    </main>
  );
}
