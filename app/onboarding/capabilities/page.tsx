import CapabilityEnrichment from "@/components/onboarding/capability-enrichment";
import { isCapabilityEnrichmentStageId } from "@/lib/onboarding/capability-enrichment";

export default async function CapabilityEnrichmentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const stageValue = Array.isArray(params.stage) ? params.stage[0] : params.stage;
  const initialStage = isCapabilityEnrichmentStageId(stageValue) ? stageValue : "context";
  return <CapabilityEnrichment initialStage={initialStage} />;
}
