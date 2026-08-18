import "server-only";

import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

const authorizationPrefix = "Bearer ";

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

/**
 * Server-to-server trust seam for shared RFx workspace persistence.
 *
 * The current Identity gateway does not establish an authenticated participant
 * session, so browser requests must not be treated as an authority signal.
 * A production Identity/BFF layer can exchange its verified session for this
 * internal service credential, or replace this seam with direct actor/session
 * resolution without changing the RFx workspace contracts.
 */
export function isTrustedRfxWorkspaceRequest(request: NextRequest) {
  const expected = process.env.RFX_WORKSPACE_SERVICE_TOKEN?.trim();
  if (!expected) return false;
  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith(authorizationPrefix)) return false;
  const provided = authorization.slice(authorizationPrefix.length).trim();
  return Boolean(provided) && safeEqual(provided, expected);
}

export function sharedRfxWorkspaceConfiguration() {
  return {
    databaseConfigured: Boolean(process.env.DATABASE_URL),
    serviceCredentialConfigured: Boolean(process.env.RFX_WORKSPACE_SERVICE_TOKEN),
  };
}
