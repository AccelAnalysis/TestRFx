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
  id: string;
  label: string;
  description: string;
  classification: ReadinessClassification;
  status: ReadinessStatus;
  blocking: boolean;
  value?: string;
}

export interface OrganizationPresence {
  id: string;
  name: string;
  geography: string;
  visibility: string;
  mapPresence: MapPresence;
  capabilitySummary: string[];
  amacsSummary: string;
  entitlementSummary: string;
}

export type ExchangeReadinessState = "blocked" | "ready_with_recommendations" | "ready";

export interface ExchangeReadinessSnapshot {
  state: ExchangeReadinessState;
  exchangeAccessAllowed: boolean;
  readinessPercent: number;
  profileCompletenessPercent: number;
  requiredComplete: number;
  requiredTotal: number;
  blockingItemIds: string[];
  items: ReadinessItem[];
  organization: OrganizationPresence;
}

export interface ExchangeActivation {
  status: "exchange_active";
  destination: string;
  activatedAt: string;
  events: string[];
}

const completeStatuses = new Set<ReadinessStatus>(["complete", "not_applicable"]);

export function readinessItemSatisfied(item: ReadinessItem) {
  return completeStatuses.has(item.status);
}

export function evaluateExchangeReadiness(
  items: ReadinessItem[],
  organization: OrganizationPresence,
): ExchangeReadinessSnapshot {
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
    profileCompletenessPercent:
      scoredItems.length === 0 ? 100 : Math.round((completedScoredItems / scoredItems.length) * 100),
    requiredComplete,
    requiredTotal: requiredItems.length,
    blockingItemIds: blockingItems.map((item) => item.id),
    items,
    organization,
  };
}

const referenceItems: ReadinessItem[] = [
  {
    id: "account_verified",
    label: "Account verified",
    description: "The person-level identity boundary has been verified.",
    classification: "required",
    status: "complete",
    blocking: true,
  },
  {
    id: "organization_established",
    label: "Organization established",
    description: "An organization has been selected, claimed, invited, or created.",
    classification: "required",
    status: "complete",
    blocking: true,
  },
  {
    id: "organization_affiliation",
    label: "Organization affiliation confirmed",
    description: "The user has an active role or membership relationship with the organization.",
    classification: "required",
    status: "complete",
    blocking: true,
  },
  {
    id: "geography",
    label: "Geography established",
    description: "A primary market or operating geography is available for Exchange context.",
    classification: "required",
    status: "complete",
    blocking: true,
    value: "Isle of Wight, VA",
  },
  {
    id: "capability_profile",
    label: "Capability profile initialized",
    description: "At least one usable organization capability is available to the Exchange.",
    classification: "required",
    status: "complete",
    blocking: true,
    value: "Business Intelligence & Market Analysis",
  },
  {
    id: "visibility",
    label: "Visibility selected",
    description: "The organization has an explicit Exchange visibility state.",
    classification: "required",
    status: "complete",
    blocking: true,
    value: "Exchange visible",
  },
  {
    id: "entitlement",
    label: "Participation entitlement resolved",
    description: "The selected free or paid participation path has a valid access state.",
    classification: "required",
    status: "complete",
    blocking: true,
    value: "Access eligible",
  },
  {
    id: "amacs_alignment",
    label: "Review AMACS alignment",
    description: "Continue mapping capabilities to the AMACS structure to improve discovery and matching.",
    classification: "recommended",
    status: "recommended",
    blocking: false,
    value: "Enrichment started",
  },
  {
    id: "evidence",
    label: "Add evidence and certifications",
    description: "Supporting evidence can deepen trust without blocking Exchange entry.",
    classification: "recommended",
    status: "recommended",
    blocking: false,
    value: "Can continue later",
  },
  {
    id: "keywords",
    label: "Add keywords and specialties",
    description: "Additional specialties and tags improve discoverability over time.",
    classification: "optional",
    status: "recommended",
    blocking: false,
    value: "Optional enrichment",
  },
];

const referenceOrganization: OrganizationPresence = {
  id: "org-reference-viewer",
  name: "Your Organization",
  geography: "Isle of Wight, VA",
  visibility: "Exchange visible",
  mapPresence: "marker_ready",
  capabilitySummary: ["Business Intelligence & Market Analysis"],
  amacsSummary: "AMACS-aligned enrichment started",
  entitlementSummary: "Participation entitlement resolved",
};

export function getReferenceExchangeReadiness() {
  return evaluateExchangeReadiness(referenceItems, referenceOrganization);
}

const exchangeDestinationPattern = /^\/exchange(?:\/(?:rfx|resources|intelligence|capabilities)(?:\/[A-Za-z0-9._-]+)?)?$/;

export function resolveExchangeDestination(candidate?: string | null) {
  if (!candidate) return "/exchange";
  const normalized = candidate.trim();
  if (!normalized || normalized.startsWith("//") || !exchangeDestinationPattern.test(normalized)) return "/exchange";
  return normalized;
}

export function createReferenceExchangeActivation(
  readiness: ExchangeReadinessSnapshot,
  requestedDestination?: string | null,
  activatedAt = new Date().toISOString(),
): ExchangeActivation {
  if (!readiness.exchangeAccessAllowed) {
    throw new Error("Exchange activation requires all blocking readiness items to be satisfied.");
  }

  return {
    status: "exchange_active",
    destination: resolveExchangeDestination(requestedDestination),
    activatedAt,
    events: [
      "OnboardingReadinessEvaluated",
      "OrganizationExchangeReady",
      "OrganizationPublished",
      "ExchangeAccessEnabled",
      readiness.organization.mapPresence === "marker_ready" ? "OrganizationMarkerActivated" : "OrganizationOffMapPresenceActivated",
      "CapabilityProfileInitialized",
      "OnboardingCompleted",
    ],
  };
}
