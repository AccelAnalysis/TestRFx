import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import type { SearchPrincipal } from "./search-repository";
import { getPostgresPool } from "@/lib/server/postgres";

export class SearchAuthenticationRequiredError extends Error {
  code = "authentication_required" as const;
  constructor(message = "Sign in with an authenticated RFxchange session to use this search workflow.") {
    super(message);
    this.name = "SearchAuthenticationRequiredError";
  }
}

export class SearchAuthorizationError extends Error {
  code = "search_authorization_failed" as const;
  constructor(message = "The active organization is not available to this user.") {
    super(message);
    this.name = "SearchAuthorizationError";
  }
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function safeSecretMatch(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

/**
 * Universal Search deliberately does not invent a participant session.
 * Production identity/auth middleware may bridge verified IDs into server-side
 * requests using these headers plus a shared secret that is never exposed to
 * browsers. Requests without that trusted bridge are anonymous.
 */
export async function resolveSearchPrincipal(request: NextRequest): Promise<SearchPrincipal> {
  const configuredSecret = process.env.RFXCHANGE_IDENTITY_BRIDGE_SECRET?.trim();
  const suppliedSecret = request.headers.get("x-rfx-identity-bridge-secret")?.trim();
  if (!configuredSecret || !suppliedSecret || !safeSecretMatch(configuredSecret, suppliedSecret)) return {};

  const userId = request.headers.get("x-rfx-user-id")?.trim();
  const organizationId = request.headers.get("x-rfx-organization-id")?.trim();
  if (!userId || !uuidPattern.test(userId)) return {};
  if (organizationId && !uuidPattern.test(organizationId)) throw new SearchAuthorizationError();

  if (organizationId) {
    const pool = getPostgresPool();
    const membership = await pool.query(
      `SELECT 1 FROM organization_memberships WHERE user_id = $1::uuid AND organization_id = $2::uuid LIMIT 1`,
      [userId, organizationId],
    );
    if (!membership.rowCount) throw new SearchAuthorizationError();
  }

  return { userId, organizationId: organizationId || undefined };
}

export function requireSearchUser(principal: SearchPrincipal) {
  if (!principal.userId) throw new SearchAuthenticationRequiredError();
  return principal.userId;
}
