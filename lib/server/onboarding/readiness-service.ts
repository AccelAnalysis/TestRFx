import { getDatabase, DatabaseServiceUnavailableError } from "@/lib/server/database";
import { readRfxSessionFromCookieHeader } from "@/lib/server/onboarding/actor";
import {
  buildExchangeReadiness,
  createExchangeActivation,
  resolveExchangeDestination,
  type AuthoritativeReadinessFacts,
  type ExchangeActivation,
  type ExchangeReadinessSnapshot,
} from "@/lib/onboarding/readiness";

export class OnboardingReadinessError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "OnboardingReadinessError";
    this.status = status;
  }
}

interface ActorRow {
  user_id: string;
  email_verified_at: Date | null;
  organization_id: string;
  organization_name: string;
}

interface GeographyRow {
  geography_name: string | null;
  marker_ready: boolean;
}

interface ProfileRow {
  profile_status: string | null;
  visibility: unknown;
}

interface CapabilityRow {
  claim_count: number;
  accepted_amacs_count: number;
  capability_names: string[] | null;
  evidence_count: number;
  discoverability_term_count: number;
}

interface MembershipRow {
  status: string;
  public_name: string;
}

interface ActivationRow {
  destination: string;
  activated_at: Date;
}

function visibilitySummary(value: unknown) {
  if (!value || typeof value !== "object") return { selected: false, label: undefined as string | undefined };
  const visibility = value as Record<string, unknown>;
  const searchable = typeof visibility.searchable === "boolean" ? visibility.searchable : undefined;
  const mapVisible = typeof visibility.mapVisible === "boolean" ? visibility.mapVisible : undefined;
  if (searchable === undefined || mapVisible === undefined) return { selected: false, label: undefined as string | undefined };
  if (!searchable) return { selected: true, label: "Not searchable in Exchange" };
  return { selected: true, label: mapVisible ? "Searchable · map visible" : "Searchable · map hidden" };
}

async function loadFacts(cookieHeader: string | null): Promise<{ facts: AuthoritativeReadinessFacts; userId: string; organizationId: string }> {
  const session = readRfxSessionFromCookieHeader(cookieHeader);
  if (!session) throw new OnboardingReadinessError(401, "An authenticated RFxchange organization session is required.");

  const sql = getDatabase();
  const actorRows = await sql<ActorRow[]>`
    SELECT
      u.id::text AS user_id,
      u.email_verified_at,
      o.id::text AS organization_id,
      o.name AS organization_name
    FROM organization_memberships om
    JOIN users u ON u.id = om.user_id
    JOIN organizations o ON o.id = om.organization_id
    WHERE om.user_id = ${session.userId}::uuid
      AND om.organization_id = ${session.organizationId}::uuid
    LIMIT 1
  `;
  const actor = actorRows[0];
  if (!actor) throw new OnboardingReadinessError(401, "The authenticated member is no longer linked to the active organization.");

  const geographyRows = await sql<GeographyRow[]>`
    SELECT
      g.name AS geography_name,
      EXISTS (
        SELECT 1
        FROM locations l
        WHERE l.organization_id = ${actor.organization_id}::uuid
          AND l.is_primary = true
          AND l.point IS NOT NULL
      ) AS marker_ready
    FROM organization_geographies og
    JOIN geographies g ON g.id = og.geography_id
    WHERE og.organization_id = ${actor.organization_id}::uuid
      AND og.relationship_type = 'primary'
    LIMIT 1
  `;

  const profileRows = await sql<ProfileRow[]>`
    SELECT profile_status, visibility
    FROM organization_profiles
    WHERE organization_id = ${actor.organization_id}::uuid
    LIMIT 1
  `;

  const capabilityRows = await sql<CapabilityRow[]>`
    SELECT
      COUNT(c.id)::int AS claim_count,
      COUNT(c.id) FILTER (WHERE c.mapping_status = 'accepted')::int AS accepted_amacs_count,
      COALESCE(array_agg(c.name ORDER BY c.created_at) FILTER (WHERE c.id IS NOT NULL), '{}'::text[]) AS capability_names,
      (
        SELECT COUNT(e.id)::int
        FROM organization_capability_evidence e
        JOIN organization_capability_claims ec ON ec.id = e.capability_claim_id
        WHERE ec.organization_id = ${actor.organization_id}::uuid
          AND ec.claim_status <> 'archived'
      ) AS evidence_count,
      (
        SELECT COALESCE(cardinality(p.tags), 0) + COALESCE(cardinality(p.keywords), 0) + COALESCE(cardinality(p.specialties), 0)
        FROM organization_capability_profiles p
        WHERE p.organization_id = ${actor.organization_id}::uuid
      )::int AS discoverability_term_count
    FROM organization_capability_claims c
    WHERE c.organization_id = ${actor.organization_id}::uuid
      AND c.claim_status <> 'archived'
  `;

  const membershipRows = await sql<MembershipRow[]>`
    SELECT opm.status::text AS status, mp.public_name
    FROM organization_plan_memberships opm
    JOIN membership_plans mp ON mp.id = opm.membership_plan_id
    WHERE opm.organization_id = ${actor.organization_id}::uuid
    ORDER BY opm.updated_at DESC
    LIMIT 1
  `;

  const geography = geographyRows[0];
  const profile = profileRows[0];
  const capabilities = capabilityRows[0] ?? {
    claim_count: 0,
    accepted_amacs_count: 0,
    capability_names: [],
    evidence_count: 0,
    discoverability_term_count: 0,
  };
  const membership = membershipRows[0];
  const visibility = visibilitySummary(profile?.visibility);
  const entitlementResolved = membership?.status === "active";

  return {
    userId: actor.user_id,
    organizationId: actor.organization_id,
    facts: {
      accountVerified: Boolean(actor.email_verified_at),
      organizationEstablished: true,
      organizationAffiliation: true,
      organizationId: actor.organization_id,
      organizationName: actor.organization_name,
      geographyEstablished: Boolean(geography?.geography_name),
      geography: geography?.geography_name ?? undefined,
      organizationProfileComplete: profile?.profile_status === "complete" || profile?.profile_status === "enriched",
      visibilitySelected: visibility.selected,
      visibilityLabel: visibility.label,
      mapPresence: geography?.marker_ready ? "marker_ready" : "off_map",
      capabilityProfileComplete: capabilities.claim_count > 0,
      capabilitySummary: (capabilities.capability_names ?? []).slice(0, 6),
      acceptedAmacsCount: capabilities.accepted_amacs_count ?? 0,
      evidenceCount: capabilities.evidence_count ?? 0,
      discoverabilityTermCount: capabilities.discoverability_term_count ?? 0,
      entitlementResolved,
      entitlementSummary: membership
        ? entitlementResolved
          ? `${membership.public_name} active`
          : `${membership.public_name} · ${membership.status.replaceAll("_", " ")}`
        : undefined,
    },
  };
}

