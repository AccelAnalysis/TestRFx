import CapabilityEnrichment from "@/components/onboarding/capability-enrichment";

export default async function CapabilityEnrichmentPage({
  searchParams,
}: {
  searchParams: Promise<{ organizationId?: string }>;
}) {
  const query = await searchParams;
  return <CapabilityEnrichment path={[]} organizationId={query.organizationId} />;
}
