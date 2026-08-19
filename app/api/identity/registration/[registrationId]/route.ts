import { NextResponse } from "next/server";
import { maskEmail } from "@/lib/identity/account-verification";
import { registrationHandoffHref, type RegistrationStatus } from "@/lib/identity/registration";
import { readRegistration } from "@/lib/identity/registration-service";
import { DatabaseConfigurationError } from "@/lib/server/database";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ registrationId: string }> },
) {
  const { registrationId } = await params;
  try {
    const registration = await readRegistration(registrationId);
    if (!registration) {
      return NextResponse.json({ error: "Registration not found." }, { status: 404 });
    }

    const response: RegistrationStatus = {
      registrationId: registration.id,
      state: registration.state as RegistrationStatus["state"],
      maskedEmail: maskEmail(registration.email),
      context: registration.context,
      handoffHref: registrationHandoffHref(registration.id, registration.context),
    };
    return NextResponse.json(response, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof DatabaseConfigurationError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error("Registration status failed", error);
    return NextResponse.json({ error: "Registration status is unavailable." }, { status: 500 });
  }
}
