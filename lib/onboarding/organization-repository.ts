import { createHash, randomUUID } from "node:crypto";
import type { Sql } from "postgres";
import { getDatabase } from "@/lib/server/database";
import type { OnboardingSession } from "@/lib/identity/onboarding-session";
import {
  normalizeDomain,
  normalizeOrganizationTerm,
  sanitizeOrganizationType,
  sanitizeOrganizationUserRole,
  type OrganizationAccessReview,
  type OrganizationCandidate,
  type OrganizationEntryContext,
  type OrganizationInvitation,
  type OrganizationResolution,
  type OrganizationType,
  type OrganizationUserRole,
} from "./organization";

export class OrganizationWorkflowError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
    public readonly code = "organization_workflow_error",
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "OrganizationWorkflowError";
  }
}

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
  match_score?: number | string | null;
};

type Actor = { id: string; email: string; displayName: string };

function candidateFromRow(row: CandidateRow): OrganizationCandidate {
  const score = row.match_score == null ? undefined : Number(row.match_score);
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
    ...(Number.isFinite(score) ? { matchScore: score } : {}),
  };
}

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest();
}

function emailDomain(email: string) {
  return email.split("@")[1]?.toLowerCase() ?? "";
}

function slugBase(name: string) {
  const normalized = normalizeOrganizationTerm(name).replace(/\s+/g, "-").replace(/^-+|-+$/g, "");
  return normalized || `organization-${randomUUID().slice(0, 8)}`;
}