export async function loadAuthoritativeReadiness(cookieHeader: string | null): Promise<ExchangeReadinessSnapshot> {
  const { facts } = await loadFacts(cookieHeader);
  return buildExchangeReadiness(facts);
}

export async function activateAuthoritativeReadiness(
  cookieHeader: string | null,
  requestedDestination?: string | null,
): Promise<{ readiness: ExchangeReadinessSnapshot; activation: ExchangeActivation }> {
  const context = await loadFacts(cookieHeader);
  const readiness = buildExchangeReadiness(context.facts);
  if (!readiness.exchangeAccessAllowed) {
    throw new OnboardingReadinessError(409, "Exchange activation is blocked until all required readiness checks are complete.");
  }

  const activation = createExchangeActivation(readiness, requestedDestination);
  const sql = getDatabase();

  await sql.begin(async (tx) => {
    await tx`
      INSERT INTO onboarding_exchange_activations (
        organization_id,
        activated_by_user_id,
        status,
        destination,
        readiness_snapshot,
        activated_at,
        updated_at
      ) VALUES (
        ${context.organizationId}::uuid,
        ${context.userId}::uuid,
        'exchange_active',
        ${activation.destination},
        ${tx.json(JSON.parse(JSON.stringify(readiness)))},
        ${activation.activatedAt}::timestamptz,
        now()
      )
      ON CONFLICT (organization_id) DO UPDATE SET
        activated_by_user_id = EXCLUDED.activated_by_user_id,
        status = EXCLUDED.status,
        destination = EXCLUDED.destination,
        readiness_snapshot = EXCLUDED.readiness_snapshot,
        activated_at = EXCLUDED.activated_at,
        updated_at = now()
    `;

    await tx`
      INSERT INTO activity_events (event_name, actor_user_id, organization_id, payload)
      VALUES (
        'OnboardingCompleted',
        ${context.userId}::uuid,
        ${context.organizationId}::uuid,
        ${tx.json({ destination: activation.destination, readinessState: readiness.state, mapPresence: readiness.organization.mapPresence })}
      )
    `;
  });

  return { readiness, activation };
}

export async function loadAuthoritativeActivation(cookieHeader: string | null) {
  const session = readRfxSessionFromCookieHeader(cookieHeader);
  if (!session) throw new OnboardingReadinessError(401, "An authenticated RFxchange organization session is required.");
  const sql = getDatabase();
  const rows = await sql<ActivationRow[]>`
    SELECT destination, activated_at
    FROM onboarding_exchange_activations
    WHERE organization_id = ${session.organizationId}::uuid
      AND status = 'exchange_active'
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) return undefined;
  return {
    status: "exchange_active" as const,
    destination: resolveExchangeDestination(row.destination),
    activatedAt: row.activated_at.toISOString(),
  };
}

export function readinessHttpStatus(error: unknown) {
  if (error instanceof OnboardingReadinessError) return error.status;
  if (error instanceof DatabaseServiceUnavailableError) return 503;
  return 500;
}
