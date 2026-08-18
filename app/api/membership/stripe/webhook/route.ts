import { NextRequest, NextResponse } from "next/server";
import {
  MembershipEntitlementUnavailableError,
  publishMembershipEvent,
} from "@/lib/membership/entitlement-gateway";
import { verifyStripeWebhookSignature } from "@/lib/membership/stripe";

export const dynamic = "force-dynamic";

const MEMBERSHIP_EVENT_TYPES = new Set([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
]);

function noStore<T>(body: T, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.RFXCHANGE_STRIPE_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) {
    return noStore({ error: "Stripe webhook verification is not configured." }, 503);
  }

  const signature = request.headers.get("stripe-signature") ?? "";
  const rawBody = await request.text();
  if (!signature || !verifyStripeWebhookSignature(rawBody, signature, webhookSecret)) {
    return noStore({ error: "Invalid Stripe webhook signature." }, 400);
  }

  const event = JSON.parse(rawBody) as { id?: string; type?: string; data?: unknown };
  if (!event.id || !event.type) {
    return noStore({ error: "Invalid Stripe event payload." }, 400);
  }

  if (!MEMBERSHIP_EVENT_TYPES.has(event.type)) {
    return noStore({ received: true, ignored: true }, 200);
  }

  try {
    await publishMembershipEvent(event);
    return noStore({ received: true }, 200);
  } catch (error) {
    if (error instanceof MembershipEntitlementUnavailableError) {
      return noStore(
        { error: "RFxchange membership entitlement service is not configured." },
        503,
      );
    }
    return noStore(
      { error: "RFxchange could not process this membership event yet." },
      503,
    );
  }
}
