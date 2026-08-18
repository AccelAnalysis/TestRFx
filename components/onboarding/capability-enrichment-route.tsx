"use client";

import { useSearchParams } from "next/navigation";
import CapabilityEnrichment from "./capability-enrichment";

export default function CapabilityEnrichmentRoute({ path }: { path: string[] }) {
  const searchParams = useSearchParams();
  const organizationId = searchParams.get("organizationId") ?? undefined;
  return <CapabilityEnrichment path={path} organizationId={organizationId} />;
}