function acquisitionContext(context: OrganizationEntryContext | undefined) {
  return {
    source: context?.source,
    campaign: context?.campaign,
    referral: context?.referral,
    returnTo: context?.returnTo,
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
      SELECT address
      FROM locations
      WHERE organization_id = o.id
      ORDER BY created_at ASC
      LIMIT 1
    ) loc ON true
    WHERE o.id = ${organizationId}::uuid
    GROUP BY o.id, o.name, oi.organization_type, oi.website, oi.primary_domain, oi.claim_state, loc.address
    LIMIT 1
  `;
  return rows[0] ? candidateFromRow(rows[0]) : null;
}

async function writeState(
  sql: Sql,
  actorId: string,
  resolution: OrganizationResolution,
  context?: OrganizationEntryContext,
) {
  await sql`
    INSERT INTO organization_onboarding_state (
      user_id,
      organization_id,
      resolution_mode,
      membership_state,
      authority_state,
      organization_role,
      current_step,
      request_id,
      claim_id,
      acquisition_context,
      updated_at
    ) VALUES (
      ${actorId}::uuid,
      ${resolution.organizationId}::uuid,
      ${resolution.mode},
      ${resolution.membershipState},
      ${resolution.authorityState},
      ${resolution.role ?? null},
      ${resolution.status === "connected" ? "status.connected" : "status.pending"},
      ${resolution.requestId ?? null}::uuid,
      ${resolution.claimId ?? null}::uuid,
      ${getDatabase().json(acquisitionContext(context))},
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

function connectedResolution(
  candidate: OrganizationCandidate,
  mode: OrganizationResolution["mode"],
  authorityState: OrganizationResolution["authorityState"],
  role: string,
): OrganizationResolution {
  const params = new URLSearchParams({
    organizationId: candidate.id,
    organizationName: candidate.name,
    claimMode: mode === "create" ? "created" : mode === "claim" ? "claimed" : "selected",
  });
  return {
    status: "connected",
    mode,
    organizationId: candidate.id,
    organizationName: candidate.name,
    organizationType: candidate.type,
    website: candidate.website,
    membershipState: "active",
    authorityState,
    role,
    nextPath: `/onboarding/geography?${params.toString()}`,
  };
}

export async function searchOrganizations(input: { query?: string; domain?: string }) {
  const sql = getDatabase();
  const query = input.query?.trim().slice(0, 120) ?? "";
  const domain = normalizeDomain(input.domain).slice(0, 120);

  let rows: CandidateRow[];
  if (!query && !domain) {
    rows = await sql<CandidateRow[]>`
      SELECT
        o.id::text,
        o.name,
        oi.organization_type,
        oi.website,
        oi.primary_domain,
        oi.claim_state,
        COALESCE(array_agg(DISTINCT oa.alias) FILTER (WHERE oa.alias IS NOT NULL), ARRAY[]::text[]) AS aliases,
        loc.address->>'city' AS locality,
        COALESCE(loc.address->>'region', loc.address->>'state') AS region,
        0::float AS match_score
      FROM organizations o
      LEFT JOIN organization_identity oi ON oi.organization_id = o.id
      LEFT JOIN organization_aliases oa ON oa.organization_id = o.id
      LEFT JOIN LATERAL (
        SELECT address FROM locations WHERE organization_id = o.id ORDER BY created_at ASC LIMIT 1
      ) loc ON true
      GROUP BY o.id, o.name, oi.organization_type, oi.website, oi.primary_domain, oi.claim_state, loc.address
      ORDER BY o.updated_at DESC
      LIMIT 8
    `;
  } else {
    const like = `%${query.toLowerCase()}%`;
    rows = await sql<CandidateRow[]>`
      SELECT
        o.id::text,
        o.name,
        oi.organization_type,
        oi.website,
        oi.primary_domain,
        oi.claim_state,
        COALESCE(array_agg(DISTINCT oa.alias) FILTER (WHERE oa.alias IS NOT NULL), ARRAY[]::text[]) AS aliases,
        loc.address->>'city' AS locality,
        COALESCE(loc.address->>'region', loc.address->>'state') AS region,
        GREATEST(
          CASE WHEN ${domain} <> '' AND lower(COALESCE(oi.primary_domain, '')) = ${domain} THEN 1.0 ELSE 0.0 END,
          CASE WHEN ${query} <> '' THEN similarity(lower(o.name), lower(${query})) ELSE 0.0 END,
          COALESCE(MAX(CASE WHEN ${query} <> '' THEN similarity(lower(oa.alias), lower(${query})) ELSE 0.0 END), 0.0)
        )::float AS match_score
      FROM organizations o
      LEFT JOIN organization_identity oi ON oi.organization_id = o.id
      LEFT JOIN organization_aliases oa ON oa.organization_id = o.id
      LEFT JOIN LATERAL (
        SELECT address FROM locations WHERE organization_id = o.id ORDER BY created_at ASC LIMIT 1
      ) loc ON true
      WHERE
        (${domain} <> '' AND lower(COALESCE(oi.primary_domain, '')) = ${domain})
        OR (${query} <> '' AND lower(o.name) LIKE ${like})
        OR (${query} <> '' AND similarity(lower(o.name), lower(${query})) >= 0.28)
        OR (${query} <> '' AND EXISTS (
          SELECT 1 FROM organization_aliases match_alias
          WHERE match_alias.organization_id = o.id
            AND (lower(match_alias.alias) LIKE ${like} OR similarity(lower(match_alias.alias), lower(${query})) >= 0.28)
        ))
      GROUP BY o.id, o.name, oi.organization_type, oi.website, oi.primary_domain, oi.claim_state, loc.address
      ORDER BY match_score DESC, o.name ASC
      LIMIT 12
    `;
  }

  return rows.map(candidateFromRow);
}

export async function getOrganization(organizationId: string) {
  return candidateById(getDatabase(), organizationId);
}

export async function getOrganizationState(session: OnboardingSession): Promise<OrganizationResolution | null> {
  const sql = getDatabase();
  const actor = await ensureActor(sql, session);
  const rows = await sql<{
    resolution_mode: OrganizationResolution["mode"] | null;
    membership_state: OrganizationResolution["membershipState"] | null;
    authority_state: OrganizationResolution["authorityState"] | null;
    organization_role: string | null;
    request_id: string | null;
    claim_id: string | null;
    id: string;
    name: string;
    organization_type: string | null;
    website: string | null;
  }[]>`
    SELECT
      s.resolution_mode,
      s.membership_state,
      s.authority_state,
      s.organization_role,
      s.request_id::text,
      s.claim_id::text,
      o.id::text,
      o.name,
      oi.organization_type,
      oi.website
    FROM organization_onboarding_state s
    JOIN organizations o ON o.id = s.organization_id
    LEFT JOIN organization_identity oi ON oi.organization_id = o.id
    WHERE s.user_id = ${actor.id}::uuid
    LIMIT 1
  `;
  const row = rows[0];
  if (!row || !row.resolution_mode || !row.membership_state || !row.authority_state) return null;
  const connected = row.membership_state === "active";
  return {
    status: connected ? "connected" : "pending",
    mode: row.resolution_mode,
    organizationId: row.id,
    organizationName: row.name,
    organizationType: sanitizeOrganizationType(row.organization_type) ?? "Other",
    website: row.website ?? undefined,
    membershipState: row.membership_state,
    authorityState: row.authority_state,
    role: row.organization_role ?? undefined,
    requestId: row.request_id ?? undefined,
    claimId: row.claim_id ?? undefined,
    nextPath: connected ? `/onboarding/geography?organizationId=${encodeURIComponent(row.id)}&organizationName=${encodeURIComponent(row.name)}` : "/onboarding/organization?step=status.pending",
  };
}

export async function resolveInvitation(session: OnboardingSession, rawToken: string): Promise<OrganizationInvitation> {
  const sql = getDatabase();
  const hash = tokenHash(rawToken);
  const rows = await sql<{
    invitation_id: string;
    organization_id: string;
    invited_email: string;
    role: string;
    expires_at: Date;
  }[]>`
    SELECT id::text AS invitation_id, organization_id::text, invited_email, role, expires_at
    FROM organization_invitations
    WHERE token_hash = ${hash}
      AND status = 'pending'
      AND expires_at > now()
    LIMIT 1
  `;
  const invitation = rows[0];
  if (!invitation) throw new OrganizationWorkflowError("This organization invitation is invalid or has expired.", 404, "invitation_invalid");
  if (invitation.invited_email.trim().toLowerCase() !== session.email.trim().toLowerCase()) {
    throw new OrganizationWorkflowError("This invitation was issued to a different verified email address.", 403, "invitation_email_mismatch");
  }
  const organization = await candidateById(sql, invitation.organization_id);
  if (!organization) throw new OrganizationWorkflowError("The invited organization no longer exists.", 404, "organization_not_found");
  return {
    id: invitation.invitation_id,
    organization,
    invitedEmail: invitation.invited_email,
    role: invitation.role,
    expiresAt: invitation.expires_at.toISOString(),
  };
}

export async function acceptInvitation(session: OnboardingSession, rawToken: string, context?: OrganizationEntryContext) {
  const sql = getDatabase();
  const actor = await ensureActor(sql, session);
  const invitation = await resolveInvitation(session, rawToken);
  await assertPrimaryOrganizationAvailable(sql, actor.id, invitation.organization.id);

  return sql.begin(async (tx) => {
    const rows = await tx<{ id: string; organization_id: string; role: string }[]>`
      UPDATE organization_invitations
      SET status = 'accepted', accepted_at = now()
      WHERE id = ${invitation.id}::uuid AND status = 'pending' AND expires_at > now()
      RETURNING id::text, organization_id::text, role
    `;
    const accepted = rows[0];
    if (!accepted) throw new OrganizationWorkflowError("This invitation is no longer available.", 409, "invitation_already_used");

    await tx`
      INSERT INTO organization_memberships (organization_id, user_id, role, permissions, status, is_primary)
      VALUES (
        ${accepted.organization_id}::uuid,
        ${actor.id}::uuid,
        ${accepted.role},
        ${tx.json([])},
        'active',
        true
      )
      ON CONFLICT (organization_id, user_id) DO UPDATE SET
        role = EXCLUDED.role,
        status = 'active',
        is_primary = true,
        updated_at = now()
    `;

    const resolution = connectedResolution(invitation.organization, "invitation", "invited", accepted.role);
    await writeState(tx, actor.id, resolution, context);
    await tx`
      INSERT INTO activity_events (event_name, actor_user_id, organization_id, payload)
      VALUES ('OrganizationInvitationAccepted', ${actor.id}::uuid, ${accepted.organization_id}::uuid, ${tx.json({ invitationId: invitation.id, role: accepted.role })})
    `;
    return resolution;
  });
}

export async function requestOrganizationAccess(
  session: OnboardingSession,
  input: { organizationId: string; requestedRole: OrganizationUserRole; context?: OrganizationEntryContext },
) {
  const sql = getDatabase();
  const actor = await ensureActor(sql, session);
  const candidate = await candidateById(sql, input.organizationId);
  if (!candidate) throw new OrganizationWorkflowError("Organization not found.", 404, "organization_not_found");
  if (candidate.claimState === "unclaimed") throw new OrganizationWorkflowError("Unclaimed organizations must use the claim workflow.", 409, "claim_required");
  await assertPrimaryOrganizationAvailable(sql, actor.id, candidate.id);

  const requestedRole = sanitizeOrganizationUserRole(input.requestedRole);
  const rows = await sql<{ id: string }[]>`
    INSERT INTO organization_join_requests (organization_id, requester_user_id, requested_role, acquisition_context)
    VALUES (${candidate.id}::uuid, ${actor.id}::uuid, ${requestedRole}, ${sql.json(acquisitionContext(input.context))})
    ON CONFLICT (organization_id, requester_user_id, status) DO UPDATE SET
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
  await writeState(sql, actor.id, resolution, input.context);
  await sql`
    INSERT INTO activity_events (event_name, actor_user_id, organization_id, payload)
    VALUES ('OrganizationAccessRequested', ${actor.id}::uuid, ${candidate.id}::uuid, ${sql.json({ requestId, requestedRole })})
  `;
  return resolution;
}

export async function claimOrganization(
  session: OnboardingSession,
  input: {
    organizationId: string;
    authorityMethod: "domain_email" | "manual_review";
    evidenceNote?: string;
    context?: OrganizationEntryContext;
  },
) {
  const sql = getDatabase();
  const actor = await ensureActor(sql, session);
  const candidate = await candidateById(sql, input.organizationId);
  if (!candidate) throw new OrganizationWorkflowError("Organization not found.", 404, "organization_not_found");
  if (candidate.claimState !== "unclaimed") throw new OrganizationWorkflowError("This organization is already claimed. Request access instead.", 409, "already_claimed");
  await assertPrimaryOrganizationAvailable(sql, actor.id, candidate.id);

  const domainMatches = Boolean(candidate.domain && emailDomain(actor.email) === normalizeDomain(candidate.domain));
  if (input.authorityMethod === "domain_email" && !domainMatches) {
    throw new OrganizationWorkflowError("Your verified email domain does not match the organization's primary domain.", 409, "domain_mismatch");
  }

  if (domainMatches && input.authorityMethod === "domain_email") {
    return sql.begin(async (tx) => {
      const claimRows = await tx<{ id: string }[]>`
        INSERT INTO organization_claims (
          organization_id, claimant_user_id, authority_method, evidence_note, status, acquisition_context, resolved_at
        ) VALUES (
          ${candidate.id}::uuid, ${actor.id}::uuid, 'domain_email', ${input.evidenceNote?.trim() || null}, 'approved', ${tx.json(acquisitionContext(input.context))}, now()
        )
        RETURNING id::text
      `;
      const claimId = claimRows[0]?.id;
      await tx`UPDATE organization_identity SET claim_state = 'claimed', updated_at = now() WHERE organization_id = ${candidate.id}::uuid`;
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
      const resolution = { ...connectedResolution(candidate, "claim", "domain-verified", "primary_admin"), claimId };
      await writeState(tx, actor.id, resolution, input.context);
      await tx`
        INSERT INTO activity_events (event_name, actor_user_id, organization_id, payload)
        VALUES ('OrganizationClaimApproved', ${actor.id}::uuid, ${candidate.id}::uuid, ${tx.json({ claimId, authorityMethod: "domain_email" })})
      `;
      return resolution;
    });
  }

  const rows = await sql<{ id: string }[]>`
    INSERT INTO organization_claims (
      organization_id, claimant_user_id, authority_method, evidence_note, acquisition_context
    ) VALUES (
      ${candidate.id}::uuid, ${actor.id}::uuid, 'manual_review', ${input.evidenceNote?.trim().slice(0, 1200) || null}, ${sql.json(acquisitionContext(input.context))}
    )
    ON CONFLICT (organization_id, claimant_user_id, status) DO UPDATE SET
      evidence_note = EXCLUDED.evidence_note,
      acquisition_context = EXCLUDED.acquisition_context
    RETURNING id::text
  `;
  const claimId = rows[0]?.id;
  if (!claimId) throw new OrganizationWorkflowError("Claim could not be submitted.", 500, "claim_failed");

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
  await writeState(sql, actor.id, resolution, input.context);
  await sql`
    INSERT INTO activity_events (event_name, actor_user_id, organization_id, payload)
    VALUES ('OrganizationClaimSubmitted', ${actor.id}::uuid, ${candidate.id}::uuid, ${sql.json({ claimId, authorityMethod: "manual_review" })})
  `;
  return resolution;
}

export async function createOrganization(
  session: OnboardingSession,
  input: { name: string; type: OrganizationType; website?: string; context?: OrganizationEntryContext },
) {
  const sql = getDatabase();
  const actor = await ensureActor(sql, session);
  await assertPrimaryOrganizationAvailable(sql, actor.id);

  const name = input.name.trim().slice(0, 180);
  const type = sanitizeOrganizationType(input.type);
  const website = input.website?.trim().slice(0, 300) || undefined;
  const domain = normalizeDomain(website);
  if (!name || !type) throw new OrganizationWorkflowError("Organization name and type are required.", 400, "invalid_organization");

  const matches = await searchOrganizations({ query: name, domain });
  const highConfidence = matches.filter((candidate) =>
    (domain && candidate.domain === domain) ||
    normalizeOrganizationTerm(candidate.name) === normalizeOrganizationTerm(name) ||
    (candidate.matchScore ?? 0) >= 0.72,
  );
  if (highConfidence.length) {
    throw new OrganizationWorkflowError(
      "A likely matching organization already exists. Resolve the duplicate before creating another organization.",
      409,
      "duplicate_organization",
      { organizations: highConfidence },
    );
  }

  return sql.begin(async (tx) => {
    const base = slugBase(name);
    let slug = base;
    const existing = await tx<{ slug: string }[]>`SELECT slug FROM organizations WHERE slug = ${slug} LIMIT 1`;
    if (existing.length) slug = `${base}-${randomUUID().slice(0, 8)}`;

    const organizationRows = await tx<{ id: string }[]>`
      INSERT INTO organizations (name, slug)
      VALUES (${name}, ${slug})
      RETURNING id::text
    `;
    const organizationId = organizationRows[0]?.id;
    if (!organizationId) throw new OrganizationWorkflowError("Organization could not be created.", 500, "create_failed");

    await tx`
      INSERT INTO organization_identity (
        organization_id, organization_type, website, primary_domain, claim_state, created_source, created_by_user_id
      ) VALUES (
        ${organizationId}::uuid, ${type}, ${website ?? null}, ${domain || null}, 'claimed', 'onboarding', ${actor.id}::uuid
      )
    `;
    await tx`
      INSERT INTO organization_profiles (organization_id, description, website, primary_domain, capability_seed, profile_status)
      VALUES (${organizationId}::uuid, '', ${website ?? null}, ${domain || null}, '', 'in_progress')
      ON CONFLICT (organization_id) DO NOTHING
    `;
    await tx`
      INSERT INTO organization_memberships (organization_id, user_id, role, permissions, status, is_primary)
      VALUES (
        ${organizationId}::uuid,
        ${actor.id}::uuid,
        'primary_admin',
        ${tx.json(["organization.manage", "organization.members.manage", "organization.profile.edit"])},
        'active',
        true
      )
    `;

    const candidate: OrganizationCandidate = {
      id: organizationId,
      name,
      aliases: [],
      type,
      website,
      domain: domain || undefined,
      claimState: "claimed",
    };
    const resolution = connectedResolution(candidate, "create", "self-attested", "primary_admin");
    await writeState(tx, actor.id, resolution, input.context);
    await tx`
      INSERT INTO activity_events (event_name, actor_user_id, organization_id, payload)
      VALUES ('OrganizationCreated', ${actor.id}::uuid, ${organizationId}::uuid, ${tx.json({ type, domain: domain || null })})
    `;
    return resolution;
  });
}

async function authorizedAccessReview(sql: Sql, actorId: string, requestId: string) {
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

export async function getAccessReview(session: OnboardingSession, requestId: string): Promise<OrganizationAccessReview> {
  const sql = getDatabase();
  const actor = await ensureActor(sql, session);
  const row = await authorizedAccessReview(sql, actor.id, requestId);
  if (!row) throw new OrganizationWorkflowError("This access request is unavailable or you are not authorized to review it.", 404, "access_review_unavailable");
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

export async function reviewAccessRequest(
  session: OnboardingSession,
  input: { requestId: string; decision: "approve" | "deny" },
) {
  const sql = getDatabase();
  const actor = await ensureActor(sql, session);
  const review = await authorizedAccessReview(sql, actor.id, input.requestId);
  if (!review) throw new OrganizationWorkflowError("This access request is unavailable or you are not authorized to review it.", 404, "access_review_unavailable");

  return sql.begin(async (tx) => {
    const status = input.decision === "approve" ? "approved" : "denied";
    const updated = await tx<{ requester_user_id: string; organization_id: string; requested_role: string }[]>`
      UPDATE organization_join_requests
      SET status = ${status}, resolved_at = now(), resolved_by_user_id = ${actor.id}::uuid
      WHERE id = ${input.requestId}::uuid AND status = 'pending'
      RETURNING requester_user_id::text, organization_id::text, requested_role
    `;
    const request = updated[0];
    if (!request) throw new OrganizationWorkflowError("This access request has already been resolved.", 409, "access_already_resolved");

    if (input.decision === "approve") {
      const primaryRows = await tx<{ exists: boolean }[]>`
        SELECT EXISTS(
          SELECT 1 FROM organization_memberships
          WHERE user_id = ${request.requester_user_id}::uuid AND is_primary = true AND status = 'active'
        ) AS exists
      `;
      const isPrimary = !primaryRows[0]?.exists;
      await tx`
        INSERT INTO organization_memberships (organization_id, user_id, role, permissions, status, is_primary)
        VALUES (
          ${request.organization_id}::uuid,
          ${request.requester_user_id}::uuid,
          ${request.requested_role},
          ${tx.json([])},
          'active',
          ${isPrimary}
        )
        ON CONFLICT (organization_id, user_id) DO UPDATE SET
          role = EXCLUDED.role,
          status = 'active',
          is_primary = CASE WHEN organization_memberships.is_primary THEN true ELSE EXCLUDED.is_primary END,
          updated_at = now()
      `;
      await tx`
        UPDATE organization_onboarding_state
        SET membership_state = 'active', authority_state = 'invited', current_step = 'status.connected', updated_at = now()
        WHERE user_id = ${request.requester_user_id}::uuid AND request_id = ${input.requestId}::uuid
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
    return { status, requestId: input.requestId };
  });
}
