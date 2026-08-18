import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { foundingMembership } from "./catalog";

const STRIPE_API = "https://api.stripe.com/v1";
const STRIPE_VERSION = "2026-06-24.dahlia";
const DEFAULT_FOUNDING_LOOKUP_KEY = "rfxchange_founding_monthly";

export class StripeMembershipConfigurationError extends Error {
  constructor(message = "Stripe membership checkout is not configured.") {
    super(message);
    this.name = "StripeMembershipConfigurationError";
  }
}

export class FoundingMembershipFullError extends Error {
  constructor() {
    super("Founding Membership has reached its organization capacity.");
    this.name = "FoundingMembershipFullError";
  }
}

export class ExistingFoundingMembershipError extends Error {
  constructor() {
    super("This organization already has a Founding Membership subscription.");
    this.name = "ExistingFoundingMembershipError";
  }
}

type StripePrice = {
  id: string;
  active: boolean;
  currency: string;
  unit_amount: number | null;
  lookup_key: string | null;
  recurring?: { interval?: string; interval_count?: number } | null;
};

type StripeSubscription = {
  id: string;
  status: string;
  metadata?: Record<string, string>;
};

type StripeList<T> = {
  data: T[];
  has_more: boolean;
};

export type StripeCheckoutSession = {
  id: string;
  url: string | null;
  status?: string | null;
  payment_status?: string | null;
  mode?: string | null;
  client_reference_id?: string | null;
  customer?: string | null;
  subscription?: string | { id?: string } | null;
  metadata?: Record<string, string>;
};

function stripeKey() {
  const key =
    process.env.RFXCHANGE_STRIPE_RESTRICTED_KEY?.trim() ||
    process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    throw new StripeMembershipConfigurationError(
      "Set RFXCHANGE_STRIPE_RESTRICTED_KEY (preferred) or STRIPE_SECRET_KEY.",
    );
  }
  return key;
}

function stripeErrorMessage(payload: unknown) {
  if (!payload || typeof payload !== "object") return undefined;
  const error = (payload as { error?: unknown }).error;
  if (!error || typeof error !== "object") return undefined;
  const message = (error as { message?: unknown }).message;
  return typeof message === "string" ? message : undefined;
}

