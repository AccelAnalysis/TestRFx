import type { NextRequest } from "next/server";
import { queryDatabase } from "./postgres";

export interface ServerActorContext {
  userId: string;
  organizationId: string;
  organizationName: string;
  role: string;
  permissions: string[];
}

export class ExchangeAuthenticationRequiredError extends Error {
  constructor(message = "An authenticated Exchange actor is required for this operation.") {
    super(message);
    this.name = "ExchangeAuthenticationRequiredError";
  }
}

type MembershipRow = {
  user_id: string;
  organization_id: string;
  organization_name: string;
  role: string;
  permissions: unknown;
};

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

/**
 * Resolves the authenticated actor supplied by the deployment identity layer.
 *
 * RFxchange does not trust browser-supplied identity headers by default. A reverse
 * proxy / auth gateway may inject the two IDs only when RFXCHANGE_TRUST_IDENTITY_HEADERS=1.
 * The IDs are then re-resolved through organization_memberships so role and permission
 * claims come from PostgreSQL rather than the request itself.
 */
export async function resolveServerActor(request: NextRequest): Promise<ServerActorContext> {
  if (process.env.RFXCHANGE_TRUST_IDENTITY_HEADERS !== "1") {
    throw new ExchangeAuthenticationRequiredError("Connect the production identity gateway before executing Exchange mutations.");
  }

  const userId = request.headers.get("x-rfxchange-user-id")?.trim();
  const organizationId = request.headers.get("x-rfxchange-organization-id")?.trim();
  if (!userId || !organizationId) throw new ExchangeAuthenticationRequiredError();

  const result = await queryDatabase<MembershipRow>(
    `SELECT om.user_id, om.organization_id, o.name AS organization_name, om.role, om.permissions
       FROM organization_memberships om
       JOIN organizations o ON o.id = om.organization_id
      WHERE om.user_id = $1::uuid AND om.organization_id = $2::uuid
      LIMIT 1`,
    [userId, organizationId],
  );
  const membership = result.rows[0];
  if (!membership) throw new ExchangeAuthenticationRequiredError("The authenticated user is not a member of the requested organization.");

  return {
    userId: membership.user_id,
    organizationId: membership.organization_id,
    organizationName: membership.organization_name,
    role: membership.role,
    permissions: stringArray(membership.permissions),
  };
}

export function assertPermission(actor: ServerActorContext, permission: string) {
  if (actor.role === "owner" || actor.permissions.includes("*") || actor.permissions.includes(permission)) return;
  throw new ExchangeAuthenticationRequiredError(`The active organization role does not grant ${permission}.`);
}
