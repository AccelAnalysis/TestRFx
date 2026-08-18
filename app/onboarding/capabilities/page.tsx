import { Suspense } from "react";
import CapabilityEnrichmentRoute from "@/components/onboarding/capability-enrichment-route";

export default function CapabilityEnrichmentPage() {
  return (
    <Suspense fallback={null}>
      <CapabilityEnrichmentRoute path={[]} />
    </Suspense>
  );
}
