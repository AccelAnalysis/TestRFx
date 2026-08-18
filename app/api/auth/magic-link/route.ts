import { createHash, randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import type { PoolClient } from "pg";
import { EXCHANGE_SESSION_COOKIE } from "@/lib/server/exchange-actor";
import { DatabaseUnavailableError, withTransaction } from "@/lib/server/database";

const defaultSessionTtlSeconds = 12 * 60 * 60;

type ChallengeRow = {
  id: string;
  user_id: string;
  return_to: string;
};

function hashToken(token: string) {
  return createHash("sha256").update(token).digest();
}

function sessionTtlSeconds() {
  const configured = Number(process.env.RFXCHANGE_SESSION_TTL_SECONDS ?? defaultSessionTtlSeconds);
  if (!Number.isFinite(configured)) return defaultSessionTtlSeconds;
  return Math.min(Math.max(Math.round(configured), 15 * 60), 30 * 24 * 60 * 60);
}

async function consumeChallenge(client: PoolClient, rawToken: string) {
  const result = await client.query<ChallengeRow>(`
    SELECT lc.id::text, lc.user_id::text, lc.return_to
    FROM login_challenges lc
    JOIN users u ON u.id = lc.user_id
    WHERE lc.token_hash = $1
      AND lc.consumed_at IS NULL
      AND lc.revoked_at IS NULL
      AND lc.expires_at > now()
      AND u.account_status = 'active'
      AND u.email_verified_at IS NOT NULL
    FOR UPDATE OF lc
    LIMIT 1
  `, [hashToken(rawToken)]);
  return result.rows[0];
}

function failedRedirect(request: NextRequest, reason: string) {
  const url = new URL("/login", request.url);
  url.searchParams.set("error", reason);
  return NextResponse.redirect(url);
}

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const rawToken = request.nextUrl.searchParams.get("token")?.trim();
  if (!rawToken) return failedRedirect(request, "invalid-or-expired-link");

  try {
    const ttl = sessionTtlSeconds();
    const outcome = await withTransaction(async (client) => {
      const challenge = await consumeChallenge(client, rawToken);
      if (!challenge) return undefined;

      const memberships = await client.query<{ organization_id: string }>(`
        SELECT organization_id::text
        FROM organization_memberships
        WHERE user_id = $1
        ORDER BY organization_id
      `, [challenge.user_id]);
      const activeOrganizationId = memberships.rows.length === 1 ? memberships.rows[0].organization_id : null;
      const sessionToken = randomBytes(32).toString("base64url");
      await client.query(`
        INSERT INTO app_sessions (user_id, active_organization_id, token_hash, expires_at, last_seen_at)
        VALUES ($1, $2, $3, now() + ($4::text || ' seconds')::interval, now())
      `, [challenge.user_id, activeOrganizationId, hashToken(sessionToken), ttl]);
      await client.query("UPDATE login_challenges SET consumed_at = now() WHERE id = $1", [challenge.id]);
      await client.query(`
        INSERT INTO activity_events (event_name, actor_user_id, organization_id, payload)
        VALUES ('SessionStarted', $1, $2, $3::jsonb)
      `, [challenge.user_id, activeOrganizationId, JSON.stringify({ method: "magic-link" })]);
      return { sessionToken, returnTo: challenge.return_to, activeOrganizationId, membershipCount: memberships.rows.length };
    });

    if (!outcome) return failedRedirect(request, "invalid-or-expired-link");
    const destination = outcome.activeOrganizationId
      ? outcome.returnTo
      : `/onboarding/organization?returnTo=${encodeURIComponent(outcome.returnTo)}`;
    const response = NextResponse.redirect(new URL(destination, request.url));
    response.cookies.set(EXCHANGE_SESSION_COOKIE, outcome.sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: ttl,
    });
    return response;
  } catch (error) {
    if (error instanceof DatabaseUnavailableError) return failedRedirect(request, "identity-service-unavailable");
    return failedRedirect(request, "sign-in-failed");
  }
}
