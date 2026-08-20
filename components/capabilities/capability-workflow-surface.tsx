"use client";

import { useEffect, useState } from "react";
import type { CapabilityOrganizationProfile } from "@/lib/capabilities/contracts";
import type { CapabilityWorkflowMode } from "@/lib/capabilities/actions";
import { withBasePath } from "@/lib/exchange/base-path";
import { CapabilityWorkflowSurface as CapabilityWorkflowImplementation } from "./capability-workflow-implementation";

export function CapabilityWorkflowSurface({ profile, mode, onClose }: { profile: CapabilityOrganizationProfile; mode: CapabilityWorkflowMode; onClose: () => void }) {
  const [resolvedProfile, setResolvedProfile] = useState(profile);

  useEffect(() => {
    let cancelled = false;
    setResolvedProfile(profile);
    fetch(withBasePath(`/api/capabilities?recordId=${encodeURIComponent(profile.exchangeRecordId)}`), { cache: "no-store" })
      .then(async (response) => { if (!response.ok) throw new Error("Capability service unavailable"); return response.json(); })
      .then((data) => { if (!cancelled && data.profile) setResolvedProfile(data.profile); })
      .catch(() => { /* GitHub Pages static preview intentionally has no runtime API. */ });
    return () => { cancelled = true; };
  }, [profile]);

  return <CapabilityWorkflowImplementation key={`${resolvedProfile.exchangeRecordId}:${resolvedProfile.updatedAt ?? "preview"}:${mode}`} profile={resolvedProfile} mode={mode} onClose={onClose} />;
}
