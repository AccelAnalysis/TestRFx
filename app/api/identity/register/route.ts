import { NextRequest, NextResponse } from "next/server";
import {
  sanitizeVerificationContext,
  sourceFromRegistrationContext,
} from "@/lib/identity/account-verification";
import {
  createOrResumePendingAccount,
  IdentityStoreError,
  ONBOARDING_SESSION_COOKIE,
  ONBOARDING_SESSION_TTL_SECONDS,
} from "@/lib/identity/account-verification-store";
import {
  registrationHandoffHref,
  validateRegistrationPayload,
  type RegistrationAccepted,
} from "@/lib/identity/registration";

export const dynamic = "force-dynamic";

function noStore<T>(body: T, status: number) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const validation = validateRegistrationPayload(body);

  if (!validation.ok) {
    return noStore({ errors: validation.errors }, 400);
  }

  const context = validation.submission.context;
  const verificationContext = sanitizeVerificationContext({
    source: sourceFromRegistrationContext(context.entryKind),
    acquisitionSource: context.source,
    invitation: context.invitation,
    referral: context.referral,
    campaign: context.campaign,
    organization: context.organization,
    membership: context.membership,
    geography: context.geography,
    record: context.record,
    returnTo: context.returnTo,
  });

  try {
    const pending = await createOrResumePendingAccount({
      firstName: validation.submission.firstName,
      lastName: validation.submission.lastName,
      email: validation.submission.email,
      marketingConsent: validation.submission.marketingConsent,
      context: verificationContext,
    });

    const accepted: RegistrationAccepted = {
      status: "verification_required",
      registrationId: pending.account.registrationId,
      email: pending.account.email,
      nextStep: "account_verification",
      handoffHref: registrationHandoffHref(pending.account.registrationId, context),
      context,
      adapter: "runtime",
      resumed: pending.resumed,
    };

    const response = noStore(accepted, 202);
    response.cookies.set(ONBOARDING_SESSION_COOKIE, pending.sessionToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: ONBOARDING_SESSION_TTL_SECONDS,
    });
    return response;
  } catch (error) {
    if (error instanceof IdentityStoreError) {
      if (error.code === "account_exists") {
        return noStore(
          { errors: { email: "An RFxchange account already exists for this email. Sign in instead." } },
          409,
        );
      }
      if (error.code === "restricted") {
        return noStore({ errors: { form: error.message } }, 403);
      }
      return noStore({ errors: { form: error.message } }, 503);
    }
    return noStore({ errors: { form: "Registration could not be completed right now." } }, 500);
  }
}
