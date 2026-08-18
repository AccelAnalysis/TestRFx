import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { getDatabase, DatabaseServiceUnavailableError } from "@/lib/server/database";

export class OnboardingUnauthorizedError extends Error {
  constructor(message = "An authenticated RFxchange organization session is required.") {
    super(message);
    this.name = "OnboardingUnauthorizedError";
  }
}

export class OnboardingForbiddenError extends Error {
  constructor(message = "The active organization role is not authorized for this action.") {
    super(message);
    this.name = "OnboardingForbiddenError";
  }
}

export interface OnboardingActor {
  userId: string;
  userEmail: string;
  organizationId: string;
  organizationName: string;
  role: string;
  permissions: string[];
}

type SessionPayload = {
  userId: string;
  organizationId: string;
  expiresAt: number;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function sessionSecret() {
  const secret = process.env.RFXCHANGE_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new DatabaseServiceUnavailableError("RFXCHANGE_SESSION_SECRET must be configured with at least 32 characters.");
  }
  return secret;
}

function sign(encodedPayload: string) {
  return createHmac("sha256", sessionSecret()).update(encodedPayload).digest("base64url");
}

function parseSession(value: string | undefined): SessionPayload | undefined {
  if (!value) return undefined;
  const [encodedPayload, signature] = value.split(".");
  if (!encodedPayload || !signature) return undefined;

  const expected = sign(encodedPayload);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) return undefined;

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as Partial<SessionPayload>;
    if (!payload.userId || !payload.organizationId || !payload.expiresAt) return undefined;
    if (!uuidPattern.test(payload.userId) || !uuidPattern.test(payload.organizationId)) return undefined;
    if (payload.expiresAt <= Date.now()) return undefined;
    return payload as SessionPayload;
  } catch {
    return undefined;
  }
}

export function createRfxSessionCookieValue(payload: SessionPayload) {
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encodedPayload}.${sign(encodedPayload)}`;
}

export async function resolveOnboardingActor(request: NextRequest, requestedOrganizationId?: string): Promise<OnboardingActor> {
  const session = parseSession(request.cookies.get("rfx_session")?.value);
  if (!session) throw new OnboardingUnauthorizedError();
  if (requestedOrganizationId && requestedOrganizationId !== session.organizationId) {
    throw new OnboardingForbiddenError("The requested organization does not match the active organization session.");
  }

  const sql = getDatabase();
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
    WHERE om.user_id = ${session.userId}::uuid
      AND om.organization_id = ${session.organizationId}::uuid
    LIMIT 1
  `;

  const row = rows[0];
  if (!row) throw new OnboardingUnauthorizedError("The authenticated member is no longer linked to the active organization.");

  const permissions = Array.isArray(row.permissions)
    ? row.permissions.filter((permission): permission is string => typeof permission === "string")
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

export function assertOrganizationProfilePermission(actor: OnboardingActor) {
  if (actor.role === "owner" || actor.role === "admin" || actor.permissions.includes("organization:profile:write")) return;
  throw new OnboardingForbiddenError("The active organization role cannot edit the organization profile.");
}

export function assertTeamManagePermission(actor: OnboardingActor) {
  if (actor.role === "owner" || actor.role === "admin" || actor.permissions.includes("organization:team:write")) return;
  throw new OnboardingForbiddenError("The active organization role cannot manage team access.");
}
