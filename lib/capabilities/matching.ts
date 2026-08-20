import type { CapabilityClaim, CapabilityOrganizationProfile, CapabilityRequirementMatch, CapabilityRfxMatchResult } from "./contracts";
import { exchangeSeed } from "@/lib/exchange/seed";
import { rfxCatalog } from "@/lib/rfx/catalog";

const stopWords = new Set(["and", "the", "for", "with", "of", "to", "a", "an", "ability", "required", "requirement", "capability", "services", "service"]);
function tokens(value: string) { return new Set(value.toLowerCase().replace(/[^a-z0-9]+/g, " ").split(/\s+/).filter((item) => item.length > 2 && !stopWords.has(item))); }
function claimTokens(claim: CapabilityClaim) { return tokens([claim.name, claim.description, claim.amacsLabel ?? "", ...claim.specialties].join(" ")); }
function overlapScore(requirement: Set<string>, claim: Set<string>) { if (!requirement.size) return 0; let hits = 0; requirement.forEach((token) => { if (claim.has(token)) hits += 1; }); return hits / requirement.size; }

function matchRequirement(profile: CapabilityOrganizationProfile, requirement: { id: string; label: string; kind: string }): CapabilityRequirementMatch {
  if (requirement.kind !== "capability") return { requirementId: requirement.id, label: requirement.label, state: "uncertain", matchedCapabilityIds: [], reason: `RFx requirement type “${requirement.kind}” cannot be inferred from a capability profile and must be confirmed separately.` };
  const requirementTokens = tokens(requirement.label);
  const scored = profile.capabilities.map((claim) => ({ claim, score: overlapScore(requirementTokens, claimTokens(claim)) })).sort((a, b) => b.score - a.score);
  const best = scored[0];
  if (!best || best.score === 0) return { requirementId: requirement.id, label: requirement.label, state: "missing", matchedCapabilityIds: [], reason: "No published capability language overlaps this structured requirement." };
  if (best.score >= 0.6) return { requirementId: requirement.id, label: requirement.label, state: "aligned", matchedCapabilityIds: [best.claim.id], reason: `Strong lexical alignment with ${best.claim.name}.` };
  return { requirementId: requirement.id, label: requirement.label, state: "partial", matchedCapabilityIds: [best.claim.id], reason: `Partial alignment with ${best.claim.name}; substantive fit still requires review.` };
}

export function matchCapabilityProfileToRfx(profile: CapabilityOrganizationProfile): CapabilityRfxMatchResult[] {
  return Object.values(rfxCatalog).map((rfx) => {
    const requirements = rfx.requirements.map((requirement) => matchRequirement(profile, requirement));
    const aligned = requirements.filter((item) => item.state === "aligned").length;
    const partial = requirements.filter((item) => item.state === "partial").length;
    const missing = requirements.filter((item) => item.state === "missing").length;
    const uncertain = requirements.filter((item) => item.state === "uncertain").length;
    const substantive = aligned + partial + missing;
    const coverage = missing > 0 ? (aligned > 0 || partial > 0 ? "partial" : "gap") : partial > 0 || uncertain > 0 ? "partial" : aligned > 0 ? "strong" : "uncertain";
    const record = exchangeSeed.find((item) => item.id === rfx.exchangeRecordId);
    return {
      id: rfx.exchangeRecordId,
      title: record?.title ?? rfx.solicitationNumber,
      issuer: record?.organization ?? "RFx issuer",
      coverage,
      summary: substantive ? `${aligned} aligned · ${partial} partial · ${missing} missing${uncertain ? ` · ${uncertain} requires separate confirmation` : ""}.` : `${uncertain} requirement${uncertain === 1 ? "" : "s"} require separate confirmation.`,
      requirements, aligned, partial, missing, uncertain,
    };
  });
}
