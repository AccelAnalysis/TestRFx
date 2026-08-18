import { NextRequest, NextResponse } from "next/server";
import type { LoginApiError, MagicLinkChallengeAccepted } from "@/lib/identity/contracts";
import { getIdentityGateway } from "@/lib/identity/gateway";
import { isValidEmail, normalizeEmail, sanitizeReturnTo } from "@/lib/identity/login";

interface LoginRequestBody {
  email?: unknown;
  returnTo?: unknown;
}

export async function POST(request: NextRequest) {
  let body: LoginRequestBody;

  try {
    body = (await request.json()) as LoginRequestBody;
  } catch {
    return NextResponse.json<LoginApiError>(
      { error: "Enter a valid email address and try again.", code: "invalid_request" },
      { status: 400 },
    );
  }

  if (typeof body.email !== "string") {
    return NextResponse.json<LoginApiError>(
      { error: "Enter a valid email address and try again.", code: "invalid_request" },
      { status: 400 },
    );
  }

  const email = normalizeEmail(body.email);
  if (!isValidEmail(email)) {
    return NextResponse.json<LoginApiError>(
      { error: "Enter a valid email address and try again.", code: "invalid_request" },
      { status: 400 },
    );
  }

  const returnTo = sanitizeReturnTo(typeof body.returnTo === "string" ? body.returnTo : undefined);

  try {
    const gateway = getIdentityGateway();
    const result = await gateway.requestMagicLink({
      email,
      returnTo,
      userAgent: request.headers.get("user-agent") ?? undefined,
    });

    return NextResponse.json<MagicLinkChallengeAccepted>(
      {
        status: "challenge_sent",
        delivery: result.delivery,
        expiresInSeconds: result.expiresInSeconds,
        returnTo,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json<LoginApiError>(
      {
        error: "Secure sign-in is temporarily unavailable. Try again shortly.",
        code: "request_failed",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
