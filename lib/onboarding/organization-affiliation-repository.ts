import type { Sql } from "postgres";
import type { OnboardingSession } from "@/lib/identity/onboarding-session";
import { getDatabase } from "@/lib/server/database";
import {
  normalizeDomain,
  sanitizeOrganizationAuthorityMethod,
  sanitizeOrganizationType,
  sanitizeOrganizationUserRole,
  type OrganizationAuthorityMethod,
  type OrganizationCandidate,
  type OrganizationEntryContext,
  type OrganizationResolution,
  type OrganizationUserRole,
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

async function assertPrimaryOrganizationAvailable(sql: Sql, userId: string, targetOrganizationId?: string) {
  const rows = await sql<{ organization_id: string }[]>`
    SELECT organization_id::text
    FROM organization_memberships
    WHERE user_id = ${userId}::uuid AND is_primary = true AND status = 'active'
    LIMIT 1
  `;
  const existing = rows[0]?.organization_id;
  if (existing && existing !== targetOrganizationId) {
    throw new OrganizationWorkflowError(
      "This account already has a primary organization. Additional organizations must be added later from the authenticated organization switcher.",
      409,
      "primary_organization_exists",
    );
  }
}

function acquisitionContext(context: OrganizationEntryContext | undefined) {
  return {
    source: context?.source,
    campaign: context?.campaign,
    referral: context?.referral,
    returnTo: context?.returnTo,
  };
}

function emailDomain(email: string) {
  return email.split("@")[1]?.toLowerCase() ?? "";
}

function safeHttpsUrl(value: string | undefined) {
  if (!value?.trim()) return undefined;
  const candidate = value.trim().slice(0, 1200);
  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:") throw new Error("not https");
    return url.toString();
  } catch {
    throw new OrganizationWorkflowError("Authority evidence links must be valid HTTPS URLs.", 400, "invalid_evidence_url");
  }
}

function evidenceForMethod(input: {
  authorityMethod: OrganizationAuthorityMethod;
  evidenceNote?: string;
  evidenceUrl?: string;
  evidenceReference?: string;
}) {
  const method = sanitizeOrganizationAuthorityMethod(input.authorityMethod);
  const note = input.evidenceNote?.trim().slice(0, 1200) || undefined;
  const reference = input.evidenceReference?.trim().slice(0, 300) || undefined;
  const url = safeHttpsUrl(input.evidenceUrl);

  if (method === "registry_record" && !reference && !url) {
    throw new OrganizationWorkflowError(
      "Provide an authoritative registry reference or HTTPS record URL.",
      400,
      "registry_evidence_required",
    );
  }
  if (method === "supporting_document" && !url) {
    throw new OrganizationWorkflowError(
      "Provide an HTTPS link to the supporting authority document.",
      400,
      "supporting_document_required",
    );
  }
  if (method === "manual_review" && (!note || note.length < 10)) {
    throw new OrganizationWorkflowError(
      "Provide a concise authority statement for manual review.",
      400,
      "authority_note_required",
    );
  }

  return { method, note, reference, url };
}

async function persistPendingState(
  sql: Sql,
  actorId: string,
  resolution: OrganizationResolution,
  context?: OrganizationEntryContext,
) {
  await sql`
    INSERT INTO organization_onboarding_state (
      user_id, organization_id, resolution_mode, membership_state, authority_state,
      organization_role, current_step, request_id, claim_id, acquisition_context, updated_at
    ) VALUES (
      ${actorId}::uuid,
      ${resolution.organizationId}::uuid,
      ${resolution.mode},
      ${resolution.membershipState},
      ${resolution.authorityState},
      ${resolution.role ?? null},
      'status.pending',
      ${resolution.requestId ?? null}::uuid,
      ${resolution.claimId ?? null}::uuid,
      ${sql.json(acquisitionContext(context))},
      now()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      organization_id = EXCLUDED.organization_id,
      resolution_mode = EXCLUDED.resolution_mode,
      membership_state = EXCLUDED.membership_state,
      authority_state = EXCLUDED.authority_state,
      organization_role = EXCLUDED.organization_role,
      current_step = EXCLUDED.current_step,
      request_id = EXCLUDED.request_id,
      claim_id = EXCLUDED.claim_id,
      acquisition_context = EXCLUDED.acquisition_context,
      updated_at = now()
  `;
}

function connectedClaimResolution(candidate: OrganizationCandidate, claimId?: string): OrganizationResolution {
  const params = new URLSearchParams({
    organizationId: candidate.id,
    organizationName: candidate.name,
    claimMode: "claimed",
  });
  return {
    status: "connected",
    mode: "claim",
    organizationId: candidate.id,
    organizationName: candidate.name,
    organizationType: candidate.type,
    website: candidate.website,
    membershipState: "active",
    authorityState: "domain-verified",
    role: "primary_admin",
    claimId,
    nextPath: `/onboarding/geography?${params.toString()}`,
  };
}

