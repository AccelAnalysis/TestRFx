import { NextRequest, NextResponse } from "next/server";
import type { LoginApiError, MagicLinkChallengeAccepted } from "@/lib/identity/contracts";
import {
  getIdentityGateway,
  IdentityProviderRequestError,
  IdentityProviderUnavailableError,
} from "@/lib/identity/gateway";
import { isValidEmail, normalizeEmail, sanitizeReturnTo } from "@/lib/identity/login";

interface LoginRequestBody {
  email?: unknown;
  returnTo?: unknown;
}

function noStore<T>(body: T, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function callbackUrl(request: NextRequest) {
  const configuredOrigin = process.env.RFXCHANGE_PUBLIC_ORIGIN?.trim();
  const origin = configuredOrigin || request.nextUrl.origin;

  try {
    const url = new URL("/login/verify", origin);
    if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
      throw new Error("Production callback origin must use HTTPS.");
    }
    return url.toString();
  } catch {
    throw new IdentityProviderUnavailableError(
      "RFXCHANGE_PUBLIC_ORIGIN must resolve to a valid RFxchange application origin.",
    );
  }
}

export async function POST(request: NextRequest) {
  let body: LoginRequestBody;

  try {
    body = (await request.json()) as LoginRequestBody;
  } catch {
    return noStore<LoginApiError>(
      { error: "Enter a valid email address and try again.", code: "invalid_request" },
      400,
    );
  }

  if (typeof body.email !== "string") {
    return noStore<LoginApiError>(
      { error: "Enter a valid email address and try again.", code: "invalid_request" },
      400,
    );
  }

  const email = normalizeEmail(body.email);
  if (!isValidEmail(email)) {
    return noStore<LoginApiError>(
      { error: "Enter a valid email address and try again.", code: "invalid_request" },
      400,
    );
  }

  const returnTo = sanitizeReturnTo(typeof body.returnTo === "string" ? body.returnTo : undefined);

  try {
    const gateway = getIdentityGateway();
    const result = await gateway.requestMagicLink({
      email,
      returnTo,
      callbackUrl: callbackUrl(request),
      userAgent: request.headers.get("user-agent") ?? undefined,
    });

    return noStore<MagicLinkChallengeAccepted>(
      {
        status: "challenge_sent",
        delivery: result.delivery,
        expiresInSeconds: result.expiresInSeconds,
        returnTo,
      },
      202,
    );
  } catch (error) {
    if (error instanceof IdentityProviderUnavailableError) {
      return noStore<LoginApiError>(
        {
          error: "Secure sign-in email delivery is not configured for this RFxchange environment.",
          code: "provider_unavailable",
        },
        503,
      );
    }

    if (error instanceof IdentityProviderRequestError) {
      if (error.status === 404) {
        return noStore<LoginApiError>(
          { error: "No RFxchange account was found for that email.", code: "account_not_found" },
          404,
        );
      }
      if (error.status === 403) {
        return noStore<LoginApiError>(
          { error: "This RFxchange account cannot sign in right now.", code: "account_restricted" },
          403,
        );
      }
      if (error.status === 429) {
        return noStore<LoginApiError>(
          { error: "Too many sign-in attempts. Try again later.", code: "rate_limited" },
          429,
        );
      }
    }

    return noStore<LoginApiError>(
      {
        error: "Secure sign-in is temporarily unavailable. Try again shortly.",
        code: "request_failed",
      },
      503,
    );
  }
}
