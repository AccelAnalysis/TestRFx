import { Suspense } from "react";
import { notFound } from "next/navigation";
import CapabilityEnrichmentRoute from "@/components/onboarding/capability-enrichment-route";
import { CAPABILITY_ENRICHMENT_TREE, isCapabilityWorkflowPath } from "@/lib/onboarding/capability-enrichment";

export const dynamicParams = false;

export function generateStaticParams() {
  return CAPABILITY_ENRICHMENT_TREE.flatMap((section) => [
    { path: [section.id] },
    ...section.children.map((task) => ({ path: [section.id, task.id] })),
  ]);
}

export default async function CapabilityEnrichmentPathPage({ params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  if (!isCapabilityWorkflowPath(path)) notFound();
  return (
    <Suspense fallback={null}>
      <CapabilityEnrichmentRoute path={path} />
    </Suspense>
  );
}
