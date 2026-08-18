import type { PoolClient } from "pg";
import type { ResolvedExchangeActor } from "./exchange-actor";
import { ExchangeAuthenticationError } from "./exchange-actor";

export interface ExchangeMembershipAuthorization {
  role: string;
  permissions: string[];
}

export async function assertExchangeActorMembership(client: PoolClient, actor: ResolvedExchangeActor): Promise<ExchangeMembershipAuthorization> {
  const result = await client.query<{ role: string; permissions: unknown }>(
    "SELECT role, permissions FROM organization_memberships WHERE organization_id=$1 AND user_id=$2",
    [actor.organizationId, actor.userId],
  );
  const membership = result.rows[0];
  if (!membership) throw new ExchangeAuthenticationError("The authenticated user is not a member of the active RFxchange organization.");
  return {
    role: membership.role,
    permissions: Array.isArray(membership.permissions) ? membership.permissions.filter((value): value is string => typeof value === "string") : [],
  };
}
