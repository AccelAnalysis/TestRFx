import "server-only";
import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { getDatabase } from "./database";

export interface ExchangeActor {
  userId: string;
  organizationId: string;
  organizationName: string;
  role: string;
  permissions: string[];
}

export class AuthenticationRequiredError extends Error {
  constructor(message = "An authenticated RFxchange session is required.") {
    super(message);
    this.name = "AuthenticationRequiredError";
  }
}

function normalizePermissions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export async function requireExchangeActor(request: NextRequest): Promise<ExchangeActor> {
  const token = request.cookies.get("rfx_session")?.value;
  if (!token) throw new AuthenticationRequiredError();

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const sql = getDatabase();
  const rows = await sql`
    SELECT
      s.user_id::text AS user_id,
      s.active_organization_id::text AS organization_id,
      o.name AS organization_name,
      m.role,
      m.permissions
    FROM exchange_sessions s
    JOIN organizations o ON o.id = s.active_organization_id
    JOIN organization_memberships m
      ON m.organization_id = s.active_organization_id
     AND m.user_id = s.user_id
    JOIN users u ON u.id = s.user_id
    WHERE encode(s.token_hash, 'hex') = ${tokenHash}
      AND s.revoked_at IS NULL
      AND s.expires_at > now()
      AND COALESCE(u.account_status, 'active') <> 'restricted'
    LIMIT 1
  `;

  const row = rows[0] as Record<string, unknown> | undefined;
  if (!row) throw new AuthenticationRequiredError("The RFxchange session is invalid or expired.");

  return {
    userId: String(row.user_id),
    organizationId: String(row.organization_id),
    organizationName: String(row.organization_name),
    role: String(row.role),
    permissions: normalizePermissions(row.permissions),
  };
}

export function actorCanWriteIntelligence(actor: ExchangeActor) {
  return actor.role === "owner" || actor.role === "admin" || actor.permissions.includes("intelligence:write");
}
