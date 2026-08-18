import { createHash, randomBytes } from "node:crypto";
import { getDatabase } from "@/lib/server/database";
import {
  assertOrganizationProfilePermission,
  assertTeamManagePermission,
  OnboardingForbiddenError,
  type OnboardingActor,
} from "./actor";
import {
  organizationProfileHandoffHref,
  type OrganizationInvitation,
  type OrganizationProfileAccepted,
  type OrganizationProfileSnapshot,
  type OrganizationProfileSubmission,
  type OrganizationTeamMember,
  type OrganizationVerification,
} from "@/lib/onboarding/organization-profile";

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function firstString(value: unknown) {
  const values = stringArray(value);
  return values[0] ?? "";
}

function iso(value: Date | string | null | undefined) {
  if (!value) return undefined;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export async function getOrganizationProfileSnapshot(actor: OnboardingActor): Promise<OrganizationProfileSnapshot> {
  const sql = getDatabase();
  const profileRows = await sql<{
    organization_id: string;
    organization_name: string;
    profile_status: "in_progress" | "complete" | "enriched" | null;
    legal_name: string | null;
    description: string | null;
    website: string | null;
    primary_domain: string | null;
    industries: unknown;
    industry_codes: unknown;
    organization_roles: string[] | null;
    onboarding_goals: string[] | null;
    brand_name: string | null;
    logo_url: string | null;
    visibility: unknown;
    contact_name: string | null;
    contact_title: string | null;
    contact_email: string | null;
    contact_phone: string | null;
  }[]>`
    SELECT
      o.id::text AS organization_id,
      o.name AS organization_name,
      op.profile_status,
      op.legal_name,
      op.description,
      op.website,
      op.primary_domain,
      op.industries,
      op.industry_codes,
      op.organization_roles,
      op.onboarding_goals,
      op.brand_name,
      op.logo_url,
      op.visibility,
      oc.contact_name,
      oc.title AS contact_title,
      oc.email AS contact_email,
      oc.phone AS contact_phone
    FROM organizations o
    LEFT JOIN organization_profiles op ON op.organization_id = o.id
    LEFT JOIN organization_contacts oc ON oc.organization_id = o.id AND oc.is_primary = true
    WHERE o.id = ${actor.organizationId}::uuid
    LIMIT 1
  `;

  const row = profileRows[0];
  if (!row) throw new OnboardingForbiddenError("The active organization no longer exists.");
  const visibility = objectValue(row.visibility);

  const primaryLocations = await sql<{
    geography_name: string | null;
    locality: string | null;
    region: string | null;
    visibility: string | null;
    map_ready: boolean;
  }[]>`
    SELECT
      g.name AS geography_name,
      COALESCE(l.normalized_address->>'city', l.address->>'city') AS locality,
      COALESCE(l.normalized_address->>'region', l.address->>'region') AS region,
      l.visibility::text AS visibility,
      (l.point IS NOT NULL) AS map_ready
    FROM locations l
    LEFT JOIN geographies g ON g.id = l.geography_id
    WHERE l.organization_id = ${actor.organizationId}::uuid
      AND l.is_primary = true
    LIMIT 1
  `;

  const serviceGeographies = await sql<{ name: string }[]>`
    SELECT g.name
    FROM organization_geographies og
    JOIN geographies g ON g.id = og.geography_id
    WHERE og.organization_id = ${actor.organizationId}::uuid
      AND og.relationship_type = 'service'
    ORDER BY g.name
  `;

  const location = primaryLocations[0];
  const geography = location
    ? {
        label: location.geography_name || [location.locality, location.region].filter(Boolean).join(", ") || "Primary location",
        ...(location.locality ? { locality: location.locality } : {}),
        ...(location.region ? { region: location.region } : {}),
        ...(location.visibility ? { visibility: location.visibility } : {}),
        mapReady: Boolean(location.map_ready),
        serviceGeographies: serviceGeographies.map((item) => item.name),
      }
    : null;

  const memberRows = await sql<{
    user_id: string;
    display_name: string;
    email: string;
    role: string;
    permissions: unknown;
  }[]>`
    SELECT u.id::text AS user_id, u.display_name, u.email, om.role, om.permissions
    FROM organization_memberships om
    JOIN users u ON u.id = om.user_id
    WHERE om.organization_id = ${actor.organizationId}::uuid
    ORDER BY CASE WHEN om.role = 'owner' THEN 0 WHEN om.role = 'admin' THEN 1 ELSE 2 END, u.display_name
  `;

  const team: OrganizationTeamMember[] = memberRows.map((member) => ({
    userId: member.user_id,
    displayName: member.display_name,
    email: member.email,
    role: member.role,
    permissions: stringArray(member.permissions),
    isViewer: member.user_id === actor.userId,
  }));

  const invitationRows = await sql<{
    id: string;
    email: string;
    role: string;
    permissions: unknown;
    status: string;
    expires_at: Date | string;
    created_at: Date | string;
  }[]>`
    SELECT id::text, email, role, permissions, status, expires_at, created_at
    FROM organization_invitations
    WHERE organization_id = ${actor.organizationId}::uuid
      AND status IN ('pending', 'accepted', 'revoked', 'expired')
    ORDER BY created_at DESC
    LIMIT 100
  `;

  const invitations: OrganizationInvitation[] = invitationRows.map((invitation) => ({
    id: invitation.id,
    email: invitation.email,
    role: invitation.role,
    permissions: stringArray(invitation.permissions),
    status: invitation.status,
    expiresAt: iso(invitation.expires_at) ?? "",
    createdAt: iso(invitation.created_at) ?? "",
  }));

  const verificationRows = await sql<{
    id: string;
    field_key: string;
    field_label: string;
    value: string;
    status: string;
    source: string | null;
    verified_at: Date | string | null;
    expires_at: Date | string | null;
  }[]>`
    SELECT id::text, field_key, field_label, value, status, source, verified_at, expires_at
    FROM organization_verifications
    WHERE organization_id = ${actor.organizationId}::uuid
    ORDER BY field_label, created_at DESC
  `;

  const verifications: OrganizationVerification[] = verificationRows.map((verification) => ({
    id: verification.id,
    fieldKey: verification.field_key,
    fieldLabel: verification.field_label,
    value: verification.value,
    status: verification.status,
    ...(verification.source ? { source: verification.source } : {}),
    ...(iso(verification.verified_at) ? { verifiedAt: iso(verification.verified_at) } : {}),
    ...(iso(verification.expires_at) ? { expiresAt: iso(verification.expires_at) } : {}),
  }));

  return {
    organizationId: row.organization_id,
    organizationName: row.organization_name,
    profileStatus: row.profile_status ?? "in_progress",
    profile: {
      displayName: row.organization_name,
      legalName: row.legal_name ?? "",
      description: row.description ?? "",
      website: row.website ?? "",
      primaryDomain: row.primary_domain ?? "",
      industry: firstString(row.industries),
      naics: firstString(row.industry_codes),
      roles: (row.organization_roles ?? []) as OrganizationProfileSubmission["roles"],
      contactName: row.contact_name ?? "",
      contactTitle: row.contact_title ?? "",
      contactEmail: row.contact_email ?? "",
      contactPhone: row.contact_phone ?? "",
      brandName: row.brand_name ?? "",
      logoUrl: row.logo_url ?? "",
      searchable: visibility.searchable !== false,
      mapVisible: visibility.mapVisible !== false,
      publicContact: visibility.publicContact === true,
      goals: (row.onboarding_goals ?? []) as OrganizationProfileSubmission["goals"],
    },
    geography,
    team,
    invitations,
    verifications,
    service: "postgres",
  };
}

export async function saveOrganizationProfile(
  actor: OnboardingActor,
  submission: OrganizationProfileSubmission,
  complete: boolean,
): Promise<OrganizationProfileAccepted> {
  assertOrganizationProfilePermission(actor);
  if (submission.context.organizationId !== actor.organizationId) throw new OnboardingForbiddenError();

  const sql = getDatabase();
  const status = complete ? "complete" : "in_progress";
  const visibility = JSON.stringify({
    searchable: submission.searchable,
    mapVisible: submission.mapVisible,
    publicContact: submission.publicContact,
  });
  const industries = JSON.stringify(submission.industry ? [submission.industry] : []);
  const industryCodes = JSON.stringify(submission.naics ? [submission.naics] : []);
  const eventPayload = JSON.stringify({ profileStatus: status });

  await sql.begin(async (tx) => {
    await tx`
      UPDATE organizations
      SET name = ${submission.displayName}, updated_at = now()
      WHERE id = ${actor.organizationId}::uuid
    `;

    await tx`
      INSERT INTO organization_profiles (
        organization_id, legal_name, description, website, primary_domain,
        industries, industry_codes, organization_roles, onboarding_goals,
        brand_name, logo_url, profile_status, visibility, completed_at, updated_at
      ) VALUES (
        ${actor.organizationId}::uuid,
        ${submission.legalName || null},
        ${submission.description},
        ${submission.website || null},
        ${submission.primaryDomain || null},
        ${industries}::jsonb,
        ${industryCodes}::jsonb,
        ${submission.roles},
        ${submission.goals},
        ${submission.brandName || null},
        ${submission.logoUrl || null},
        ${status},
        ${visibility}::jsonb,
        ${complete ? new Date() : null},
        now()
      )
      ON CONFLICT (organization_id) DO UPDATE SET
        legal_name = EXCLUDED.legal_name,
        description = EXCLUDED.description,
        website = EXCLUDED.website,
        primary_domain = EXCLUDED.primary_domain,
        industries = EXCLUDED.industries,
        industry_codes = EXCLUDED.industry_codes,
        organization_roles = EXCLUDED.organization_roles,
        onboarding_goals = EXCLUDED.onboarding_goals,
        brand_name = EXCLUDED.brand_name,
        logo_url = EXCLUDED.logo_url,
        profile_status = EXCLUDED.profile_status,
        visibility = EXCLUDED.visibility,
        completed_at = CASE WHEN EXCLUDED.profile_status = 'complete' THEN COALESCE(organization_profiles.completed_at, EXCLUDED.completed_at) ELSE organization_profiles.completed_at END,
        updated_at = now()
    `;

    if (submission.contactName && submission.contactEmail) {
      await tx`
        INSERT INTO organization_contacts (
          organization_id, contact_name, title, email, phone, is_primary, public_visibility, updated_at
        ) VALUES (
          ${actor.organizationId}::uuid,
          ${submission.contactName},
          ${submission.contactTitle || null},
          ${submission.contactEmail},
          ${submission.contactPhone || null},
          true,
          ${submission.publicContact},
          now()
        )
        ON CONFLICT (organization_id) WHERE is_primary = true DO UPDATE SET
          contact_name = EXCLUDED.contact_name,
          title = EXCLUDED.title,
          email = EXCLUDED.email,
          phone = EXCLUDED.phone,
          public_visibility = EXCLUDED.public_visibility,
          updated_at = now()
      `;
    }

    await tx`
      INSERT INTO activity_events (event_name, actor_user_id, organization_id, payload)
      VALUES (
        ${complete ? "OrganizationProfileCompleted" : "OrganizationProfileSaved"},
        ${actor.userId}::uuid,
        ${actor.organizationId}::uuid,
        ${eventPayload}::jsonb
      )
    `;
  });

  return {
    status: complete ? "profile_complete" : "profile_saved",
    organizationId: actor.organizationId,
    organizationName: submission.displayName,
    nextStep: "capability_enrichment",
    handoffHref: organizationProfileHandoffHref(actor.organizationId, submission.context),
    completion: {
      identity: Boolean(submission.displayName && submission.description.length >= 40),
      contact: Boolean(submission.contactName && submission.contactEmail),
      role: submission.roles.length > 0,
      visibility: true,
      goals: submission.goals.length > 0,
    },
    context: submission.context,
    service: "postgres",
  };
}

export async function createOrganizationInvitation(
  actor: OnboardingActor,
  input: { email: string; role: string; permissions: string[] },
) {
  assertTeamManagePermission(actor);
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid invitation email address.");
  const role = input.role.trim().slice(0, 64) || "member";
  if (role.toLowerCase() === "owner") throw new OnboardingForbiddenError("Ownership must use the separate ownership-transfer workflow.");
  const permissions = [...new Set(input.permissions.map((permission) => permission.trim()).filter(Boolean))].slice(0, 50);
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest();
  const sql = getDatabase();

  const rows = await sql<{ id: string; expires_at: Date | string }[]>`
    INSERT INTO organization_invitations (
      organization_id, email, role, permissions, token_hash, status, expires_at, invited_by_user_id
    ) VALUES (
      ${actor.organizationId}::uuid,
      ${email},
      ${role},
      ${permissions},
      ${tokenHash},
      'pending',
      now() + interval '7 days',
      ${actor.userId}::uuid
    )
    RETURNING id::text, expires_at
  `;

  await sql`
    INSERT INTO activity_events (event_name, actor_user_id, organization_id, payload)
    VALUES ('OrganizationInvitationCreated', ${actor.userId}::uuid, ${actor.organizationId}::uuid, ${JSON.stringify({ email, role })}::jsonb)
  `;

  return {
    invitationId: rows[0].id,
    inviteHref: `/join?invite=${encodeURIComponent(token)}`,
    expiresAt: iso(rows[0].expires_at),
  };
}

export async function revokeOrganizationInvitation(actor: OnboardingActor, invitationId: string) {
  assertTeamManagePermission(actor);
  const sql = getDatabase();
  const rows = await sql<{ id: string }[]>`
    UPDATE organization_invitations
    SET status = 'revoked', revoked_at = now(), updated_at = now()
    WHERE id = ${invitationId}::uuid
      AND organization_id = ${actor.organizationId}::uuid
      AND status = 'pending'
    RETURNING id::text
  `;
  if (!rows[0]) throw new Error("The invitation could not be revoked.");
  return { invitationId: rows[0].id, status: "revoked" as const };
}

async function ensureOwnerContinuity(organizationId: string, targetUserId: string) {
  const sql = getDatabase();
  const rows = await sql<{ role: string; owner_count: number }[]>`
    SELECT om.role, (SELECT count(*)::int FROM organization_memberships WHERE organization_id = ${organizationId}::uuid AND role = 'owner') AS owner_count
    FROM organization_memberships om
    WHERE om.organization_id = ${organizationId}::uuid AND om.user_id = ${targetUserId}::uuid
    LIMIT 1
  `;
  const target = rows[0];
  if (!target) throw new Error("Team member not found.");
  if (target.role === "owner" && target.owner_count <= 1) {
    throw new OnboardingForbiddenError("The sole organization owner cannot be removed or demoted. Transfer ownership first.");
  }
}

export async function updateOrganizationMember(
  actor: OnboardingActor,
  input: { userId: string; role: string; permissions: string[] },
) {
  assertTeamManagePermission(actor);
  await ensureOwnerContinuity(actor.organizationId, input.userId);
  const role = input.role.trim().slice(0, 64);
  if (!role) throw new Error("A member role is required.");
  const permissions = [...new Set(input.permissions.map((permission) => permission.trim()).filter(Boolean))].slice(0, 50);
  const sql = getDatabase();
  const rows = await sql<{ user_id: string }[]>`
    UPDATE organization_memberships
    SET role = ${role}, permissions = ${JSON.stringify(permissions)}::jsonb
    WHERE organization_id = ${actor.organizationId}::uuid
      AND user_id = ${input.userId}::uuid
    RETURNING user_id::text
  `;
  if (!rows[0]) throw new Error("Team member not found.");
  await sql`
    INSERT INTO activity_events (event_name, actor_user_id, organization_id, payload)
    VALUES ('OrganizationMemberAccessUpdated', ${actor.userId}::uuid, ${actor.organizationId}::uuid, ${JSON.stringify({ userId: input.userId, role, permissions })}::jsonb)
  `;
  return { userId: rows[0].user_id, role, permissions };
}

export async function removeOrganizationMember(actor: OnboardingActor, userId: string) {
  assertTeamManagePermission(actor);
  if (userId === actor.userId) throw new OnboardingForbiddenError("Use the separate Leave Organization workflow to remove your own access.");
  await ensureOwnerContinuity(actor.organizationId, userId);
  const sql = getDatabase();
  const rows = await sql<{ user_id: string }[]>`
    DELETE FROM organization_memberships
    WHERE organization_id = ${actor.organizationId}::uuid
      AND user_id = ${userId}::uuid
    RETURNING user_id::text
  `;
  if (!rows[0]) throw new Error("Team member not found.");
  await sql`
    INSERT INTO activity_events (event_name, actor_user_id, organization_id, payload)
    VALUES ('OrganizationMemberAccessRemoved', ${actor.userId}::uuid, ${actor.organizationId}::uuid, ${JSON.stringify({ userId })}::jsonb)
  `;
  return { userId: rows[0].user_id, status: "removed" as const };
}
