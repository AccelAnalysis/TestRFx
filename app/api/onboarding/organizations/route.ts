import { NextRequest, NextResponse } from "next/server";
import {
  ONBOARDING_SESSION_COOKIE,
  verifyOnboardingSessionToken,
} from "@/lib/identity/onboarding-session";
import {
  normalizeDomain,
  sanitizeOrganizationType,
  sanitizeOrganizationUserRole,
  type OrganizationMutationRequest,
} from "@/lib/onboarding/organization";
import {
  getOrganizationAccessReview,
  getOrganizationClaimReview,
  reviewOrganizationAccessRequest,
  reviewOrganizationClaim,
} from "@/lib/onboarding/organization-admin-repository";
import {
  acceptInvitation,
  claimOrganization,
  createOrganization,
  getOrganization,
  getOrganizationState,
  OrganizationWorkflowError,
  requestOrganizationAccess,
  resolveInvitation,
  searchOrganizations,
} from "@/lib/onboarding/organization-repository";
import { DatabaseConfigurationError } from "@/lib/server/database";

export const dynamic = "force-dynamic";

function noStore(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function requireSession(request: NextRequest) {
  const session = verifyOnboardingSessionToken(request.cookies.get(ONBOARDING_SESSION_COOKIE)?.value);
  if (!session) {
    throw new OrganizationWorkflowError(
      "Verify your account before connecting an organization.",
      401,
      "verification_required",
      { nextPath: "/onboarding/account-verification" },
    );
  }
  return session;
}

function handleError(error: unknown) {
  if (error instanceof OrganizationWorkflowError) {
    return noStore({ error: error.message, code: error.code, details: error.details }, error.status);
  }
  if (error instanceof DatabaseConfigurationError) {
    return noStore(
      {
        error: "Organization onboarding requires the RFxchange PostgreSQL database. Set DATABASE_URL and apply the organization-selection migration.",
        code: "database_not_configured",
      },
      503,
    );
  }
  console.error("Organization onboarding request failed", error);
  return noStore({ error: "Organization onboarding is temporarily unavailable.", code: "request_failed" }, 503);
}

export async function GET(request: NextRequest) {
  try {
    const session = requireSession(request);
    const params = request.nextUrl.searchParams;

    if (params.get("state") === "1") {
      return noStore({ resolution: await getOrganizationState(session) });
    }

    const invitation = params.get("invitation")?.trim();
    if (invitation) return noStore({ invitation: await resolveInvitation(session, invitation) });

    const requestId = params.get("request")?.trim();
    if (requestId) return noStore({ review: await getOrganizationAccessReview(session, requestId) });

    const claimId = params.get("claim")?.trim();
    if (claimId) return noStore({ review: await getOrganizationClaimReview(session, claimId) });

    const organizationId = params.get("id")?.trim();
    if (organizationId) {
      const organization = await getOrganization(organizationId);
      if (!organization) return noStore({ error: "Organization not found.", code: "organization_not_found" }, 404);
      return noStore({ organization });
    }

    const query = params.get("q")?.trim() ?? "";
    const domain = normalizeDomain(params.get("domain") ?? "");
    if (query.length > 120 || domain.length > 120) {
      return noStore({ error: "Search input is too long.", code: "invalid_search" }, 400);
    }

    return noStore({ organizations: await searchOrganizations({ query, domain }) });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = requireSession(request);
    const raw = await request.json().catch(() => null);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return noStore({ error: "A valid organization workflow request is required.", code: "invalid_request" }, 400);
    }
    const body = raw as OrganizationMutationRequest;

    if (body.action === "accept_invitation") {
      if (!body.invitationToken?.trim()) {
        return noStore({ error: "Invitation token is required.", code: "invalid_request" }, 400);
      }
      return noStore({ resolution: await acceptInvitation(session, body.invitationToken.trim(), body.context) });
    }

    if (body.action === "request_access") {
      if (!body.organizationId?.trim()) {
        return noStore({ error: "Organization is required.", code: "invalid_request" }, 400);
      }
      return noStore({
        resolution: await requestOrganizationAccess(session, {
          organizationId: body.organizationId.trim(),
          requestedRole: sanitizeOrganizationUserRole(body.requestedRole),
          context: body.context,
        }),
      }, 202);
    }

    if (body.action === "claim") {
      if (!body.organizationId?.trim()) {
        return noStore({ error: "Organization is required.", code: "invalid_request" }, 400);
      }
      const authorityMethod = body.authorityMethod === "domain_email" ? "domain_email" : "manual_review";
      const resolution = await claimOrganization(session, {
        organizationId: body.organizationId.trim(),
        authorityMethod,
        evidenceNote: typeof body.evidenceNote === "string" ? body.evidenceNote.trim().slice(0, 1200) : undefined,
        context: body.context,
      });
      return noStore({ resolution }, resolution.status === "connected" ? 200 : 202);
    }

    if (body.action === "create") {
      const type = sanitizeOrganizationType(body.type);
      if (!body.name?.trim() || !type) {
        return noStore({ error: "Organization name and type are required.", code: "invalid_request" }, 400);
      }
      return noStore({
        resolution: await createOrganization(session, {
          name: body.name.trim(),
          type,
          website: typeof body.website === "string" ? body.website.trim() : undefined,
          context: body.context,
        }),
      }, 201);
    }

    if (body.action === "review_access") {
      if (!body.requestId?.trim() || (body.decision !== "approve" && body.decision !== "deny")) {
        return noStore({ error: "Access request and decision are required.", code: "invalid_request" }, 400);
      }
      return noStore({
        review: await reviewOrganizationAccessRequest(session, {
          requestId: body.requestId.trim(),
          decision: body.decision,
        }),
      });
    }

    if (body.action === "review_claim") {
      if (!body.claimId?.trim() || (body.decision !== "approve" && body.decision !== "deny")) {
        return noStore({ error: "Claim and decision are required.", code: "invalid_request" }, 400);
      }
      return noStore({
        review: await reviewOrganizationClaim(session, {
          claimId: body.claimId.trim(),
          decision: body.decision,
        }),
      });
    }

    return noStore({ error: "Unsupported organization workflow action.", code: "unsupported_action" }, 400);
  } catch (error) {
    return handleError(error);
  }
}
