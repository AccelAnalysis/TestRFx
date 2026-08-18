import type {
  OnboardingCheckpointId,
  OnboardingProgressState,
} from "./progress";

export type ReadinessClassification = "required" | "recommended" | "optional";

export type ReadinessStatus =
  | "complete"
  | "needs_attention"
  | "recommended"
  | "not_applicable"
  | "processing"
  | "blocked";

export type MapPresence = "marker_ready" | "off_map";

export interface ReadinessItem {
  id: OnboardingCheckpointId;
  label: string;
  description: string;
  classification: ReadinessClassification;
  status: ReadinessStatus;
  blocking: boolean;
  href: string;
  detailHref?: string;
  value?: string;
}

export interface OrganizationPresence {
  id?: string;
  name?: string;
  geography?: string;
  visibility?: string;
  mapPresence: MapPresence;
  capabilitySummary: string[];
  amacsSummary?: string;
  entitlementSummary?: string;
}

export type ExchangeReadinessState = "blocked" | "ready_with_recommendations" | "ready";

export interface ExchangeReadinessSnapshot {
  state: ExchangeReadinessState;
  exchangeAccessAllowed: boolean;
  readinessPercent: number;
  profileCompletenessPercent: number;
  requiredComplete: number;
  requiredTotal: number;
  blockingItemIds: OnboardingCheckpointId[];
  items: ReadinessItem[];
  organization: OrganizationPresence;
}

export interface ExchangeActivation {
  status: "exchange_active";
  destination: string;
  activatedAt: string;
  successPath: string;
}

export interface CompletionWorkflowNode {
  id: string;
  label: string;
  description?: string;
  href?: string;
  checkpointId?: OnboardingCheckpointId;
  children?: readonly CompletionWorkflowNode[];
}

export interface CompletionWorkflowGroup {
  id: "review" | "activation" | "exchange-ready";
  label: string;
  description: string;
  children: readonly CompletionWorkflowNode[];
}

export const completionWorkflowTree: readonly CompletionWorkflowGroup[] = [
  {
    id: "review",
    label: "Review & Completion",
    description: "Resolve the required onboarding state and review progressive enrichment before activation.",
    children: [
      {
        id: "account",
        label: "Account",
        href: "/onboarding/account-verification",
        children: [
          { id: "account-verified", label: "Verify email / access", href: "/onboarding/account-verification", checkpointId: "account_verified" },
        ],
      },
      {
        id: "organization",
        label: "Organization",
        href: "/onboarding/organization",
        children: [
          { id: "organization-established", label: "Select, claim, join, or create", href: "/onboarding/organization", checkpointId: "organization_established" },
          { id: "organization-affiliation", label: "Confirm affiliation / authority", href: "/onboarding/organization", checkpointId: "organization_affiliation" },
        ],
      },
      {
        id: "geography",
        label: "Geography & Map Readiness",
        href: "/onboarding/geography",
        checkpointId: "geography",
        children: [
          { id: "primary-locality", label: "Primary locality", href: "/onboarding/geography" },
          { id: "map-placement", label: "Location / map placement", href: "/onboarding/geography" },
          { id: "location-privacy", label: "Privacy preference", href: "/onboarding/geography" },
          { id: "service-geography", label: "Service geography", href: "/onboarding/geography" },
        ],
      },
      {
        id: "organization-profile",
        label: "Organization Profile",
        href: "/onboarding/organization-profile",
        checkpointId: "organization_profile",
        children: [
          { id: "core-profile", label: "Core profile details", href: "/onboarding/organization-profile" },
          { id: "profile-visibility", label: "Visibility preferences", href: "/onboarding/organization-profile", checkpointId: "visibility" },
        ],
      },
      {
        id: "capabilities",
        label: "Capability Enrichment",
        href: "/onboarding/capabilities",
        checkpointId: "capability_profile",
        children: [
          { id: "capability-entry", label: "Capabilities entry", href: "/onboarding/capabilities?stage=capabilities", checkpointId: "capability_profile" },
          { id: "amacs", label: "AMACS mapping / assistance", href: "/onboarding/capabilities?stage=amacs", checkpointId: "amacs_alignment" },
          { id: "evidence", label: "Evidence / certifications", href: "/onboarding/capabilities?stage=evidence", checkpointId: "evidence" },
          { id: "discoverability", label: "Tags / keywords / specialties", href: "/onboarding/capabilities?stage=discoverability", checkpointId: "keywords" },
        ],
      },
      {
        id: "membership",
        label: "Participation / Membership",
        href: "/onboarding/membership?membership=free",
        children: [
          { id: "entitlement", label: "Resolve Exchange participation entitlement", href: "/onboarding/membership?membership=free", checkpointId: "entitlement" },
        ],
      },
    ],
  },
  {
    id: "activation",
    label: "Publish & Activate",
    description: "Re-evaluate blocking readiness, confirm presence, save completion, and enable the Exchange handoff.",
    children: [
      { id: "readiness-check", label: "Readiness checkpoint", href: "/onboarding/completion" },
      { id: "activate-presence", label: "Confirm Exchange presence", href: "/onboarding/completion/activate" },
      { id: "activation-complete", label: "Exchange-ready confirmation", href: "/onboarding/completion/success" },
    ],
  },
  {
    id: "exchange-ready",
    label: "Exchange Ready",
    description: "Continue into the existing authenticated Exchange and resume enrichment from the same platform records.",
    children: [
      { id: "rfx", label: "Browse RFx", href: "/exchange/rfx" },
      { id: "resources", label: "Browse Resources", href: "/exchange/resources" },
      { id: "intelligence", label: "Browse Intelligence", href: "/exchange/intelligence" },
      { id: "capabilities-lens", label: "Browse Capabilities", href: "/exchange/capabilities" },
      { id: "profile-menu", label: "Manage profile through Menu", href: "/exchange" },
    ],
  },
] as const;

