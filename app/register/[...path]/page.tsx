import { Suspense } from "react";
import { notFound } from "next/navigation";
import { RegistrationRouteClient } from "@/components/identity/registration-route-client";
import {
  findRegistrationWorkflowNode,
  registrationWorkflowPaths,
} from "@/lib/identity/registration-navigation";

export function generateStaticParams() {
  return registrationWorkflowPaths.map((path) => ({ path }));
}

export default async function RegistrationWorkflowPage({
  params,
}: {
  params: Promise<{ path: string[] }>;
}) {
  const { path } = await params;
  if (!findRegistrationWorkflowNode(path)) notFound();

  return (
    <main className="identity-shell">
      <Suspense fallback={<section className="identity-card"><p className="eyebrow">Registration</p><h1>Loading workflow…</h1></section>}>
        <RegistrationRouteClient initialPath={path} />
      </Suspense>
    </main>
  );
}
