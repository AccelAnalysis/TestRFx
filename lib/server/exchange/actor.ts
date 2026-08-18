import type { NextRequest } from "next/server";
import { getExchangeDatabase } from "./database";

export class ExchangeUnauthorizedError extends Error {
  constructor(message = "An authenticated RFxchange organization context is required.") {
    super(message);
    this.name = "ExchangeUnauthorizedError";
  }
}

export class ExchangeForbiddenError extends Error {
  constructor(message = "The active organization role is not authorized for this Resource action.") {
    super(message);
    this.name = "ExchangeForbiddenError";
  }
}

export interface ExchangeServerActor {
  userId: string;
  userEmail: string;
  organizationId: string;
  organizationName: string;
  role: string;
  permissions: string[];
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function configuredActorId(request: NextRequest, cookieName: string, envName: "RFX_ACTIVE_USER_ID" | "RFX_ACTIVE_ORGANIZATION_ID") {
  const value = request.cookies.get(cookieName)?.value ?? process.env[envName];
  return value && uuidPattern.test(value) ? value : undefined;
}

export async function resolveExchangeActor(request: NextRequest): Promise<ExchangeServerActor> {
  const userId = configuredActorId(request, "rfx_user_id", "RFX_ACTIVE_USER_ID");
  const organizationId = configuredActorId(request, "rfx_organization_id", "RFX_ACTIVE_ORGANIZATION_ID");
  if (!userId || !organizationId) throw new ExchangeUnauthorizedError();

  const sql = getExchangeDatabase();
  const rows = await sql<{
    user_id: string;
    email: string;
    organization_id: string;
    organization_name: string;
    role: string;
    permissions: unknown;
  }[]>`
    SELECT
      u.id::text AS user_id,
      u.email,
      o.id::text AS organization_id,
      o.name AS organization_name,
      om.role,
      om.permissions
    FROM organization_memberships om
    JOIN users u ON u.id = om.user_id
    JOIN organizations o ON o.id = om.organization_id
    WHERE om.user_id = ${userId}::uuid
      AND om.organization_id = ${organizationId}::uuid
    LIMIT 1
  `;

  const row = rows[0];
  if (!row) throw new ExchangeUnauthorizedError("The selected organization is not linked to the authenticated member.");

  const permissions = Array.isArray(row.permissions)
    ? row.permissions.filter((value): value is string => typeof value === "string")
    : [];

  return {
    userId: row.user_id,
    userEmail: row.email,
    organizationId: row.organization_id,
    organizationName: row.organization_name,
    role: row.role,
    permissions,
  };
}

export function assertResourceManagePermission(actor: ExchangeServerActor) {
  if (actor.role === "owner" || actor.role === "admin" || actor.permissions.includes("resources:write")) return;
  throw new ExchangeForbiddenError();
}

export function assertResourceRelationshipPermission(actor: ExchangeServerActor) {
  if (actor.role === "owner" || actor.role === "admin" || actor.permissions.includes("relationships:write") || actor.permissions.includes("resources:request")) return;
  throw new ExchangeForbiddenError("The active organization role cannot create Resource requests or relationships.");
}

export function assertReferralPermission(actor: ExchangeServerActor) {
  if (actor.role === "owner" || actor.role === "admin" || actor.permissions.includes("referrals:create")) return;
  throw new ExchangeForbiddenError("The active organization role cannot create referrals.");
}
