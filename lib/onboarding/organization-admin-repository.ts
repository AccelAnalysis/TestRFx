import type { Sql } from "postgres";
import type { OnboardingSession } from "@/lib/identity/onboarding-session";
import { getDatabase } from "@/lib/server/database";
import {
  sanitizeOrganizationType,
  type OrganizationAccessReview,
  type OrganizationCandidate,
} from "./organization";
import { OrganizationWorkflowError } from "./organization-repository";

type Actor = { id: string; email: string; displayName: string };

type CandidateRow = {
  id: string;
  name: string;
  organization_type: string | null;
  website: string | null;
  primary_domain: string | null;
  claim_state: "unclaimed" | "claimed" | "verified" | null;
  aliases: string[] | null;
  locality: string | null;
  region: string | null;
};

function candidateFromRow(row: CandidateRow): OrganizationCandidate {
  return {
    id: row.id,
    name: row.name,
    aliases: row.aliases ?? [],
    type: sanitizeOrganizationType(row.organization_type) ?? "Other",
    website: row.website ?? undefined,
    domain: row.primary_domain ?? undefined,
    locality: row.locality ?? undefined,
    region: row.region ?? undefined,
    claimState: row.claim_state ?? "claimed",
  };
}

async function ensureActor(sql: Sql, session: OnboardingSession): Promise<Actor> {
  const displayName = session.displayName?.trim() || session.email.split("@")[0] || session.email;
  const rows = await sql<{ id: string; email: string; display_name: string }[]>`
    INSERT INTO users (email, display_name, email_verified_at, account_status)
    VALUES (${session.email}, ${displayName}, to_timestamp(${session.verifiedAt}), 'verified')
    ON CONFLICT (email) DO UPDATE SET
      display_name = CASE WHEN btrim(users.display_name) = '' THEN EXCLUDED.display_name ELSE users.display_name END,
      email_verified_at = COALESCE(users.email_verified_at, EXCLUDED.email_verified_at),
      account_status = 'verified'
    RETURNING id::text, email, display_name
  `;
  const row = rows[0];
  if (!row) throw new OrganizationWorkflowError("Verified account identity could not be established.", 500, "actor_unavailable");
  return { id: row.id, email: row.email, displayName: row.display_name };
}

async function candidateById(sql: Sql, organizationId: string): Promise<OrganizationCandidate | null> {
  const rows = await sql<CandidateRow[]>`
    SELECT
      o.id::text,
      o.name,
      oi.organization_type,
      oi.website,
      oi.primary_domain,
      oi.claim_state,
      COALESCE(array_agg(DISTINCT oa.alias) FILTER (WHERE oa.alias IS NOT NULL), ARRAY[]::text[]) AS aliases,
      loc.address->>'city' AS locality,
      COALESCE(loc.address->>'region', loc.address->>'state') AS region
    FROM organizations o
    LEFT JOIN organization_identity oi ON oi.organization_id = o.id
    LEFT JOIN organization_aliases oa ON oa.organization_id = o.id
    LEFT JOIN LATERAL (
      SELECT address FROM locations WHERE organization_id = o.id ORDER BY created_at ASC LIMIT 1
    ) loc ON true
    WHERE o.id = ${organizationId}::uuid
    GROUP BY o.id, o.name, oi.organization_type, oi.website, oi.primary_domain, oi.claim_state, loc.address
    LIMIT 1
  `;
  return rows[0] ? candidateFromRow(rows[0]) : null;
}

