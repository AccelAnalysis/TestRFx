import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import Stripe from "stripe";
import { FOUNDING_PRICE_LOOKUP_KEY } from "@/lib/membership/catalog";
import { MembershipServiceError, type MembershipActorContext, type MembershipPlanCode } from "@/lib/membership/contracts";
import {
  assertMembershipActor,
  getBillingCustomerId,
  saveBillingCustomer,
} from "@/lib/membership/repository";

let stripeClient: Stripe | null = null;

export class StripeMembershipConfigurationError extends MembershipServiceError {
  constructor(message = "Stripe Billing is not configured for this RFxchange runtime.") {
    super("STRIPE_NOT_CONFIGURED", message, 503);
    this.name = "StripeMembershipConfigurationError";
  }
}

function getStripe(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) throw new StripeMembershipConfigurationError();
  if (!stripeClient) {
    stripeClient = new Stripe(secretKey, { apiVersion: "2026-07-29.dahlia" });
  }
  return stripeClient;
}

function integrationIdentifier(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz";
  const bytes = randomBytes(8);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

export interface StripeMembershipOffer {
  productId: string;
  productName: string;
  description: string;
  priceId: string;
  lookupKey: string;
  priceCents: number;
  currency: string;
  interval: "month";
}

export async function getStripeMembershipOffer(
  code: MembershipPlanCode,
): Promise<StripeMembershipOffer> {
  if (code !== "founding") {
    throw new MembershipServiceError("MEMBERSHIP_PLAN_NOT_FOUND", "The requested membership plan is not available.", 404);
  }

  const stripe = getStripe();
  const prices = await stripe.prices.list({
    active: true,
    lookup_keys: [FOUNDING_PRICE_LOOKUP_KEY],
    limit: 1,
    expand: ["data.product"],
  });
  const price = prices.data[0];
  if (!price || price.unit_amount == null || price.currency !== "usd" || price.recurring?.interval !== "month") {
    throw new MembershipServiceError(
      "STRIPE_MEMBERSHIP_PRICE_NOT_FOUND",
      `Stripe does not have an active monthly USD price with lookup key ${FOUNDING_PRICE_LOOKUP_KEY}.`,
      503,
    );
  }

  const product = typeof price.product === "string" ? await stripe.products.retrieve(price.product) : price.product;
  if ("deleted" in product && product.deleted) {
    throw new MembershipServiceError("STRIPE_MEMBERSHIP_PRODUCT_INACTIVE", "The Stripe membership product is unavailable.", 503);
  }

  return {
    productId: product.id,
    productName: product.name,
    description: product.description ?? "Organization-level RFxchange Founding Membership.",
    priceId: price.id,
    lookupKey: price.lookup_key ?? FOUNDING_PRICE_LOOKUP_KEY,
    priceCents: price.unit_amount,
    currency: price.currency,
    interval: "month",
  };
}

async function ensureStripeCustomer(actor: MembershipActorContext): Promise<string> {
  const existing = await getBillingCustomerId(actor.organizationId);
  if (existing) return existing;

  const identity = await assertMembershipActor(actor);
  const customer = await getStripe().customers.create({
    name: identity.organizationName,
    email: identity.userEmail,
    metadata: {
      rfxchange_organization_id: actor.organizationId,
      rfxchange_billing_contact_user_id: actor.userId,
    },
  });
  await saveBillingCustomer({
    organizationId: actor.organizationId,
    stripeCustomerId: customer.id,
    billingEmail: identity.userEmail,
  });
  return customer.id;
}

export async function createSubscriptionCheckout(input: {
  actor: MembershipActorContext;
  planCode: MembershipPlanCode;
  priceId: string;
  reservationId: string;
  membershipId: string;
  origin: string;
}): Promise<Stripe.Checkout.Session> {
  const stripe = getStripe();
  const customerId = await ensureStripeCustomer(input.actor);
  const metadata = {
    rfxchange_plan_code: input.planCode,
    rfxchange_organization_id: input.actor.organizationId,
    rfxchange_user_id: input.actor.userId,
    rfxchange_capacity_reservation_id: input.reservationId,
    rfxchange_membership_id: input.membershipId,
  };

  const params: Stripe.Checkout.SessionCreateParams & { integration_identifier: string } = {
    mode: "subscription",
    customer: customerId,
    client_reference_id: input.actor.organizationId,
    line_items: [{ price: input.priceId, quantity: 1 }],
    success_url: `${input.origin}/onboarding/membership/complete?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${input.origin}/onboarding/membership/payment?membership=${encodeURIComponent(input.planCode)}&cancelled=1`,
    metadata,
    subscription_data: { metadata },
    integration_identifier: integrationIdentifier(),
  };

  return stripe.checkout.sessions.create(params);
}

export async function createBillingPortalSession(input: {
  actor: MembershipActorContext;
  returnUrl: string;
}): Promise<Stripe.BillingPortal.Session> {
  await assertMembershipActor(input.actor);
  const customerId = await getBillingCustomerId(input.actor.organizationId);
  if (!customerId) {
    throw new MembershipServiceError(
      "BILLING_ACCOUNT_NOT_FOUND",
      "This organization does not yet have a Stripe billing account.",
      404,
    );
  }
  return getStripe().billingPortal.sessions.create({ customer: customerId, return_url: input.returnUrl });
}

export function constructStripeWebhook(payload: string, signature: string): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) {
    throw new MembershipServiceError("STRIPE_WEBHOOK_NOT_CONFIGURED", "Stripe webhook verification is not configured.", 503);
  }
  return getStripe().webhooks.constructEvent(payload, signature, secret);
}

export function verifyStripeWebhookSignature(
  payload: string,
  signatureHeader: string,
  webhookSecret: string,
  toleranceSeconds = 300,
): boolean {
  const parts = signatureHeader.split(",").map((part) => part.trim());
  const timestampPart = parts.find((part) => part.startsWith("t="));
  const signatures = parts.filter((part) => part.startsWith("v1=")).map((part) => part.slice(3));
  const timestamp = timestampPart ? Number(timestampPart.slice(2)) : Number.NaN;
  if (!Number.isFinite(timestamp) || signatures.length === 0 || !webhookSecret) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - timestamp) > toleranceSeconds) return false;

  const expected = createHmac("sha256", webhookSecret).update(`${timestamp}.${payload}`).digest("hex");
  const expectedBuffer = Buffer.from(expected, "utf8");
  return signatures.some((signature) => {
    const actualBuffer = Buffer.from(signature, "utf8");
    return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
  });
}

export function retrieveCheckoutSession(sessionId: string): Promise<Stripe.Checkout.Session> {
  return getStripe().checkout.sessions.retrieve(sessionId, { expand: ["subscription", "customer"] });
}

export function retrieveSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
  return getStripe().subscriptions.retrieve(subscriptionId);
}
