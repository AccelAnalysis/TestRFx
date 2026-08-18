import { createHash, randomBytes } from "node:crypto";
import type { MagicLinkRequestInput, MagicLinkRequestResult } from "./contracts";
import { MAGIC_LINK_TTL_SECONDS } from "./login";
import { query } from "@/lib/server/database";

export interface IdentityGateway {
  requestMagicLink(input: MagicLinkRequestInput): Promise<MagicLinkRequestResult>;
}

export class IdentityProviderUnavailableError extends Error {
  constructor(message = "Production sign-in delivery is not configured.") {
    super(message);
    this.name = "IdentityProviderUnavailableError";
  }
}

type UserRow = { id: string };

function hashToken(token: string) {
  return createHash("sha256").update(token).digest();
}

function providerConfiguration() {
  const deliveryUrl = process.env.RFXCHANGE_IDENTITY_DELIVERY_URL;
  const appOrigin = process.env.RFXCHANGE_APP_ORIGIN;
  if (!deliveryUrl || !appOrigin) {
    throw new IdentityProviderUnavailableError(
      "Set RFXCHANGE_IDENTITY_DELIVERY_URL and RFXCHANGE_APP_ORIGIN to enable passwordless sign-in.",
    );
  }
  return { deliveryUrl, appOrigin, deliveryToken: process.env.RFXCHANGE_IDENTITY_DELIVERY_TOKEN };
}

class ProductionIdentityGateway implements IdentityGateway {
  async requestMagicLink(input: MagicLinkRequestInput): Promise<MagicLinkRequestResult> {
    const provider = providerConfiguration();
    const userResult = await query<UserRow>(`
      SELECT id::text
      FROM users
      WHERE lower(btrim(email)) = lower(btrim($1))
        AND account_status = 'active'
        AND email_verified_at IS NOT NULL
      LIMIT 1
    `, [input.email]);

    const user = userResult.rows[0];
    // Preserve the same outward response for unknown/inactive accounts to avoid
    // turning the login endpoint into an account-enumeration service.
    if (!user) return { delivery: "provider", expiresInSeconds: MAGIC_LINK_TTL_SECONDS };

    const rawToken = randomBytes(32).toString("base64url");
    const tokenHash = hashToken(rawToken);
    const challenge = await query<{ id: string }>(`
      INSERT INTO login_challenges (user_id, token_hash, return_to, requested_user_agent, expires_at)
      VALUES ($1, $2, $3, $4, now() + ($5::text || ' seconds')::interval)
      RETURNING id::text
    `, [user.id, tokenHash, input.returnTo, input.userAgent ?? null, MAGIC_LINK_TTL_SECONDS]);

    const loginUrl = new URL("/api/auth/magic-link", provider.appOrigin);
    loginUrl.searchParams.set("token", rawToken);
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (provider.deliveryToken) headers.Authorization = `Bearer ${provider.deliveryToken}`;

    try {
      const response = await fetch(provider.deliveryUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          type: "rfxchange.magic-link",
          to: input.email,
          loginUrl: loginUrl.toString(),
          expiresInSeconds: MAGIC_LINK_TTL_SECONDS,
        }),
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`Identity delivery returned ${response.status}.`);
    } catch (error) {
      await query("UPDATE login_challenges SET revoked_at = now() WHERE id = $1", [challenge.rows[0].id]).catch(() => undefined);
      throw new IdentityProviderUnavailableError(error instanceof Error ? error.message : "Magic-link delivery failed.");
    }

    return { delivery: "provider", expiresInSeconds: MAGIC_LINK_TTL_SECONDS };
  }
}

const productionGateway = new ProductionIdentityGateway();

export function getIdentityGateway(): IdentityGateway {
  return productionGateway;
}