async function authorizedAccessRequest(sql: Sql, actorId: string, requestId: string) {
  const rows = await sql<{
    request_id: string;
    organization_id: string;
    requester_user_id: string;
    requester_email: string;
    requester_name: string;
    requested_role: string;
    created_at: Date;
  }[]>`
    SELECT
      r.id::text AS request_id,
      r.organization_id::text,
      r.requester_user_id::text,
      u.email AS requester_email,
      u.display_name AS requester_name,
      r.requested_role,
      r.created_at
    FROM organization_join_requests r
    JOIN users u ON u.id = r.requester_user_id
    JOIN organization_memberships reviewer
      ON reviewer.organization_id = r.organization_id
      AND reviewer.user_id = ${actorId}::uuid
      AND reviewer.status = 'active'
    WHERE r.id = ${requestId}::uuid
      AND r.status = 'pending'
      AND (reviewer.role = 'primary_admin' OR reviewer.permissions ? 'organization.members.manage')
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function getOrganizationAccessReview(
  session: OnboardingSession,
  requestId: string,
): Promise<OrganizationAccessReview> {
  const sql = getDatabase();
  const actor = await ensureActor(sql, session);
  const row = await authorizedAccessRequest(sql, actor.id, requestId);
  if (!row) {
    throw new OrganizationWorkflowError(
      "This access request is unavailable or you are not authorized to review it.",
      404,
      "access_review_unavailable",
    );
  }
  const organization = await candidateById(sql, row.organization_id);
  if (!organization) throw new OrganizationWorkflowError("Organization not found.", 404, "organization_not_found");
  return {
    requestId: row.request_id,
    organization,
    requesterEmail: row.requester_email,
    requesterName: row.requester_name,
    requestedRole: row.requested_role,
    createdAt: row.created_at.toISOString(),
  };
}

export async function reviewOrganizationAccessRequest(
  session: OnboardingSession,
  input: { requestId: string; decision: "approve" | "deny" },
) {
  const sql = getDatabase();
  const actor = await ensureActor(sql, session);
  const review = await authorizedAccessRequest(sql, actor.id, input.requestId);
  if (!review) {
    throw new OrganizationWorkflowError(
      "This access request is unavailable or you are not authorized to review it.",
      404,
      "access_review_unavailable",
    );
  }

  return sql.begin(async (tx) => {
    const requestRows = await tx<{
      requester_user_id: string;
      organization_id: string;
      requested_role: string;
    }[]>`
      UPDATE organization_join_requests
      SET status = ${input.decision === "approve" ? "approved" : "denied"},
          resolved_at = now(),
          resolved_by_user_id = ${actor.id}::uuid
      WHERE id = ${input.requestId}::uuid AND status = 'pending'
      RETURNING requester_user_id::text, organization_id::text, requested_role
    `;
    const request = requestRows[0];
    if (!request) {
      throw new OrganizationWorkflowError("This access request has already been resolved.", 409, "access_already_resolved");
    }

    if (input.decision === "approve") {
      const primaryRows = await tx<{ has_primary: boolean }[]>`
        SELECT EXISTS(
          SELECT 1 FROM organization_memberships
          WHERE user_id = ${request.requester_user_id}::uuid AND is_primary = true AND status = 'active'
        ) AS has_primary
      `;
      const makePrimary = !primaryRows[0]?.has_primary;

      await tx`
        INSERT INTO organization_memberships (organization_id, user_id, role, permissions, status, is_primary)
        VALUES (
          ${request.organization_id}::uuid,
          ${request.requester_user_id}::uuid,
          ${request.requested_role},
          ${tx.json([])},
          'active',
          ${makePrimary}
        )
        ON CONFLICT (organization_id, user_id) DO UPDATE SET
          role = EXCLUDED.role,
          status = 'active',
          is_primary = CASE WHEN organization_memberships.is_primary THEN true ELSE EXCLUDED.is_primary END,
          updated_at = now()
      `;
      await tx`
        UPDATE organization_onboarding_state
        SET membership_state = 'active',
            authority_state = 'admin-approved',
            current_step = 'status.connected',
            updated_at = now()
        WHERE user_id = ${request.requester_user_id}::uuid
          AND request_id = ${input.requestId}::uuid
      `;
    } else {
      await tx`
        UPDATE organization_onboarding_state
        SET organization_id = NULL,
            resolution_mode = NULL,
            membership_state = NULL,
            authority_state = NULL,
            organization_role = NULL,
            current_step = 'affiliation',
            request_id = NULL,
            updated_at = now()
        WHERE user_id = ${request.requester_user_id}::uuid
          AND request_id = ${input.requestId}::uuid
      `;
    }

    await tx`
      INSERT INTO activity_events (event_name, actor_user_id, organization_id, payload)
      VALUES (
        ${input.decision === "approve" ? "OrganizationAccessApproved" : "OrganizationAccessDenied"},
        ${actor.id}::uuid,
        ${request.organization_id}::uuid,
        ${tx.json({ requestId: input.requestId, requesterUserId: request.requester_user_id })}
      )
    `;

    return { status: input.decision === "approve" ? "approved" : "denied", requestId: input.requestId };
  });
}
