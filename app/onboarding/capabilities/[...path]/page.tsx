import { notFound } from "next/navigation";
import CapabilityEnrichment from "@/components/onboarding/capability-enrichment";
import { CAPABILITY_ENRICHMENT_TREE, isCapabilityWorkflowPath } from "@/lib/onboarding/capability-enrichment";

export const dynamicParams = false;

export function generateStaticParams() {
  return CAPABILITY_ENRICHMENT_TREE.flatMap((section) => [
    { path: [section.id] },
    ...section.children.map((task) => ({ path: [section.id, task.id] })),
  ]);
}

export default async function CapabilityEnrichmentPathPage({
  params,
  searchParams,
}: {
  params: Promise<{ path: string[] }>;
  searchParams: Promise<{ organizationId?: string }>;
}) {
  const [{ path }, query] = await Promise.all([params, searchParams]);
  if (!isCapabilityWorkflowPath(path)) notFound();
  return <CapabilityEnrichment path={path} organizationId={query.organizationId} />;
}
