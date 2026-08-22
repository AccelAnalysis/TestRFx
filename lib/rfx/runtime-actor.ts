import "server-only";

import { neon } from "@neondatabase/serverless";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, IdentitySessionUnauthorizedError, resolveIdentitySession } from "@/lib/identity/session-gateway";
import type { RfxWorkflowEntry, RfxWorkflowPerspective } from "./contracts";

export interface RfxActorContext {
  userId: string;
  organizationId: string;
  role: string;
  permissions: string[];
}

function database() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) throw new Error("RFx persistence requires DATABASE_URL.");
  return neon(url);
}

function normalizePermissions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export async function resolveRfxActor(request: NextRequest): Promise<RfxActorContext> {
  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value?.trim();
  if (!sessionToken) throw new IdentitySessionUnauthorizedError("Sign in is required to use shared RFx workflows.");

  const identity = await resolveIdentitySession(sessionToken);
  if (!identity.activeOrganizationId) throw new IdentitySessionUnauthorizedError("Select an active organization before using RFx workflows.");
  if (identity.readiness.restricted || !identity.readiness.exchangeReady) {
    throw new IdentitySessionUnauthorizedError("Your account is not currently authorized for the authenticated Exchange.");
  }

  const sql = database();
  const rows = await sql.query(
    `SELECT role, permissions
       FROM organization_memberships
      WHERE organization_id::text = $1
        AND user_id::text = $2
      LIMIT 1`,
    [identity.activeOrganizationId, identity.userId],
  ) as Array<{ role: string; permissions: unknown }>;

  if (!rows.length) throw new IdentitySessionUnauthorizedError("The active organization membership could not be verified.");

  return {
    userId: identity.userId,
    organizationId: identity.activeOrganizationId,
    role: rows[0].role,
    permissions: normalizePermissions(rows[0].permissions),
  };
}

export function actorCanWriteRfx(actor: RfxActorContext) {
  return actor.role === "owner" || actor.role === "admin" || actor.permissions.some((permission) => ["rfx:write", "rfx:manage", "exchange:write"].includes(permission));
}

export function actorCanSubmitRfx(actor: RfxActorContext) {
  return actor.role === "owner" || actor.role === "admin" || actor.permissions.some((permission) => ["rfx:submit", "rfx:respond", "exchange:write"].includes(permission));
}

export async function authorizeRfxWorkspaceRecord(
  actor: RfxActorContext,
  recordId: string,
  perspective: RfxWorkflowPerspective,
  entry: RfxWorkflowEntry,
) {
  const sql = database();
  const rows = await sql.query(
    `SELECT er.organization_id::text AS organization_id, er.status, rr.lifecycle_status, rr.source, rr.external_submission_required
       FROM exchange_records er
       JOIN rfx_records rr ON rr.exchange_record_id = er.id
      WHERE er.public_id = $1
        AND er.record_type = 'rfx'
      LIMIT 1`,
    [recordId],
  ) as Array<{ organization_id: string; status: string; lifecycle_status?: string; source?: string; external_submission_required?: boolean }>;

  if (!rows.length) {
    if (perspective === "issuer" && entry === "create-rfx" && recordId.startsWith("rfx-local-")) return { draftOnly: true as const };
    throw new Error("RFx record was not found.");
  }

  const record = rows[0];
  if (perspective === "issuer") {
    if (record.organization_id !== actor.organizationId) throw new IdentitySessionUnauthorizedError("Your active organization does not own this RFx.");
    if (!actorCanWriteRfx(actor)) throw new IdentitySessionUnauthorizedError("Your organization role cannot modify this RFx.");
  } else {
    if (record.organization_id === actor.organizationId) throw new IdentitySessionUnauthorizedError("Use the issuer workflow for your organization's own RFx.");
    if (!actorCanSubmitRfx(actor)) throw new IdentitySessionUnauthorizedError("Your organization role cannot prepare or submit RFx responses.");
  }

  return { draftOnly: false as const, record };
}
