export const organizationTypes = [
  "Business",
  "Supplier",
  "Buyer / Issuer",
  "Government",
  "Economic Development Organization",
  "Resource Provider",
  "Chamber / Association",
  "Lender / Capital Provider",
  "University / Education",
  "Nonprofit",
  "Other",
] as const;
export type OrganizationType = (typeof organizationTypes)[number];

export const organizationUserRoles = [
  { id: "primary_admin", label: "Primary Administrator", description: "Establish and administer the organization account." },
  { id: "opportunity_manager", label: "Opportunity Manager", description: "Manage opportunity and RFx activity." },
  { id: "response_manager", label: "Response Manager", description: "Coordinate RFx responses." },
  { id: "referral_manager", label: "Referral Manager", description: "Coordinate referrals and relationship workflows." },
  { id: "billing_manager", label: "Billing Manager", description: "Manage membership and billing activity." },
  { id: "viewer", label: "Viewer", description: "View organization and Exchange information without administrative authority." },
] as const;
export type OrganizationUserRole = (typeof organizationUserRoles)[number]["id"];

export type OrganizationClaimState = "unclaimed" | "claimed" | "verified";
export type OrganizationResolutionMode = "claim" | "join" | "create" | "invitation";
export type OrganizationMembershipState = "active" | "pending-approval" | "authority-pending";
export type OrganizationAuthorityState = "invited" | "admin-approved" | "domain-verified" | "self-attested" | "pending-review";

export type OrganizationStep =
  | "welcome"
  | "affiliation"
  | "existing.search"
  | "existing.review"
  | "existing.claim"
  | "existing.join"
  | "invitation.review"
  | "create.identity"
  | "create.duplicates"
  | "create.authority"
  | "create.confirm"
  | "status.pending"
  | "status.connected"
  | "access.review"
  | "claim.review";

export type OrganizationEntryContext = {
  source?: string;
  campaign?: string;
  referral?: string;
  invitation?: string;
  returnTo?: string;
  organizationId?: string;
  requestId?: string;
  claimId?: string;
};

export interface OrganizationCandidate {
  id: string;
  name: string;
  aliases: string[];
  type: OrganizationType;
  website?: string;
  domain?: string;
  locality?: string;
  region?: string;
  claimState: OrganizationClaimState;
  matchScore?: number;
}

export interface OrganizationInvitation {
  id: string;
  organization: OrganizationCandidate;
  invitedEmail: string;
  role: string;
  expiresAt: string;
}

export interface OrganizationAccessReview {
  requestId: string;
  organization: OrganizationCandidate;
  requesterEmail: string;
  requesterName: string;
  requestedRole: string;
  createdAt: string;
}

export interface OrganizationClaimReviewItem {
  claimId: string;
  claimantEmail: string;
  claimantName: string;
  authorityMethod: "domain_email" | "manual_review";
  evidenceNote?: string;
  status: "pending" | "conflict";
  createdAt: string;
}

export interface OrganizationClaimReview {
  organization: OrganizationCandidate;
  selectedClaimId: string;
  claims: OrganizationClaimReviewItem[];
}

export interface OrganizationResolution {
  status: "connected" | "pending";
  mode: OrganizationResolutionMode;
  organizationId: string;
  organizationName: string;
  organizationType: OrganizationType;
  website?: string;
  membershipState: OrganizationMembershipState;
  authorityState: OrganizationAuthorityState;
  role?: string;
  requestId?: string;
  claimId?: string;
  nextPath: string;
}

export type OrganizationSearchResponse = {
  organizations: OrganizationCandidate[];
};

export type OrganizationStateResponse = {
  resolution: OrganizationResolution | null;
};

export type OrganizationMutationAction =
  | "create"
  | "claim"
  | "request_access"
  | "accept_invitation"
  | "review_access"
  | "review_claim";

export type OrganizationMutationRequest = {
  action: OrganizationMutationAction;
  organizationId?: string;
  name?: string;
  type?: OrganizationType;
  website?: string;
  requestedRole?: OrganizationUserRole;
  authorityMethod?: "domain_email" | "manual_review";
  evidenceNote?: string;
  invitationToken?: string;
  requestId?: string;
  claimId?: string;
  decision?: "approve" | "deny";
  context?: OrganizationEntryContext;
};

export type OrganizationWorkflowNode = {
  id: string;
  label: string;
  step?: OrganizationStep;
  children?: OrganizationWorkflowNode[];
};

