import { NextRequest, NextResponse } from "next/server";
import {
  registrationContextSearchParams,
  validateRegistrationPayload,
  type RegistrationAccepted,
} from "@/lib/identity/registration";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const validation = validateRegistrationPayload(body);

  if (!validation.ok) {
    return NextResponse.json({ errors: validation.errors }, { status: 400 });
  }

  const registrationId = `reg_${crypto.randomUUID()}`;
  const params = registrationContextSearchParams(validation.submission.context);
  params.set("email", validation.submission.email);
  params.set("displayName", `${validation.submission.firstName} ${validation.submission.lastName}`);
  params.set("registration", registrationId);
  params.set("source", params.get("source") || "registration");

  const accepted: RegistrationAccepted = {
    status: "verification_required",
    registrationId,
    email: validation.submission.email,
    nextStep: "account_verification",
    handoffHref: `/onboarding/account-verification?${params.toString()}`,
    context: validation.submission.context,
    adapter: "reference",
  };

  return NextResponse.json(accepted, {
    status: 202,
    headers: { "Cache-Control": "no-store" },
  });
}