async function stripeRequest<T>(
  path: string,
  init: RequestInit = {},
  idempotencyKey?: string,
): Promise<T> {
  const response = await fetch(`${STRIPE_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${stripeKey()}`,
      "Stripe-Version": STRIPE_VERSION,
      ...(init.body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(stripeErrorMessage(payload) || `Stripe request failed (${response.status}).`);
  }
  if (!payload) throw new Error("Stripe returned an empty response.");
  return payload as T;
}

export async function resolveFoundingStripePrice(): Promise<StripePrice> {
  const configuredPriceId = process.env.RFXCHANGE_STRIPE_FOUNDING_PRICE_ID?.trim();
  let price: StripePrice | undefined;

  if (configuredPriceId) {
    price = await stripeRequest<StripePrice>(`/prices/${encodeURIComponent(configuredPriceId)}`);
  } else {
    const lookupKey =
      process.env.RFXCHANGE_STRIPE_FOUNDING_LOOKUP_KEY?.trim() ||
      DEFAULT_FOUNDING_LOOKUP_KEY;
    const params = new URLSearchParams({ active: "true", limit: "1" });
    params.append("lookup_keys[]", lookupKey);
    const prices = await stripeRequest<StripeList<StripePrice>>(`/prices?${params.toString()}`);
    price = prices.data[0];
  }

  if (!price) {
    throw new StripeMembershipConfigurationError(
      "No active Stripe Price matches the RFxchange Founding Membership lookup.",
    );
  }

  const valid =
    price.active &&
    price.currency.toLowerCase() === foundingMembership.price.currency.toLowerCase() &&
    price.unit_amount === foundingMembership.price.cents &&
    price.recurring?.interval === foundingMembership.billingInterval &&
    (price.recurring.interval_count ?? 1) === 1;

  if (!valid) {
    throw new StripeMembershipConfigurationError(
      "Configured Stripe Price does not match the $49/month RFxchange Founding Membership contract.",
    );
  }

  return price;
}

async function foundingSubscriptionOrganizations(priceId: string) {
  const organizations = new Set<string>();
  let startingAfter = "";

  for (let page = 0; page < 4; page += 1) {
    const params = new URLSearchParams({ price: priceId, limit: "100" });
    if (startingAfter) params.set("starting_after", startingAfter);
    const subscriptions = await stripeRequest<StripeList<StripeSubscription>>(
      `/subscriptions?${params.toString()}`,
    );

    for (const subscription of subscriptions.data) {
      if (subscription.status === "canceled" || subscription.status === "incomplete_expired") continue;
      organizations.add(subscription.metadata?.organization_id || `stripe:${subscription.id}`);
    }

    if (!subscriptions.has_more || subscriptions.data.length === 0) break;
    startingAfter = subscriptions.data[subscriptions.data.length - 1].id;
  }

  return organizations;
}

function randomLetters(length: number) {
  const alphabet = "abcdefghijklmnopqrstuvwxyz";
  const bytes = randomBytes(length);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

export async function createFoundingCheckout(input: {
  organizationId: string;
  userId: string;
  successUrl: string;
  cancelUrl: string;
}) {
  const price = await resolveFoundingStripePrice();
  const organizations = await foundingSubscriptionOrganizations(price.id);

  if (organizations.has(input.organizationId)) {
    throw new ExistingFoundingMembershipError();
  }
  if (organizations.size >= foundingMembership.capacity.limit) {
    throw new FoundingMembershipFullError();
  }

  const form = new URLSearchParams();
  form.set("mode", "subscription");
  form.set("line_items[0][price]", price.id);
  form.set("line_items[0][quantity]", "1");
  form.set("success_url", input.successUrl);
  form.set("cancel_url", input.cancelUrl);
  form.set("client_reference_id", input.organizationId);
  form.set("metadata[organization_id]", input.organizationId);
  form.set("metadata[user_id]", input.userId);
  form.set("metadata[rfxchange_plan_key]", foundingMembership.code);
  form.set("subscription_data[metadata][organization_id]", input.organizationId);
  form.set("subscription_data[metadata][rfxchange_plan_key]", foundingMembership.code);
  form.set("integration_identifier", `rfxchange_founding_${randomLetters(8)}`);

  const session = await stripeRequest<StripeCheckoutSession>(
    "/checkout/sessions",
    { method: "POST", body: form.toString() },
    `rfxchange-founding-${input.organizationId}-${randomBytes(8).toString("hex")}`,
  );

  if (!session.url) throw new Error("Stripe Checkout Session did not return a hosted Checkout URL.");
  return session;
}

export async function retrieveCheckoutSession(sessionId: string) {
  if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) {
    throw new Error("Invalid Stripe Checkout Session ID.");
  }
  return stripeRequest<StripeCheckoutSession>(
    `/checkout/sessions/${encodeURIComponent(sessionId)}`,
  );
}

export function verifyStripeWebhookSignature(
  rawBody: string,
  signatureHeader: string,
  webhookSecret: string,
  toleranceSeconds = 300,
) {
  const parts = signatureHeader.split(",");
  const timestamp = parts.find((part) => part.startsWith("t="))?.slice(2);
  const signatures = parts
    .filter((part) => part.startsWith("v1="))
    .map((part) => part.slice(3));

  if (!timestamp || signatures.length === 0) return false;
  const timestampNumber = Number(timestamp);
  if (!Number.isFinite(timestampNumber)) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - timestampNumber) > toleranceSeconds) return false;

  const expected = createHmac("sha256", webhookSecret)
    .update(`${timestamp}.${rawBody}`, "utf8")
    .digest("hex");

  return signatures.some((signature) => {
    if (signature.length !== expected.length) return false;
    return timingSafeEqual(Buffer.from(signature, "utf8"), Buffer.from(expected, "utf8"));
  });
}