export const ORGANIZATION_WORKFLOW_TREE: readonly OrganizationWorkflowNode[] = [
  { id: "welcome", label: "Welcome / role selection", step: "welcome" },
  {
    id: "affiliation",
    label: "Organization affiliation",
    step: "affiliation",
    children: [
      {
        id: "existing",
        label: "Find / join existing",
        step: "existing.search",
        children: [
          { id: "existing-search", label: "Search organizations", step: "existing.search" },
          { id: "existing-review", label: "Review organization", step: "existing.review" },
          { id: "existing-claim", label: "Claim & authority", step: "existing.claim" },
          { id: "claim-review", label: "Platform claim review", step: "claim.review" },
          { id: "existing-join", label: "Request access", step: "existing.join" },
          { id: "access-review", label: "Existing-admin approval", step: "access.review" },
          { id: "invitation", label: "Invitation validation & acceptance", step: "invitation.review" },
        ],
      },
      {
        id: "create",
        label: "Create new organization",
        step: "create.identity",
        children: [
          { id: "create-identity", label: "Organization identity", step: "create.identity" },
          { id: "create-duplicates", label: "Duplicate / conflict resolution", step: "create.duplicates" },
          { id: "create-authority", label: "Authority confirmation", step: "create.authority" },
          { id: "create-confirm", label: "Create & establish membership", step: "create.confirm" },
        ],
      },
    ],
  },
  {
    id: "status",
    label: "Status & completion",
    children: [
      { id: "pending", label: "Pending approval / review", step: "status.pending" },
      { id: "connected", label: "Organization connected", step: "status.connected" },
    ],
  },
];

const validSteps = new Set<OrganizationStep>([
  "welcome",
  "affiliation",
  "existing.search",
  "existing.review",
  "existing.claim",
  "existing.join",
  "invitation.review",
  "create.identity",
  "create.duplicates",
  "create.authority",
  "create.confirm",
  "status.pending",
  "status.connected",
  "access.review",
  "claim.review",
]);
const validTypes = new Set<OrganizationType>(organizationTypes);
const validRoles = new Set<OrganizationUserRole>(organizationUserRoles.map((role) => role.id));

type SearchParamsLike = Record<string, string | string[] | undefined>;

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function clean(value: unknown, maxLength = 240) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function safeReturnTo(value: unknown) {
  const candidate = clean(value, 500);
  return candidate.startsWith("/") && !candidate.startsWith("//") ? candidate : undefined;
}

export function normalizeOrganizationTerm(value = "") {
  return value
    .toLowerCase()
    .replace(/\b(the|llc|l\.l\.c|inc|incorporated|corp|corporation|company|co)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function normalizeDomain(value = "") {
  return value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
}

export function sanitizeOrganizationType(value: unknown): OrganizationType | null {
  const type = clean(value, 80) as OrganizationType;
  return validTypes.has(type) ? type : null;
}

export function sanitizeOrganizationUserRole(value: unknown): OrganizationUserRole {
  const role = clean(value, 80) as OrganizationUserRole;
  return validRoles.has(role) ? role : "viewer";
}

export function organizationContextFromSearchParams(params: SearchParamsLike): OrganizationEntryContext {
  return {
    source: clean(single(params.source)) || undefined,
    campaign: clean(single(params.campaign)) || undefined,
    referral: clean(single(params.referral)) || undefined,
    invitation: clean(single(params.invitation) ?? single(params.invite), 500) || undefined,
    returnTo: safeReturnTo(single(params.returnTo)),
    organizationId: clean(single(params.organization)) || undefined,
    requestId: clean(single(params.request)) || undefined,
    claimId: clean(single(params.claim)) || undefined,
  };
}

export function organizationStepFromSearchParams(params: SearchParamsLike, context: OrganizationEntryContext) {
  const requested = clean(single(params.step), 80) as OrganizationStep;
  if (validSteps.has(requested)) return requested;
  if (context.claimId) return "claim.review";
  if (context.requestId) return "access.review";
  if (context.invitation) return "invitation.review";
  return "welcome";
}

export function buildOrganizationHref(
  step: OrganizationStep,
  context: OrganizationEntryContext,
  overrides: Partial<OrganizationEntryContext> = {},
) {
  const merged = { ...context, ...overrides };
  const params = new URLSearchParams({ step });
  if (merged.source) params.set("source", merged.source);
  if (merged.campaign) params.set("campaign", merged.campaign);
  if (merged.referral) params.set("referral", merged.referral);
  if (merged.invitation) params.set("invitation", merged.invitation);
  if (merged.returnTo) params.set("returnTo", merged.returnTo);
  if (merged.organizationId) params.set("organization", merged.organizationId);
  if (merged.requestId) params.set("request", merged.requestId);
  if (merged.claimId) params.set("claim", merged.claimId);
  return `/onboarding/organization?${params.toString()}`;
}

export function resolutionModeFor(candidate: OrganizationCandidate): OrganizationResolutionMode {
  return candidate.claimState === "unclaimed" ? "claim" : "join";
}
