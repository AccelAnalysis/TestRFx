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
  href: string;
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
  successPath: string;
  events: string[];
}

export interface AuthoritativeReadinessFacts {
  accountVerified: boolean;
  organizationEstablished: boolean;
  organizationAffiliation: boolean;
  organizationId: string;
  organizationName: string;
  geographyEstablished: boolean;
  geography?: string;
  organizationProfileComplete: boolean;
  visibilitySelected: boolean;
  visibilityLabel?: string;
  mapPresence: MapPresence;
  capabilityProfileComplete: boolean;
  capabilitySummary: string[];
  acceptedAmacsCount: number;
  evidenceCount: number;
  discoverabilityTermCount: number;
  entitlementResolved: boolean;
  entitlementSummary?: string;
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

function requiredItem(
  id: string,
  label: string,
  description: string,
  href: string,
  complete: boolean,
  value?: string,
): ReadinessItem {
  return {
    id,
    label,
    description,
    href,
    classification: "required",
    status: complete ? "complete" : "needs_attention",
    blocking: true,
    value,
  };
}

function enrichmentItem(
  id: string,
  label: string,
  description: string,
  href: string,
  complete: boolean,
  classification: "recommended" | "optional" = "recommended",
  value?: string,
): ReadinessItem {
  return {
    id,
    label,
    description,
    href,
    classification,
    status: complete ? "complete" : "recommended",
    blocking: false,
    value,
  };
}

export function buildExchangeReadiness(facts: AuthoritativeReadinessFacts): ExchangeReadinessSnapshot {
  const items: ReadinessItem[] = [
    requiredItem(
      "account_verified",
      "Account verified",
      "The person-level email identity boundary has been verified.",
      "/onboarding/account-verification",
      facts.accountVerified,
    ),
    requiredItem(
      "organization_established",
      "Organization established",
      "A canonical organization has been selected, claimed, joined, or created.",
      "/onboarding/organization",
      facts.organizationEstablished,
      facts.organizationEstablished ? facts.organizationName : undefined,
    ),
    requiredItem(
      "organization_affiliation",
      "Organization affiliation confirmed",
      "The authenticated user has an active organization membership or authority relationship.",
      "/onboarding/organization",
      facts.organizationAffiliation,
    ),
    requiredItem(
      "geography",
      "Geography established",
      "The organization has a canonical primary Exchange geography.",
      "/onboarding/geography",
      facts.geographyEstablished,
      facts.geography,
    ),
    requiredItem(
      "organization_profile",
      "Organization profile complete",
      "The canonical organization profile has completed its required profile workflow.",
      "/onboarding/organization-profile",
      facts.organizationProfileComplete,
    ),
    requiredItem(
      "capability_profile",
      "Capability profile initialized",
      "At least one non-archived capability claim is available for Exchange discovery and enrichment.",
      "/onboarding/capabilities",
      facts.capabilityProfileComplete,
      facts.capabilitySummary[0],
    ),
    requiredItem(
      "visibility",
      "Visibility selected",
      "The organization profile has an explicit Exchange visibility configuration.",
      "/onboarding/organization-profile",
      facts.visibilitySelected,
      facts.visibilityLabel,
    ),
    requiredItem(
      "entitlement",
      "Participation entitlement resolved",
      "The organization has an active RFxchange participation entitlement; payment state never substitutes for identity or authority.",
      "/onboarding/membership",
      facts.entitlementResolved,
      facts.entitlementSummary,
    ),
    enrichmentItem(
      "amacs_alignment",
      "Review AMACS alignment",
      "Accepted AMACS mappings improve governed discovery and matching without becoming an entry gate.",
      "/onboarding/capabilities?stage=amacs",
      facts.acceptedAmacsCount > 0,
      "recommended",
      facts.acceptedAmacsCount > 0 ? `${facts.acceptedAmacsCount} accepted mapping${facts.acceptedAmacsCount === 1 ? "" : "s"}` : undefined,
    ),
    enrichmentItem(
      "evidence",
      "Add evidence and certifications",
      "Supporting evidence can deepen trust without blocking an otherwise-ready organization.",
      "/onboarding/capabilities?stage=evidence",
      facts.evidenceCount > 0,
      "recommended",
      facts.evidenceCount > 0 ? `${facts.evidenceCount} evidence item${facts.evidenceCount === 1 ? "" : "s"}` : undefined,
    ),
    enrichmentItem(
      "keywords",
      "Add keywords and specialties",
      "Additional discoverability terms improve search while AMACS remains the governed taxonomy authority.",
      "/onboarding/capabilities?stage=discoverability",
      facts.discoverabilityTermCount > 0,
      "optional",
      facts.discoverabilityTermCount > 0 ? `${facts.discoverabilityTermCount} discoverability term${facts.discoverabilityTermCount === 1 ? "" : "s"}` : undefined,
    ),
  ];

  return evaluateExchangeReadiness(items, {
    id: facts.organizationId,
    name: facts.organizationName,
    geography: facts.geography ?? "Not established",
    visibility: facts.visibilityLabel ?? "Not selected",
    mapPresence: facts.mapPresence,
    capabilitySummary: facts.capabilitySummary,
    amacsSummary: facts.acceptedAmacsCount > 0 ? `${facts.acceptedAmacsCount} accepted AMACS mapping${facts.acceptedAmacsCount === 1 ? "" : "s"}` : "AMACS enrichment can continue",
    entitlementSummary: facts.entitlementSummary ?? "Participation not resolved",
  });
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
    events: [
      "OnboardingReadinessEvaluated",
      "OrganizationExchangeReady",
      "ExchangeAccessEnabled",
      readiness.organization.mapPresence === "marker_ready" ? "OrganizationMarkerActivated" : "OrganizationOffMapPresenceActivated",
      "OnboardingCompleted",
    ],
  };
}
