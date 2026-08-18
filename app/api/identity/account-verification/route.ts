import { NextRequest, NextResponse } from "next/server";
import { isPlausibleEmail, normalizeEmail } from "@/lib/identity/account-verification";
import { EmailDeliveryError } from "@/lib/identity/account-verification-mailer";
import {
  IdentityStoreError,
  ONBOARDING_SESSION_COOKIE,
  ONBOARDING_SESSION_TTL_SECONDS,
} from "@/lib/identity/account-verification-store";
import {
  changeVerificationEmail,
  readAccountVerificationStatus,
  sendVerification,
  verifyAccountEmail,
} from "@/lib/identity/account-verification-service";

export const dynamic = "force-dynamic";

function json<T>(body: T, status = 200, headers: Record<string, string> = {}) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });
}

function sessionToken(request: NextRequest): string | undefined {
  return request.cookies.get(ONBOARDING_SESSION_COOKIE)?.value;
}

function requestMetadata(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return {
    requestIp: forwarded || request.headers.get("x-real-ip") || undefined,
    requestUserAgent: request.headers.get("user-agent")?.slice(0, 500) || undefined,
  };
}

function withOnboardingSession(response: NextResponse, token: string) {
  response.cookies.set(ONBOARDING_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONBOARDING_SESSION_TTL_SECONDS,
  });
  return response;
}

function errorResponse(error: unknown): NextResponse {
  if (error instanceof IdentityStoreError) {
    if (error.code === "rate_limited") {
      return json(
        {
          state: "pending",
          message: error.message,
          retryAfterSeconds: error.retryAfterSeconds,
          registrationId: error.registrationId,
        },
        429,
        error.retryAfterSeconds ? { "Retry-After": String(error.retryAfterSeconds) } : {},
      );
    }
    if (error.code === "expired_challenge") {
      return json(
        { state: "expired", message: error.message, registrationId: error.registrationId },
        410,
      );
    }
    if (error.code === "invalid_challenge") {
      return json(
        { state: "invalid", message: error.message, registrationId: error.registrationId },
        400,
      );
    }
    if (error.code === "session_invalid") {
      return json({ state: "invalid", message: error.message }, 401);
    }
    if (error.code === "account_not_found") {
      return json({ state: "invalid", message: error.message }, 404);
    }
    if (error.code === "account_exists" || error.code === "duplicate_email") {
      return json({ state: "invalid", message: error.message }, 409);
    }
    if (error.code === "restricted") {
      return json({ state: "invalid", message: error.message }, 403);
    }
    return json({ state: "configuration_error", message: error.message }, 503);
  }

  if (error instanceof EmailDeliveryError) {
    const status = error.code === "delivery_failed" ? 502 : 503;
    return json(
      {
        state: error.code === "delivery_failed" ? "invalid" : "configuration_error",
        message: error.message,
      },
      status,
    );
  }

  return json(
    { state: "invalid", message: "Account verification could not be completed right now." },
    500,
  );
}

export async function GET(request: NextRequest) {
  const registrationId = request.nextUrl.searchParams.get("registration")?.trim() ?? "";
  if (!registrationId) {
    return json({ state: "invalid", message: "A pending registration is required." }, 400);
  }

  try {
    return json(await readAccountVerificationStatus({
      registrationId,
      sessionToken: sessionToken(request),
    }));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    body = parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return json({ state: "invalid", message: "Invalid request body." }, 400);
  }

  const action = body.action === "request" ? "send" : body.action;

  if (action === "verify") {
    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (!token) return json({ state: "invalid", message: "Verification token is required." }, 400);

    try {
      const verified = await verifyAccountEmail(token);
      return withOnboardingSession(json(verified.response), verified.sessionToken);
    } catch (error) {
      return errorResponse(error);
    }
  }

  const registrationId = typeof body.registrationId === "string" ? body.registrationId.trim() : "";
  if (!registrationId) {
    return json({ state: "invalid", message: "A pending registration is required." }, 400);
  }

  const metadata = requestMetadata(request);

  try {
    if (action === "send" || action === "resend") {
      const response = await sendVerification({
        registrationId,
        sessionToken: sessionToken(request),
        reason: action,
        requestOrigin: request.nextUrl.origin,
        ...metadata,
      });
      return json(response, 202);
    }

    if (action === "change_email") {
      const newEmail = typeof body.newEmail === "string" ? normalizeEmail(body.newEmail) : "";
      if (!isPlausibleEmail(newEmail)) {
        return json({ state: "invalid", message: "Enter a valid email address." }, 400);
      }
      const response = await changeVerificationEmail({
        registrationId,
        sessionToken: sessionToken(request),
        newEmail,
        requestOrigin: request.nextUrl.origin,
        ...metadata,
      });
      return json(response, 202);
    }
  } catch (error) {
    return errorResponse(error);
  }

  return json({ state: "invalid", message: "Unsupported verification action." }, 400);
}
