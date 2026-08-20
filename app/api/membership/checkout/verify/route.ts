import { NextRequest, NextResponse } from "next/server";
import {
  IdentitySessionUnauthorizedError,
  IdentitySessionUnavailableError,
  resolveIdentitySession,
  SESSION_COOKIE_NAME,
} from "@/lib/identity/session-gateway";
import {
  retrieveCheckoutSession,
  StripeMembershipConfigurationError,
} from "@/lib/membership/stripe";

function noStore<T>(body: T, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const sessionId = typeof body?.sessionId === "string" ? body.sessionId.trim() : "";
  if (!sessionId) return noStore({ error: "Checkout Session ID is required." }, 400);

  try {
    const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value ?? "";
    const identity = await resolveIdentitySession(sessionToken);
    if (!identity.activeOrganizationId) {
      return noStore({ error: "An active organization is required." }, 409);
    }

    const checkout = await retrieveCheckoutSession(sessionId);
    const organizationMatches = checkout.client_reference_id === identity.activeOrganizationId;
    const foundingPlan = checkout.metadata?.rfxchange_plan_key === "founding";
    const completed = checkout.status === "complete";
    const paymentConfirmed =
      checkout.payment_status === "paid" ||
      checkout.payment_status === "no_payment_required";

    if (!organizationMatches || !foundingPlan) {
      return noStore({ error: "This Checkout Session does not belong to the active RFxchange organization." }, 403);
    }
    if (!completed || !paymentConfirmed) {
      return noStore(
        {
          state: "pending",
          message: "Stripe has not yet confirmed the Founding Membership checkout.",
        },
        202,
      );
    }

    return noStore(
      {
        state: "confirmed",
        message: "Stripe confirmed the Founding Membership checkout. Entitlement is finalized from signed Stripe webhook events.",
        nextPath: "/onboarding/completion",
      },
      200,
    );
  } catch (error) {
    if (error instanceof IdentitySessionUnauthorizedError) {
      return noStore({ error: "Sign in to confirm membership checkout." }, 401);
    }
    if (error instanceof IdentitySessionUnavailableError) {
      return noStore({ error: "Identity session service is not configured." }, 503);
    }
    if (error instanceof StripeMembershipConfigurationError) {
      return noStore({ error: error.message }, 503);
    }
    return noStore({ error: "Membership checkout confirmation is temporarily unavailable." }, 503);
  }
}
