import { NextRequest, NextResponse } from "next/server";
import {
  registrationHandoffHref,
  registrationLoginHref,
  validateRegistrationPayload,
  type RegistrationAccepted,
} from "@/lib/identity/registration";
import {
  RegistrationConfigurationError,
  resolveRegistration,
} from "@/lib/identity/registration-service";
import { issueAccountVerification } from "@/lib/identity/verification-service";
import {
  IdentityEmailConfigurationError,
  IdentityEmailDeliveryError,
} from "@/lib/identity/identity-email";
import { DatabaseConfigurationError } from "@/lib/server/database";
import { maskEmail } from "@/lib/identity/account-verification";

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
  };
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const validation = validateRegistrationPayload(body);

  if (!validation.ok) {
    return noStore({ errors: validation.errors }, 400);
  }

  const metadata = requestMetadata(request);

  try {
    const resolution = await resolveRegistration(validation.submission, metadata);

    if (resolution.kind === "existing_verified") {
      const accepted: RegistrationAccepted = {
        status: "existing_account",
        email: resolution.email,
        loginHref: registrationLoginHref(validation.submission.context),
        context: validation.submission.context,
      };
      return noStore(accepted, 200);
    }

    const handoffHref = registrationHandoffHref(resolution.registrationId, resolution.context);

    try {
      const delivery = await issueAccountVerification({
        registrationId: resolution.registrationId,
        action: resolution.resumed ? "resend" : "request",
        metadata: {
          ...metadata,
          appOrigin: request.nextUrl.origin,
        },
      });

      const accepted: RegistrationAccepted = {
        status: "verification_required",
        registrationId: resolution.registrationId,
        email: resolution.email,
        maskedEmail: delivery.maskedEmail,
        nextStep: "account_verification",
        handoffHref,
        context: resolution.context,
        delivery: delivery.kind === "sent" ? "sent" : "already_sent",
        ...(delivery.kind === "rate_limited" ? { retryAfterSeconds: delivery.retryAfterSeconds } : {}),
      };
      return noStore(accepted, 202);
    } catch (error) {
      if (error instanceof IdentityEmailConfigurationError || error instanceof IdentityEmailDeliveryError) {
        const accepted: RegistrationAccepted = {
          status: "verification_delivery_failed",
          registrationId: resolution.registrationId,
          email: resolution.email,
          maskedEmail: maskEmail(resolution.email),
          handoffHref: registrationHandoffHref(resolution.registrationId, resolution.context, "resend"),
          context: resolution.context,
          message: error instanceof IdentityEmailConfigurationError
            ? "Your registration was saved, but transactional verification email is not configured for this environment."
            : "Your registration was saved, but the verification email could not be delivered. Use the resend workflow after email delivery is restored.",
        };
        return noStore(accepted, error instanceof IdentityEmailConfigurationError ? 503 : 502);
      }
      throw error;
    }
  } catch (error) {
    if (error instanceof DatabaseConfigurationError || error instanceof RegistrationConfigurationError) {
      return noStore(
        {
          errors: {
            form: error.message,
          },
        },
        503,
      );
    }

    console.error("Registration service failed", error);
    return noStore({ errors: { form: "Registration could not be completed right now." } }, 500);
  }
}
