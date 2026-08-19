import { NextRequest, NextResponse } from "next/server";
import {
  ACCOUNT_VERIFICATION_TTL_SECONDS,
  isPlausibleEmail,
  normalizeEmail,
} from "@/lib/identity/account-verification";
import {
  createOnboardingSessionToken,
  onboardingSessionConfigured,
  ONBOARDING_SESSION_COOKIE,
  ONBOARDING_SESSION_TTL_SECONDS,
} from "@/lib/identity/onboarding-session";
import {
  issueAccountVerification,
  VerificationEmailConflictError,
  VerificationNotFoundError,
  verifyAccountVerificationToken,
} from "@/lib/identity/verification-service";
import {
  IdentityEmailConfigurationError,
  IdentityEmailDeliveryError,
} from "@/lib/identity/identity-email";
import { DatabaseConfigurationError } from "@/lib/server/database";

export const dynamic = "force-dynamic";

function noStore<T>(body: T, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function requestMetadata(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const requestIp = forwarded && /^[0-9a-f:.]+$/i.test(forwarded) ? forwarded : undefined;
  return {
    requestIp,
    userAgent: request.headers.get("user-agent")?.slice(0, 500) || undefined,
    appOrigin: request.nextUrl.origin,
  };
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    body = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return noStore({ state: "invalid", message: "Invalid request body." }, 400);
  }

  try {
    if (body.action === "verify") {
      const token = typeof body.token === "string" ? body.token : "";
      if (!token) return noStore({ state: "invalid", message: "Verification token is required." }, 400);
      if (!onboardingSessionConfigured()) {
        return noStore(
          {
            state: "configuration_error",
            message: "Verified onboarding sessions require RFXCHANGE_SESSION_SECRET with at least 32 characters.",
          },
          503,
        );
      }

      const result = await verifyAccountVerificationToken(token);
      if (result.kind === "expired") {
        return noStore({ state: "expired", message: "This verification link has expired." }, 410);
      }
      if (result.kind === "invalid") {
        return noStore({ state: "invalid", message: "This verification link is invalid or has already been used." }, 400);
      }

      const onboardingSession = createOnboardingSessionToken(result.email);
      if (!onboardingSession) {
        return noStore({ state: "configuration_error", message: "Verified onboarding session could not be established." }, 503);
      }

      const response = noStore({
        state: "verified",
        email: result.email,
        context: result.context,
        nextPath: result.nextPath,
      });
      response.cookies.set(ONBOARDING_SESSION_COOKIE, onboardingSession, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: ONBOARDING_SESSION_TTL_SECONDS,
      });
      return response;
    }

    if (body.action === "request" || body.action === "resend" || body.action === "change_email") {
      const registrationId = typeof body.registrationId === "string" ? body.registrationId.trim() : "";
      if (!registrationId) {
        return noStore({ state: "invalid", message: "Registration context is required." }, 400);
      }

      let newEmail: string | undefined;
      if (body.action === "change_email") {
        newEmail = typeof body.email === "string" ? normalizeEmail(body.email) : "";
        if (!isPlausibleEmail(newEmail)) {
          return noStore({ state: "invalid", message: "Enter a valid email address." }, 400);
        }
      }

      const result = await issueAccountVerification({
        registrationId,
        action: body.action,
        newEmail,
        metadata: requestMetadata(request),
      });

      if (result.kind === "rate_limited") {
        return noStore(
          {
            state: "rate_limited",
            maskedEmail: result.maskedEmail,
            retryAfterSeconds: result.retryAfterSeconds,
            message: `A verification link was sent recently. Try again in ${result.retryAfterSeconds} seconds.`,
          },
          429,
        );
      }

      return noStore(
        {
          state: "pending",
          maskedEmail: result.maskedEmail,
          expiresInSeconds: ACCOUNT_VERIFICATION_TTL_SECONDS,
          delivery: "sent",
        },
        202,
      );
    }

    return noStore({ state: "invalid", message: "Unsupported verification action." }, 400);
  } catch (error) {
    if (error instanceof VerificationNotFoundError) {
      return noStore({ state: "invalid", message: error.message }, 404);
    }
    if (error instanceof VerificationEmailConflictError) {
      return noStore({ state: "invalid", message: error.message }, 409);
    }
    if (error instanceof DatabaseConfigurationError || error instanceof IdentityEmailConfigurationError) {
      return noStore({ state: "configuration_error", message: error.message }, 503);
    }
    if (error instanceof IdentityEmailDeliveryError) {
      return noStore(
        {
          state: "delivery_error",
          message: "The verification email could not be delivered. Try again after the email service is restored.",
        },
        502,
      );
    }

    console.error("Account verification service failed", error);
    return noStore({ state: "invalid", message: "Account verification could not be completed right now." }, 500);
  }
}