const readinessDefinitions: Array<Omit<ReadinessItem, "status" | "value">> = [
  {
    id: "account_verified",
    label: "Account verified",
    description: "The person-level identity boundary has been verified.",
    classification: "required",
    blocking: true,
    href: "/onboarding/account-verification",
    detailHref: "/onboarding/detail/account",
  },
  {
    id: "organization_established",
    label: "Organization established",
    description: "A canonical organization has been selected, claimed, joined, or created.",
    classification: "required",
    blocking: true,
    href: "/onboarding/organization",
    detailHref: "/onboarding/detail/organization",
  },
  {
    id: "organization_affiliation",
    label: "Organization affiliation confirmed",
    description: "The user has an active organization role or accepted invitation/authority path.",
    classification: "required",
    blocking: true,
    href: "/onboarding/organization",
    detailHref: "/onboarding/detail/authority",
  },
  {
    id: "geography",
    label: "Geography established",
    description: "Primary locality, base location, public precision, and service geography have passed the geography workflow.",
    classification: "required",
    blocking: true,
    href: "/onboarding/geography",
    detailHref: "/onboarding/detail/geography",
  },
  {
    id: "organization_profile",
    label: "Organization profile complete",
    description: "Required organization identity, contact, role, location, service geography, and profile fields are complete.",
    classification: "required",
    blocking: true,
    href: "/onboarding/organization-profile",
    detailHref: "/onboarding/detail/profile",
  },
  {
    id: "capability_profile",
    label: "Capability profile initialized",
    description: "At least one meaningful capability is available for Exchange discovery and later enrichment.",
    classification: "required",
    blocking: true,
    href: "/onboarding/capabilities?stage=capabilities",
    detailHref: "/onboarding/detail/capability",
  },
  {
    id: "visibility",
    label: "Visibility selected",
    description: "The organization has explicitly selected its Exchange-facing visibility preference.",
    classification: "required",
    blocking: true,
    href: "/onboarding/organization-profile",
    detailHref: "/onboarding/detail/profile",
  },
  {
    id: "entitlement",
    label: "Participation entitlement resolved",
    description: "A valid free or paid participation path has been selected without treating payment as credibility or authority.",
    classification: "required",
    blocking: true,
    href: "/onboarding/membership?membership=free",
    detailHref: "/onboarding/detail/membership",
  },
  {
    id: "amacs_alignment",
    label: "Review AMACS alignment",
    description: "Continue mapping capability claims to AMACS to improve discovery and matching.",
    classification: "recommended",
    blocking: false,
    href: "/onboarding/capabilities?stage=amacs",
    detailHref: "/onboarding/detail/capability",
  },
  {
    id: "evidence",
    label: "Add evidence and certifications",
    description: "Supporting evidence can deepen trust without becoming an artificial Exchange-entry gate.",
    classification: "recommended",
    blocking: false,
    href: "/onboarding/capabilities?stage=evidence",
    detailHref: "/onboarding/detail/evidence",
  },
  {
    id: "keywords",
    label: "Add keywords and specialties",
    description: "Additional discoverability terms improve search without changing AMACS taxonomy truth.",
    classification: "optional",
    blocking: false,
    href: "/onboarding/capabilities?stage=discoverability",
  },
];

