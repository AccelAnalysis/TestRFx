"use client";

import { useEffect, useState } from "react";
import CapabilityEnrichment from "./capability-enrichment";
import {
  isCapabilityEnrichmentStageId,
  type CapabilityEnrichmentStageId,
} from "@/lib/onboarding/capability-enrichment";

export function CapabilityEnrichmentRoute() {
  const [stage, setStage] = useState<CapabilityEnrichmentStageId>("context");

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("stage") ?? undefined;
    if (isCapabilityEnrichmentStageId(requested)) setStage(requested);
  }, []);

  return <CapabilityEnrichment key={stage} initialStage={stage} />;
}
