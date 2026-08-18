import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { query } from "./database";

export const EXCHANGE_SESSION_COOKIE = "rfx_session";

export interface RuntimeSessionIdentity {
  userId: string;
  email: string;
  displayName: string;
  activeOrganizationId?: string;
}

export interface ExchangeActor {
  userId: string;
  email: string;
  displayName: string;
  organizationId: string;
  organizationName: string;
  role: string;
  permissions: string[];
}

type SessionRow = {
  user_id: string;
  email: string;
  display_name: string;
  active_organization_id: string | null;
};

type ActorRow = {
  user_id: string;
  email: string;
  display_name: string;
  organization_id: string;
  organization_name: string;
  role: string;
  permissions: unknown;
};

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest();
}

function normalizePermissions(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export async function resolveRuntimeSessionFromToken(token?: string | null): Promise<RuntimeSessionIdentity | undefined> {
  if (!token) return undefined;
  const result = await query<SessionRow>(`
    SELECT s.user_id::text, u.email, u.display_name, s.active_organization_id::text
    FROM app_sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = $1
      AND s.revoked_at IS NULL
      AND s.expires_at > now()
      AND u.account_status = 'active'
    LIMIT 1
  `, [tokenHash(token)]);
  const row = result.rows[0];
  if (!row) return undefined;
  return {
    userId: row.user_id,
    email: row.email,
    displayName: row.display_name,
    activeOrganizationId: row.active_organization_id ?? undefined,
  };
}

export async function resolveExchangeActorFromToken(token?: string | null): Promise<ExchangeActor | undefined> {
  if (!token) return undefined;
  const result = await query<ActorRow>(`
    SELECT
      s.user_id::text,
      u.email,
      u.display_name,
      s.active_organization_id::text AS organization_id,
      o.name AS organization_name,
      m.role,
      m.permissions
    FROM app_sessions s
    JOIN users u ON u.id = s.user_id
    JOIN organizations o ON o.id = s.active_organization_id
    JOIN organization_memberships m
      ON m.user_id = s.user_id
     AND m.organization_id = s.active_organization_id
    WHERE s.token_hash = $1
      AND s.revoked_at IS NULL
      AND s.expires_at > now()
      AND u.account_status = 'active'
    LIMIT 1
  `, [tokenHash(token)]);
  const row = result.rows[0];
  if (!row) return undefined;
  return {
    userId: row.user_id,
    email: row.email,
    displayName: row.display_name,
    organizationId: row.organization_id,
    organizationName: row.organization_name,
    role: row.role,
    permissions: normalizePermissions(row.permissions),
  };
}

export async function resolveRuntimeSession(request: NextRequest) {
  return resolveRuntimeSessionFromToken(request.cookies.get(EXCHANGE_SESSION_COOKIE)?.value);
}

export async function resolveExchangeActor(request: NextRequest) {
  return resolveExchangeActorFromToken(request.cookies.get(EXCHANGE_SESSION_COOKIE)?.value);
}

export function actorCan(actor: ExchangeActor, permission: string) {
  return actor.role === "owner" || actor.permissions.includes("*") || actor.permissions.includes(permission);
}