const completeStatuses = new Set<ReadinessStatus>(["complete", "not_applicable"]);

export function readinessItemSatisfied(item: ReadinessItem) {
  return completeStatuses.has(item.status);
}

function missingStatus(classification: ReadinessClassification): ReadinessStatus {
  return classification === "required" ? "needs_attention" : "recommended";
}

export function buildExchangeReadiness(progress: OnboardingProgressState): ExchangeReadinessSnapshot {
  const items: ReadinessItem[] = readinessDefinitions.map((definition) => {
    const checkpoint = progress.checkpoints[definition.id];
    return {
      ...definition,
      status: checkpoint?.status ?? missingStatus(definition.classification),
      value: checkpoint?.value,
    };
  });

  const requiredItems = items.filter((item) => item.classification === "required");
  const requiredComplete = requiredItems.filter(readinessItemSatisfied).length;
  const blockingItems = requiredItems.filter((item) => item.blocking && !readinessItemSatisfied(item));
  const scoredItems = items.filter((item) => item.status !== "not_applicable");
  const completedScoredItems = scoredItems.filter(readinessItemSatisfied).length;
  const exchangeAccessAllowed = blockingItems.length === 0;
  const profileComplete = completedScoredItems === scoredItems.length;

  return {
    state: !exchangeAccessAllowed ? "blocked" : profileComplete ? "ready" : "ready_with_recommendations",
    exchangeAccessAllowed,
    readinessPercent: requiredItems.length === 0 ? 100 : Math.round((requiredComplete / requiredItems.length) * 100),
    profileCompletenessPercent: scoredItems.length === 0 ? 100 : Math.round((completedScoredItems / scoredItems.length) * 100),
    requiredComplete,
    requiredTotal: requiredItems.length,
    blockingItemIds: blockingItems.map((item) => item.id),
    items,
    organization: {
      id: progress.context.organizationId,
      name: progress.context.organizationName,
      geography: progress.context.geography,
      visibility: progress.context.visibility,
      mapPresence: progress.context.mapPresence ?? "off_map",
      capabilitySummary: progress.context.capabilitySummary ?? [],
      amacsSummary: progress.context.amacsSummary,
      entitlementSummary: progress.context.entitlementSummary,
    },
  };
}

const exchangeDestinationPattern = /^\/exchange(?:\/(?:rfx|resources|intelligence|capabilities)(?:\/[A-Za-z0-9._-]+)?)?$/;

export function resolveExchangeDestination(candidate?: string | null) {
  if (!candidate) return "/exchange";
  const normalized = candidate.trim();
  if (!normalized || normalized.startsWith("//") || !exchangeDestinationPattern.test(normalized)) return "/exchange";
  return normalized;
}

export function createExchangeActivation(
  readiness: ExchangeReadinessSnapshot,
  requestedDestination?: string | null,
  activatedAt = new Date().toISOString(),
): ExchangeActivation {
  if (!readiness.exchangeAccessAllowed) {
    throw new Error("Exchange activation requires all blocking readiness items to be satisfied.");
  }

  const destination = resolveExchangeDestination(requestedDestination);
  return {
    status: "exchange_active",
    destination,
    activatedAt,
    successPath: `/onboarding/completion/success?returnTo=${encodeURIComponent(destination)}`,
  };
}
