import { NextRequest, NextResponse } from "next/server";
import type {
  LoginApiError,
  LoginVerifyApiResponse,
  MagicLinkVerificationInput,
} from "@/lib/identity/contracts";
import {
  getIdentityGateway,
  IdentityProviderRequestError,
  IdentityProviderUnavailableError,
} from "@/lib/identity/gateway";
import { resolvePostLoginDestination } from "@/lib/identity/readiness";
import { SESSION_COOKIE_NAME } from "@/lib/identity/session-gateway";

function noStore<T>(body: T, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function clean(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return noStore<LoginApiError>(
      { error: "A valid sign-in verification request is required.", code: "invalid_request" },
      400,
    );
  }

  const token = clean(body.token, 4096);
  const challengeId = clean(body.challengeId, 240);
  const code = clean(body.code, 32);

  let input: MagicLinkVerificationInput;
  if (token) {
    input = { token, userAgent: request.headers.get("user-agent") ?? undefined };
  } else if (challengeId && code) {
    input = { challengeId, code, userAgent: request.headers.get("user-agent") ?? undefined };
  } else {
    return noStore<LoginApiError>(
      { error: "The sign-in link or verification code is incomplete.", code: "invalid_request" },
      400,
    );
  }

  try {
    const result = await getIdentityGateway().verifyMagicLink(input);

    if (result.state === "expired") {
      return noStore<LoginVerifyApiResponse>(
        { state: "expired", message: "This sign-in link has expired. Request a new link to continue." },
        410,
      );
    }

    if (result.state === "invalid") {
      return noStore<LoginVerifyApiResponse>(
        { state: "invalid", message: "This sign-in link or verification code is invalid." },
        400,
      );
    }

    if (result.state === "restricted") {
      return noStore<LoginVerifyApiResponse>(
        { state: "restricted", message: "This RFxchange account cannot sign in right now." },
        403,
      );
    }

    if (result.state === "mfa_required") {
      return noStore<LoginVerifyApiResponse>(
        { state: "mfa_required", challengeId: result.challengeId },
        202,
      );
    }

    const nextPath = resolvePostLoginDestination(result.identity.readiness, result.returnTo);
    const response = noStore<LoginVerifyApiResponse>(
      { state: "authenticated", nextPath },
      200,
    );
    response.cookies.set(SESSION_COOKIE_NAME, result.sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: Math.max(60, Math.min(result.expiresInSeconds, 60 * 60 * 24 * 30)),
    });
    return response;
  } catch (error) {
    if (error instanceof IdentityProviderUnavailableError) {
      return noStore<LoginApiError>(
        { error: "Sign-in verification is not configured for this RFxchange environment.", code: "provider_unavailable" },
        503,
      );
    }

    if (error instanceof IdentityProviderRequestError && error.status === 429) {
      return noStore<LoginApiError>(
        { error: "Too many verification attempts. Try again later.", code: "rate_limited" },
        429,
      );
    }

    return noStore<LoginApiError>(
      { error: "Sign-in verification is temporarily unavailable. Try again shortly.", code: "request_failed" },
      503,
    );
  }
}
