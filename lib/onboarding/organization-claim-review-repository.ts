import type { Sql } from "postgres";
import type { OnboardingSession } from "@/lib/identity/onboarding-session";
import { getDatabase } from "@/lib/server/database";
import {
  sanitizeOrganizationAuthorityMethod,
  sanitizeOrganizationType,
  type OrganizationCandidate,
  type OrganizationClaimEvidence,
  type OrganizationClaimReview,
  type OrganizationClaimReviewItem,
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

async function assertPlatformClaimReviewer(sql: Sql, actorId: string) {
  const rows = await sql<{ allowed: boolean }[]>`
    SELECT EXISTS(
      SELECT 1 FROM platform_user_roles
      WHERE user_id = ${actorId}::uuid AND role = 'platform_admin'
    ) AS allowed
  `;
  if (!rows[0]?.allowed) {
    throw new OrganizationWorkflowError(
      "Platform administrator authorization is required to review organization claims.",
      403,
      "platform_admin_required",
    );
  }
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

export async function getOrganizationClaimReview(
  session: OnboardingSession,
  claimId: string,
): Promise<OrganizationClaimReview> {
  const sql = getDatabase();
  const actor = await ensureActor(sql, session);
  await assertPlatformClaimReviewer(sql, actor.id);

  const selectedRows = await sql<{ organization_id: string }[]>`
    SELECT organization_id::text
    FROM organization_claims
    WHERE id = ${claimId}::uuid AND status IN ('pending', 'conflict')
    LIMIT 1
  `;
  const organizationId = selectedRows[0]?.organization_id;
  if (!organizationId) {
    throw new OrganizationWorkflowError("This organization claim is unavailable for review.", 404, "claim_review_unavailable");
  }
  const organization = await candidateById(sql, organizationId);
  if (!organization) throw new OrganizationWorkflowError("Organization not found.", 404, "organization_not_found");

  const claimRows = await sql<{
    claim_id: string;
    claimant_email: string;
    claimant_name: string;
    authority_method: string;
    evidence_note: string | null;
    status: "pending" | "conflict";
    created_at: Date;
  }[]>`
    SELECT
      c.id::text AS claim_id,
      u.email AS claimant_email,
      u.display_name AS claimant_name,
      c.authority_method,
      c.evidence_note,
      c.status,
      c.created_at
    FROM organization_claims c
    JOIN users u ON u.id = c.claimant_user_id
    WHERE c.organization_id = ${organizationId}::uuid
      AND c.status IN ('pending', 'conflict')
    ORDER BY c.created_at ASC
  `;

  const evidenceRows = await sql<{
    id: string;
    claim_id: string;
    evidence_type: OrganizationClaimEvidence["type"];
    label: string | null;
    evidence_reference: string | null;
    evidence_url: string | null;
    created_at: Date;
  }[]>`
    SELECT id::text, claim_id::text, evidence_type, label, evidence_reference, evidence_url, created_at
    FROM organization_claim_evidence
    WHERE claim_id IN (
      SELECT id FROM organization_claims
      WHERE organization_id = ${organizationId}::uuid AND status IN ('pending', 'conflict')
    )
    ORDER BY created_at ASC
  `;

  const evidenceByClaim = new Map<string, OrganizationClaimEvidence[]>();
  for (const row of evidenceRows) {
    const evidence: OrganizationClaimEvidence = {
      id: row.id,
      type: row.evidence_type,
      label: row.label ?? undefined,
      reference: row.evidence_reference ?? undefined,
      url: row.evidence_url ?? undefined,
      createdAt: row.created_at.toISOString(),
    };
    evidenceByClaim.set(row.claim_id, [...(evidenceByClaim.get(row.claim_id) ?? []), evidence]);
  }

  const claims: OrganizationClaimReviewItem[] = claimRows.map((claim) => ({
    claimId: claim.claim_id,
    claimantEmail: claim.claimant_email,
    claimantName: claim.claimant_name,
    authorityMethod: sanitizeOrganizationAuthorityMethod(claim.authority_method),
    evidenceNote: claim.evidence_note ?? undefined,
    evidence: evidenceByClaim.get(claim.claim_id) ?? [],
    status: claim.status,
    createdAt: claim.created_at.toISOString(),
  }));

  return { organization, selectedClaimId: claimId, claims };
}

export async function reviewOrganizationClaim(
  session: OnboardingSession,
  input: { claimId: string; decision: "approve" | "deny" },
) {
  const sql = getDatabase();
  const actor = await ensureActor(sql, session);
  await assertPlatformClaimReviewer(sql, actor.id);

  const claimRows = await sql<{
    claim_id: string;
    organization_id: string;
    claimant_user_id: string;
  }[]>`
    SELECT id::text AS claim_id, organization_id::text, claimant_user_id::text
    FROM organization_claims
    WHERE id = ${input.claimId}::uuid AND status IN ('pending', 'conflict')
    LIMIT 1
  `;
  const claim = claimRows[0];
  if (!claim) throw new OrganizationWorkflowError("This organization claim is unavailable for review.", 404, "claim_review_unavailable");

  if (input.decision === "approve") {
    const primaryRows = await sql<{ organization_id: string }[]>`
      SELECT organization_id::text
      FROM organization_memberships
      WHERE user_id = ${claim.claimant_user_id}::uuid
        AND is_primary = true
        AND status = 'active'
      LIMIT 1
    `;
    const existingPrimary = primaryRows[0]?.organization_id;
    if (existingPrimary && existingPrimary !== claim.organization_id) {
      throw new OrganizationWorkflowError(
        "The claimant already has another active primary organization. Resolve that membership before approving this claim.",
        409,
        "primary_organization_exists",
      );
    }
  }

  return sql.begin(async (tx) => {
    if (input.decision === "approve") {
      await tx`
        UPDATE organization_claims
        SET status = CASE WHEN id = ${input.claimId}::uuid THEN 'approved' ELSE 'denied' END,
            resolved_at = now(),
            resolved_by_user_id = ${actor.id}::uuid
        WHERE organization_id = ${claim.organization_id}::uuid
          AND status IN ('pending', 'conflict')
      `;
      await tx`
        UPDATE organization_identity
        SET claim_state = 'claimed', updated_at = now()
        WHERE organization_id = ${claim.organization_id}::uuid
      `;
      await tx`
        INSERT INTO organization_memberships (organization_id, user_id, role, permissions, status, is_primary)
        VALUES (
          ${claim.organization_id}::uuid,
          ${claim.claimant_user_id}::uuid,
          'primary_admin',
          ${tx.json(["organization.manage", "organization.members.manage", "organization.profile.edit"])},
          'active',
          true
        )
        ON CONFLICT (organization_id, user_id) DO UPDATE SET
          role = 'primary_admin',
          permissions = EXCLUDED.permissions,
          status = 'active',
          is_primary = true,
          updated_at = now()
      `;
      await tx`
        UPDATE organization_onboarding_state
        SET membership_state = 'active',
            authority_state = 'admin-approved',
            current_step = 'status.connected',
            updated_at = now()
        WHERE user_id = ${claim.claimant_user_id}::uuid
          AND claim_id = ${input.claimId}::uuid
      `;
      await tx`
        UPDATE organization_onboarding_state s
        SET organization_id = NULL,
            resolution_mode = NULL,
            membership_state = NULL,
            authority_state = NULL,
            organization_role = NULL,
            current_step = 'affiliation',
            claim_id = NULL,
            updated_at = now()
        WHERE s.organization_id = ${claim.organization_id}::uuid
          AND s.user_id <> ${claim.claimant_user_id}::uuid
          AND s.claim_id IN (
            SELECT id FROM organization_claims
            WHERE organization_id = ${claim.organization_id}::uuid AND status = 'denied'
          )
      `;
    } else {
      await tx`
        UPDATE organization_claims
        SET status = 'denied', resolved_at = now(), resolved_by_user_id = ${actor.id}::uuid
        WHERE id = ${input.claimId}::uuid AND status IN ('pending', 'conflict')
      `;
      await tx`
        UPDATE organization_onboarding_state
        SET organization_id = NULL,
            resolution_mode = NULL,
            membership_state = NULL,
            authority_state = NULL,
            organization_role = NULL,
            current_step = 'affiliation',
            claim_id = NULL,
            updated_at = now()
        WHERE user_id = ${claim.claimant_user_id}::uuid
          AND claim_id = ${input.claimId}::uuid
      `;
    }

    await tx`
      INSERT INTO activity_events (event_name, actor_user_id, organization_id, payload)
      VALUES (
        ${input.decision === "approve" ? "OrganizationClaimApprovedByAdmin" : "OrganizationClaimDeniedByAdmin"},
        ${actor.id}::uuid,
        ${claim.organization_id}::uuid,
        ${tx.json({ claimId: input.claimId, claimantUserId: claim.claimant_user_id })}
      )
    `;

    return { status: input.decision === "approve" ? "approved" : "denied", claimId: input.claimId };
  });
}
