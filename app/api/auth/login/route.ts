import { NextRequest, NextResponse } from "next/server";
import type { AuthEntrySearchParams } from "@/lib/acquisition/auth-entry";
import { parseAuthEntryContext, withAuthEntryContext } from "@/lib/acquisition/auth-entry";
import type { LoginApiError, MagicLinkChallengeAccepted } from "@/lib/identity/contracts";
import { getIdentityGateway, IdentityGatewayError } from "@/lib/identity/gateway";
import { isValidEmail, normalizeEmail } from "@/lib/identity/login";

interface LoginRequestBody {
  email?: unknown;
  context?: unknown;
  rememberDevice?: unknown;
}

function safeContext(value: unknown): AuthEntrySearchParams {
  if (!value || typeof value !== "object") return {};
  const result: AuthEntrySearchParams = {};
  for (const [key, candidate] of Object.entries(value as Record<string, unknown>)) {
    if (typeof candidate === "string") result[key] = candidate;
  }
  return result;
}

function clientIp(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || undefined;
}

function country(request: NextRequest) {
  return request.headers.get("x-country-code") || request.headers.get("cf-ipcountry") || request.headers.get("x-vercel-ip-country") || undefined;
}

function errorResponse(error: LoginApiError, status: number) {
  return NextResponse.json<LoginApiError>(error, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  let body: LoginRequestBody;
  try {
    body = (await request.json()) as LoginRequestBody;
  } catch {
    return errorResponse({ error: "Enter a valid email address and try again.", code: "invalid_request" }, 400);
  }

  if (typeof body.email !== "string") return errorResponse({ error: "Enter a valid email address and try again.", code: "invalid_request" }, 400);
  const email = normalizeEmail(body.email);
  if (!isValidEmail(email)) return errorResponse({ error: "Enter a valid email address and try again.", code: "invalid_request" }, 400);

  const context = parseAuthEntryContext(safeContext(body.context));
  const relativeCompleteUrl = withAuthEntryContext("/login/complete", context);
  const appOrigin = process.env.RFX_APP_URL ?? request.nextUrl.origin;
  const continueUrl = new URL(relativeCompleteUrl, appOrigin).toString();

  try {
    const result = await getIdentityGateway().requestMagicLink({
      email,
      continueUrl,
      rememberDevice: body.rememberDevice === true,
      userAgent: request.headers.get("user-agent") ?? undefined,
      ipAddress: clientIp(request),
      country: country(request),
    });
    return NextResponse.json<MagicLinkChallengeAccepted>(
      { status: "challenge_sent", challengeId: result.challengeId, expiresInSeconds: result.expiresInSeconds },
      { status: 202, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof IdentityGatewayError) {
      const status = error.code === "account_not_found" ? 404 : error.code === "account_restricted" ? 403 : error.code === "rate_limited" ? 429 : 503;
      return errorResponse({ error: error.message, code: error.code }, status);
    }
    return errorResponse({ error: "Secure sign-in is temporarily unavailable. Try again shortly.", code: "request_failed" }, 503);
  }
}
