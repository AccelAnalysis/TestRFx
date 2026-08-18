import { NextRequest, NextResponse } from "next/server";
import {
  buildOnboardingContinuation,
  isPlausibleEmail,
  maskEmail,
  normalizeEmail,
  sanitizeVerificationContext,
} from "@/lib/identity/account-verification";
import {
  AccountVerificationProviderUnavailableError,
  getAccountVerificationGateway,
  type VerificationRequestAction,
} from "@/lib/identity/account-verification-gateway";

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

  try {
    const gateway = getAccountVerificationGateway();

    if (body.action === "verify") {
      const token = typeof body.token === "string" ? body.token : "";
      if (!token) return noStore({ state: "invalid", message: "Verification token is required." }, 400);

      const result = await gateway.verifyChallenge(token);
      if (result.state === "expired") {
        return noStore({ state: "expired", message: "This verification link has expired." }, 410);
      }
      if (result.state !== "verified") {
        return noStore({ state: "invalid", message: "This verification link is invalid." }, 400);
      }

      const email = normalizeEmail(result.email);
      if (!isPlausibleEmail(email)) {
        return noStore({ state: "invalid", message: "Verification provider returned an invalid account email." }, 502);
      }

      const context = sanitizeVerificationContext(result.context);
      return noStore({
        state: "verified",
        email,
        context,
        nextPath: buildOnboardingContinuation(context),
      });
    }

    if (body.action === "request" || body.action === "resend" || body.action === "change_email") {
      const email = typeof body.email === "string" ? normalizeEmail(body.email) : "";
      if (!isPlausibleEmail(email)) {
        return noStore({ state: "invalid", message: "Enter a valid email address." }, 400);
      }

      const action = body.action as VerificationRequestAction;
      const context = sanitizeVerificationContext(body.context);
      const result = await gateway.requestChallenge({ action, email, context });
      if (result.state !== "pending") {
        return noStore({ state: "invalid", message: "Verification provider did not accept the request." }, 502);
      }

      return noStore(
        {
          state: "pending",
          maskedEmail: maskEmail(email),
          expiresInSeconds: result.expiresInSeconds,
        },
        202,
      );
    }
  } catch (error) {
    if (error instanceof AccountVerificationProviderUnavailableError) {
      return noStore(
        {
          state: "configuration_error",
          message: "Account verification service is not configured for this RFxchange environment.",
        },
        503,
      );
    }

    return noStore(
      {
        state: "invalid",
        message: "Account verification is temporarily unavailable. Try again shortly.",
      },
      503,
    );
  }

  return noStore({ state: "invalid", message: "Unsupported verification action." }, 400);
}