export async function requestOrganizationAccess(
  session: OnboardingSession,
  input: { organizationId: string; requestedRole: OrganizationUserRole; context?: OrganizationEntryContext },
) {
  const sql = getDatabase();
  const actor = await ensureActor(sql, session);
  const candidate = await candidateById(sql, input.organizationId);
  if (!candidate) throw new OrganizationWorkflowError("Organization not found.", 404, "organization_not_found");
  if (candidate.claimState === "unclaimed") {
    throw new OrganizationWorkflowError("Unclaimed organizations must use the claim workflow.", 409, "claim_required");
  }
  await assertPrimaryOrganizationAvailable(sql, actor.id, candidate.id);

  const requestedRole = sanitizeOrganizationUserRole(input.requestedRole);
  const rows = await sql<{ id: string }[]>`
    INSERT INTO organization_join_requests (organization_id, requester_user_id, requested_role, acquisition_context)
    VALUES (${candidate.id}::uuid, ${actor.id}::uuid, ${requestedRole}, ${sql.json(acquisitionContext(input.context))})
    ON CONFLICT (organization_id, requester_user_id) WHERE status = 'pending' DO UPDATE SET
      requested_role = EXCLUDED.requested_role,
      acquisition_context = EXCLUDED.acquisition_context
    RETURNING id::text
  `;
  const requestId = rows[0]?.id;
  if (!requestId) throw new OrganizationWorkflowError("Access request could not be created.", 500, "request_failed");

  const resolution: OrganizationResolution = {
    status: "pending",
    mode: "join",
    organizationId: candidate.id,
    organizationName: candidate.name,
    organizationType: candidate.type,
    website: candidate.website,
    membershipState: "pending-approval",
    authorityState: "pending-review",
    role: requestedRole,
    requestId,
    nextPath: `/onboarding/organization?step=status.pending&request=${encodeURIComponent(requestId)}`,
  };
  await persistPendingState(sql, actor.id, resolution, input.context);
  await sql`
    INSERT INTO activity_events (event_name, actor_user_id, organization_id, payload)
    VALUES (
      'OrganizationAccessRequested',
      ${actor.id}::uuid,
      ${candidate.id}::uuid,
      ${sql.json({ requestId, requestedRole })}
    )
  `;
  return resolution;
}

