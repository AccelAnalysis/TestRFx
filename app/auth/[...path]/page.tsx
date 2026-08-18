import { Suspense } from "react";
import { notFound } from "next/navigation";
import { AuthEntryNavigator } from "@/components/public/AuthEntryNavigator";
import {
  findAuthEntryNode,
  flattenAuthEntryPaths,
} from "@/lib/acquisition/auth-entry-navigation";

export function generateStaticParams() {
  return flattenAuthEntryPaths().map((path) => ({ path }));
}

export default async function AuthEntryWorkflowPage({
  params,
}: {
  params: Promise<{ path: string[] }>;
}) {
  const { path } = await params;
  const resolved = findAuthEntryNode(path);
  if (!resolved) notFound();

  return (
    <Suspense
      fallback={
        <main className="identity-shell">
          <section className="identity-card">
            <p className="eyebrow">RFxchange access</p>
            <h1>Loading workflow…</h1>
          </section>
        </main>
      }
    >
      <AuthEntryNavigator resolved={resolved} />
    </Suspense>
  );
}
