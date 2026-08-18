import { NextRequest, NextResponse } from "next/server";
import {
  registrationHandoffHref,
  validateRegistrationPayload,
  type RegistrationAccepted,
} from "@/lib/identity/registration";
import {
  getRegistrationGateway,
  RegistrationProviderUnavailableError,
} from "@/lib/identity/registration-gateway";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const validation = validateRegistrationPayload(body);

  if (!validation.ok) {
    return NextResponse.json({ errors: validation.errors }, { status: 400 });
  }

  try {
    const gateway = getRegistrationGateway();
    const pending = await gateway.createPendingRegistration(validation.submission);
    const accepted: RegistrationAccepted = {
      status: "verification_required",
      registrationId: pending.registrationId,
      email: validation.submission.email,
      nextStep: "account_verification",
      handoffHref: registrationHandoffHref(pending.registrationId, validation.submission.context),
      context: validation.submission.context,
      adapter: "provider",
    };

    return NextResponse.json(accepted, {
      status: 202,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof RegistrationProviderUnavailableError) {
      return NextResponse.json(
        { error: "Registration service is not configured for this RFxchange environment." },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }

    return NextResponse.json(
      { error: "Registration is temporarily unavailable. Try again shortly." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
