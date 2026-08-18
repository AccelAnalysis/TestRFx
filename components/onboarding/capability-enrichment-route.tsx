"use client";

import { useSearchParams } from "next/navigation";
import CapabilityEnrichment from "./capability-enrichment";
import CapabilityProfileContextEditor from "./capability-profile-context-editor";

export default function CapabilityEnrichmentRoute({ path }: { path: string[] }) {
  const searchParams = useSearchParams();
  const organizationId = searchParams.get("organizationId") ?? undefined;

  if (path[0] === "industry-services" && path[1] === "industries-served") {
    return <CapabilityProfileContextEditor organizationId={organizationId} field="industries" />;
  }
  if (path[0] === "industry-services" && path[1] === "service-offerings") {
    return <CapabilityProfileContextEditor organizationId={organizationId} field="service_offerings" />;
  }
  return <CapabilityEnrichment path={path} organizationId={organizationId} />;
}