export async function claimOrganization(
  session: OnboardingSession,
  input: {
    organizationId: string;
    authorityMethod: OrganizationAuthorityMethod;
    evidenceNote?: string;
    evidenceUrl?: string;
    evidenceReference?: string;
    context?: OrganizationEntryContext;
  },
) {
  const sql = getDatabase();
  const actor = await ensureActor(sql, session);
  const candidate = await candidateById(sql, input.organizationId);
  if (!candidate) throw new OrganizationWorkflowError("Organization not found.", 404, "organization_not_found");
  if (candidate.claimState !== "unclaimed") {
    throw new OrganizationWorkflowError("This organization is already claimed. Request access instead.", 409, "already_claimed");
  }
  await assertPrimaryOrganizationAvailable(sql, actor.id, candidate.id);

  const evidence = evidenceForMethod(input);
  const domainMatches = Boolean(candidate.domain && emailDomain(actor.email) === normalizeDomain(candidate.domain));
  if (evidence.method === "domain_email" && !domainMatches) {
    throw new OrganizationWorkflowError(
      "Your verified email domain does not match the organization's primary domain.",
      409,
      "domain_mismatch",
    );
  }

  if (evidence.method === "domain_email" && domainMatches) {
    return sql.begin(async (tx) => {
      const claimRows = await tx<{ id: string }[]>`
        INSERT INTO organization_claims (
          organization_id, claimant_user_id, authority_method, evidence_note, status,
          acquisition_context, resolved_at
        ) VALUES (
          ${candidate.id}::uuid,
          ${actor.id}::uuid,
          'domain_email',
          ${evidence.note ?? null},
          'approved',
          ${tx.json(acquisitionContext(input.context))},
          now()
        )
        RETURNING id::text
      `;
      const claimId = claimRows[0]?.id;
      await tx`
        UPDATE organization_identity
        SET claim_state = 'claimed', updated_at = now()
        WHERE organization_id = ${candidate.id}::uuid
      `;
      await tx`
        INSERT INTO organization_memberships (organization_id, user_id, role, permissions, status, is_primary)
        VALUES (
          ${candidate.id}::uuid,
          ${actor.id}::uuid,
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
      const resolution = connectedClaimResolution(candidate, claimId);
      await tx`
        INSERT INTO organization_onboarding_state (
          user_id, organization_id, resolution_mode, membership_state, authority_state,
          organization_role, current_step, request_id, claim_id, acquisition_context, updated_at
        ) VALUES (
          ${actor.id}::uuid, ${candidate.id}::uuid, 'claim', 'active', 'domain-verified',
          'primary_admin', 'status.connected', NULL, ${claimId ?? null}::uuid,
          ${tx.json(acquisitionContext(input.context))}, now()
        )
        ON CONFLICT (user_id) DO UPDATE SET
          organization_id = EXCLUDED.organization_id,
          resolution_mode = EXCLUDED.resolution_mode,
          membership_state = EXCLUDED.membership_state,
          authority_state = EXCLUDED.authority_state,
          organization_role = EXCLUDED.organization_role,
          current_step = EXCLUDED.current_step,
          request_id = NULL,
          claim_id = EXCLUDED.claim_id,
          acquisition_context = EXCLUDED.acquisition_context,
          updated_at = now()
      `;
      await tx`
        INSERT INTO activity_events (event_name, actor_user_id, organization_id, payload)
        VALUES (
          'OrganizationClaimApproved',
          ${actor.id}::uuid,
          ${candidate.id}::uuid,
          ${tx.json({ claimId, authorityMethod: "domain_email" })}
        )
      `;
      return resolution;
    });
  }

  const existingClaims = await sql<{ id: string }[]>`
    SELECT id::text
    FROM organization_claims
    WHERE organization_id = ${candidate.id}::uuid
      AND claimant_user_id <> ${actor.id}::uuid
      AND status IN ('pending', 'conflict')
  `;
  const claimStatus = existingClaims.length ? "conflict" : "pending";

  return sql.begin(async (tx) => {
    if (existingClaims.length) {
      await tx`
        UPDATE organization_claims
        SET status = 'conflict'
        WHERE organization_id = ${candidate.id}::uuid AND status = 'pending'
      `;
    }

    const rows = await tx<{ id: string }[]>`
      INSERT INTO organization_claims (
        organization_id, claimant_user_id, authority_method, evidence_note, status, acquisition_context
      ) VALUES (
        ${candidate.id}::uuid,
        ${actor.id}::uuid,
        ${evidence.method},
        ${evidence.note ?? null},
        ${claimStatus},
        ${tx.json(acquisitionContext(input.context))}
      )
      ON CONFLICT (organization_id, claimant_user_id) WHERE status IN ('pending', 'conflict') DO UPDATE SET
        authority_method = EXCLUDED.authority_method,
        evidence_note = EXCLUDED.evidence_note,
        status = EXCLUDED.status,
        acquisition_context = EXCLUDED.acquisition_context
      RETURNING id::text
    `;
    const claimId = rows[0]?.id;
    if (!claimId) throw new OrganizationWorkflowError("Claim could not be submitted.", 500, "claim_failed");

    await tx`DELETE FROM organization_claim_evidence WHERE claim_id = ${claimId}::uuid`;
    if (evidence.method === "registry_record") {
      await tx`
        INSERT INTO organization_claim_evidence (
          claim_id, evidence_type, label, evidence_reference, evidence_url
        ) VALUES (
          ${claimId}::uuid, 'registry_record', 'Authoritative public / registry record',
          ${evidence.reference ?? null}, ${evidence.url ?? null}
        )
      `;
    } else if (evidence.method === "supporting_document") {
      await tx`
        INSERT INTO organization_claim_evidence (
          claim_id, evidence_type, label, evidence_reference, evidence_url
        ) VALUES (
          ${claimId}::uuid, 'supporting_document', 'Supporting authority documentation',
          ${evidence.reference ?? null}, ${evidence.url ?? null}
        )
      `;
    } else if (evidence.method === "manual_review" && evidence.note) {
      await tx`
        INSERT INTO organization_claim_evidence (
          claim_id, evidence_type, label, evidence_reference
        ) VALUES (
          ${claimId}::uuid, 'authority_note', 'Claimant authority statement', ${evidence.note}
        )
      `;
    }

    const resolution: OrganizationResolution = {
      status: "pending",
      mode: "claim",
      organizationId: candidate.id,
      organizationName: candidate.name,
      organizationType: candidate.type,
      website: candidate.website,
      membershipState: "authority-pending",
      authorityState: "pending-review",
      role: "primary_admin",
      claimId,
      nextPath: `/onboarding/organization?step=status.pending&organization=${encodeURIComponent(candidate.id)}`,
    };

    await tx`
      INSERT INTO organization_onboarding_state (
        user_id, organization_id, resolution_mode, membership_state, authority_state,
        organization_role, current_step, request_id, claim_id, acquisition_context, updated_at
      ) VALUES (
        ${actor.id}::uuid, ${candidate.id}::uuid, 'claim', 'authority-pending', 'pending-review',
        'primary_admin', 'status.pending', NULL, ${claimId}::uuid,
        ${tx.json(acquisitionContext(input.context))}, now()
      )
      ON CONFLICT (user_id) DO UPDATE SET
        organization_id = EXCLUDED.organization_id,
        resolution_mode = EXCLUDED.resolution_mode,
        membership_state = EXCLUDED.membership_state,
        authority_state = EXCLUDED.authority_state,
        organization_role = EXCLUDED.organization_role,
        current_step = EXCLUDED.current_step,
        request_id = NULL,
        claim_id = EXCLUDED.claim_id,
        acquisition_context = EXCLUDED.acquisition_context,
        updated_at = now()
    `;
    await tx`
      INSERT INTO activity_events (event_name, actor_user_id, organization_id, payload)
      VALUES (
        'OrganizationClaimSubmitted',
        ${actor.id}::uuid,
        ${candidate.id}::uuid,
        ${tx.json({ claimId, authorityMethod: evidence.method, competingClaim: existingClaims.length > 0 })}
      )
    `;
    return resolution;
  });
}
