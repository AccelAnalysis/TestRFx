import { NextRequest, NextResponse } from "next/server";
import {
  IdentitySessionUnauthorizedError,
  IdentitySessionUnavailableError,
  resolveIdentitySession,
  SESSION_COOKIE_NAME,
} from "@/lib/identity/session-gateway";
import {
  MembershipCapacityExistingError,
  MembershipCapacityFullError,
  MembershipCapacityUnavailableError,
  releaseFoundingMembershipCapacity,
  reserveFoundingMembershipCapacity,
} from "@/lib/membership/capacity-gateway";
import {
  createFoundingCheckout,
  ExistingFoundingMembershipError,
  FoundingMembershipFullError,
  StripeMembershipConfigurationError,
} from "@/lib/membership/stripe";

function noStore<T>(body: T, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function applicationOrigin(request: NextRequest) {
  const configured = process.env.RFXCHANGE_PUBLIC_ORIGIN?.trim();
  const origin = configured || request.nextUrl.origin;
  const url = new URL(origin);
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
    throw new StripeMembershipConfigurationError(
      "RFXCHANGE_PUBLIC_ORIGIN must use HTTPS in production.",
    );
  }
  return url.origin;
}

export async function POST(request: NextRequest) {
  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value ?? "";
  let reservationId = "";

  try {
    const identity = await resolveIdentitySession(sessionToken);
    if (identity.readiness.restricted) {
      return noStore({ error: "This account cannot start membership checkout." }, 403);
    }
    if (!identity.readiness.accountVerified || !identity.readiness.organizationSelected) {
      return noStore(
        {
          error: "Verify the account and select an organization before starting membership checkout.",
          nextPath: !identity.readiness.accountVerified
            ? "/onboarding/account-verification"
            : "/onboarding/organization",
        },
        409,
      );
    }
    if (!identity.activeOrganizationId) {
      return noStore({ error: "An active organization is required for membership checkout." }, 409);
    }

    const reservation = await reserveFoundingMembershipCapacity({
      organizationId: identity.activeOrganizationId,
      userId: identity.userId,
    });
    reservationId = reservation.reservationId;

    const origin = applicationOrigin(request);
    const checkout = await createFoundingCheckout({
      organizationId: identity.activeOrganizationId,
      userId: identity.userId,
      reservationId,
      successUrl: `${origin}/onboarding/membership/complete?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${origin}/onboarding/membership?membership=founding&checkout=cancelled`,
    });

    return noStore({ sessionId: checkout.id, url: checkout.url }, 201);
  } catch (error) {
    if (reservationId) {
      await releaseFoundingMembershipCapacity(reservationId).catch(() => undefined);
    }

    if (error instanceof IdentitySessionUnauthorizedError) {
      return noStore(
        { error: "Sign in before starting membership checkout.", nextPath: "/login?returnTo=/onboarding/membership?membership=founding" },
        401,
      );
    }
    if (error instanceof IdentitySessionUnavailableError) {
      return noStore({ error: "Identity session service is not configured." }, 503);
    }
    if (error instanceof MembershipCapacityUnavailableError) {
      return noStore({ error: "Founding Membership capacity service is not configured." }, 503);
    }
    if (error instanceof MembershipCapacityExistingError || error instanceof ExistingFoundingMembershipError) {
      return noStore({ error: error.message, nextPath: "/onboarding/completion" }, 409);
    }
    if (error instanceof MembershipCapacityFullError || error instanceof FoundingMembershipFullError) {
      return noStore({ error: error.message }, 409);
    }
    if (error instanceof StripeMembershipConfigurationError) {
      return noStore({ error: error.message }, 503);
    }

    return noStore({ error: "Secure membership checkout is temporarily unavailable." }, 503);
  }
}
