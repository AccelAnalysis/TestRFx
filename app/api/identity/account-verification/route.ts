import { NextRequest, NextResponse } from "next/server";
import {
  ACCOUNT_VERIFICATION_TTL_SECONDS,
  buildOnboardingContinuation,
  isPlausibleEmail,
  maskEmail,
  normalizeEmail,
  sanitizeVerificationContext,
} from "@/lib/identity/account-verification";
import {
  createReferenceVerificationToken,
  verifyReferenceVerificationToken,
} from "@/lib/identity/account-verification-token";
import {
  createOnboardingSessionToken,
  ONBOARDING_SESSION_COOKIE,
  ONBOARDING_SESSION_TTL_SECONDS,
} from "@/lib/identity/onboarding-session";

export const dynamic = "force-dynamic";

function noStore<T>(body: T, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    body = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return noStore({ state: "invalid", message: "Invalid request body." }, 400);
  }

  if (body.action === "verify") {
    const token = typeof body.token === "string" ? body.token : "";
    if (!token) return noStore({ state: "invalid", message: "Verification token is required." }, 400);

    const result = verifyReferenceVerificationToken(token);
    if (!result.ok) {
      if (result.reason === "expired") {
        return noStore({ state: "expired", message: "This verification link has expired." }, 410);
      }
      if (result.reason === "configuration_error") {
        return noStore(
          {
            state: "configuration_error",
            message: "Account verification is not configured for this environment.",
          },
          503,
        );
      }
      return noStore({ state: "invalid", message: "This verification link is invalid." }, 400);
    }

    const onboardingSession = createOnboardingSessionToken(
      result.payload.email,
      result.payload.context.displayName,
    );
    if (!onboardingSession) {
      return noStore(
        {
          state: "configuration_error",
          message: "Verified onboarding sessions are not configured for this environment.",
        },
        503,
      );
    }

    const response = noStore({
      state: "verified",
      email: result.payload.email,
      context: result.payload.context,
      nextPath: buildOnboardingContinuation(result.payload.context),
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
    const email = typeof body.email === "string" ? normalizeEmail(body.email) : "";
    if (!isPlausibleEmail(email)) {
      return noStore({ state: "invalid", message: "Enter a valid email address." }, 400);
    }

    const context = sanitizeVerificationContext(body.context);
    const challenge = createReferenceVerificationToken(email, context);
    if (!challenge) {
      return noStore(
        {
          state: "configuration_error",
          message: "Set ACCOUNT_VERIFICATION_SECRET before enabling account verification in production.",
        },
        503,
      );
    }

    const verificationPath = `/onboarding/account-verification?token=${encodeURIComponent(challenge.token)}`;
    const referenceDelivery = process.env.NODE_ENV !== "production";

    return noStore(
      {
        state: "pending",
        maskedEmail: maskEmail(email),
        expiresInSeconds: ACCOUNT_VERIFICATION_TTL_SECONDS,
        referenceDelivery,
        ...(referenceDelivery ? { verificationPath } : {}),
      },
      202,
    );
  }

  return noStore({ state: "invalid", message: "Unsupported verification action." }, 400);
}
