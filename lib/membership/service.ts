import type Stripe from "stripe";
import { creditPolicy } from "@/lib/membership/catalog";
import {
  MembershipServiceError,
  type MembershipActorContext,
  type MembershipCatalogSnapshot,
  type MembershipPlan,
  type MembershipPlanCode,
} from "@/lib/membership/contracts";
import {
  applySubscriptionStatus,
  assertMembershipActor,
  attachCheckoutSession,
  beginStripeWebhook,
  bindCheckoutToSubscription,
  finishStripeWebhook,
  getCreditLedger,
  getCurrentMembership,
  getInvoicePdfForOrganization,
  getInvoices,
  getLifecycle,
  getPayments,
  getPlanCapacity,
  getPlanRow,
  recordInvoicePayment,
  reserveMembershipCapacity,
  syncStripePlan,
  upsertInvoice,
} from "@/lib/membership/repository";
import {
  constructStripeWebhook,
  createBillingPortalSession,
  createSubscriptionCheckout,
  getStripeMembershipOffer,
  retrieveCheckoutSession,
  retrieveSubscription,
} from "@/lib/membership/stripe";

function objectId(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

function dateFromUnix(value: number | null | undefined): Date | null {
  return value ? new Date(value * 1000) : null;
}

function subscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  const record = invoice as unknown as Record<string, unknown>;
  const direct = record.subscription;
  if (typeof direct === "string") return direct;
  if (direct && typeof direct === "object" && "id" in direct) return String((direct as { id: unknown }).id);

  const parent = record.parent;
  if (parent && typeof parent === "object") {
    const details = (parent as Record<string, unknown>).subscription_details;
    if (details && typeof details === "object") {
      const subscription = (details as Record<string, unknown>).subscription;
      if (typeof subscription === "string") return subscription;
      if (subscription && typeof subscription === "object" && "id" in subscription) {
        return String((subscription as { id: unknown }).id);
      }
    }
  }
  return null;
}

function paymentIntentIdFromInvoice(invoice: Stripe.Invoice): string | null {
  const record = invoice as unknown as Record<string, unknown>;
  const paymentIntent = record.payment_intent;
  if (typeof paymentIntent === "string") return paymentIntent;
  if (paymentIntent && typeof paymentIntent === "object" && "id" in paymentIntent) {
    return String((paymentIntent as { id: unknown }).id);
  }
  return null;
}

async function planFromServices(code: MembershipPlanCode): Promise<MembershipPlan> {
  const [dbPlan, stripeOffer] = await Promise.all([getPlanRow(code), getStripeMembershipOffer(code)]);
  await syncStripePlan({
    code,
    productId: stripeOffer.productId,
    priceId: stripeOffer.priceId,
    lookupKey: stripeOffer.lookupKey,
    priceCents: stripeOffer.priceCents,
    currency: stripeOffer.currency,
  });
  const capacity = await getPlanCapacity(code);
  return {
    code,
    name: dbPlan.public_name,
    description: dbPlan.description,
    price: { currency: "USD", cents: stripeOffer.priceCents },
    billingInterval: "month",
    organizationLevel: true,
    capacity,
    foundingDesignation: dbPlan.founding_designation,
    stripeLookupKey: stripeOffer.lookupKey,
  };
}

export async function getPublicMembershipCatalog(): Promise<MembershipCatalogSnapshot> {
  const founding = await planFromServices("founding");
  return {
    plans: [founding],
    creditPolicy,
    generatedAt: new Date().toISOString(),
    source: "stripe+postgres",
  };
}

export async function beginMembershipCheckout(input: {
  actor: MembershipActorContext;
  planCode: MembershipPlanCode;
  origin: string;
}) {
  await assertMembershipActor(input.actor);
  const stripeOffer = await getStripeMembershipOffer(input.planCode);
  await syncStripePlan({
    code: input.planCode,
    productId: stripeOffer.productId,
    priceId: stripeOffer.priceId,
    lookupKey: stripeOffer.lookupKey,
    priceCents: stripeOffer.priceCents,
    currency: stripeOffer.currency,
  });
  const reservation = await reserveMembershipCapacity(input.actor, input.planCode);
  const session = await createSubscriptionCheckout({
    actor: input.actor,
    planCode: input.planCode,
    priceId: stripeOffer.priceId,
    reservationId: reservation.reservationId,
    membershipId: reservation.membershipId,
    origin: input.origin,
  });
  if (!session.url) {
    throw new MembershipServiceError("STRIPE_CHECKOUT_URL_MISSING", "Stripe did not return a checkout URL.", 502);
  }
  await attachCheckoutSession({
    membershipId: reservation.membershipId,
    reservationId: reservation.reservationId,
    checkoutSessionId: session.id,
  });
  return { checkoutSessionId: session.id, url: session.url };
}

export async function openMembershipPortal(input: {
  actor: MembershipActorContext;
  returnUrl: string;
}) {
  const session = await createBillingPortalSession(input);
  return { url: session.url };
}

export async function readMembershipAccountSection(actor: MembershipActorContext, section: string) {
  await assertMembershipActor(actor);
  switch (section) {
    case "current":
      return { currentPlan: await getCurrentMembership(actor.organizationId) };
    case "credits":
      return getCreditLedger(actor.organizationId);
    case "invoices":
      return { invoices: await getInvoices(actor.organizationId) };
    case "payments":
      return { payments: await getPayments(actor.organizationId) };
    case "lifecycle":
      return { events: await getLifecycle(actor.organizationId) };
    default:
      throw new MembershipServiceError("MEMBERSHIP_SECTION_NOT_FOUND", "Unknown membership account section.", 404);
  }
}

export async function resolveInvoicePdf(actor: MembershipActorContext, invoiceId: string): Promise<string> {
  await assertMembershipActor(actor);
  const url = await getInvoicePdfForOrganization(actor.organizationId, invoiceId);
  if (!url) throw new MembershipServiceError("INVOICE_PDF_NOT_FOUND", "Invoice PDF is not available.", 404);
  return url;
}

export async function reviewPlanChange(actor: MembershipActorContext, targetPlanCode: MembershipPlanCode) {
  await assertMembershipActor(actor);
  const [current, catalog] = await Promise.all([
    getCurrentMembership(actor.organizationId),
    getPublicMembershipCatalog(),
  ]);
  const target = catalog.plans.find((plan) => plan.code === targetPlanCode);
  if (!target) throw new MembershipServiceError("MEMBERSHIP_PLAN_NOT_FOUND", "The selected plan is not available.", 404);
  if (current?.planCode === targetPlanCode) {
    throw new MembershipServiceError("MEMBERSHIP_PLAN_UNCHANGED", "The organization is already on this plan.", 409);
  }
  return { current, target };
}

export async function confirmPlanChange(actor: MembershipActorContext, targetPlanCode: MembershipPlanCode) {
  const review = await reviewPlanChange(actor, targetPlanCode);
  // With only the source-defined Founding plan currently configured, any legitimate
  // alternate plan must first exist in the live catalog. Never fabricate one here.
  throw new MembershipServiceError(
    "NO_ALTERNATE_MEMBERSHIP_PLAN",
    `No alternate membership plan is currently available to replace ${review.current?.planName ?? "the current plan"}.`,
    409,
  );
}

export async function verifyCheckoutReturn(actor: MembershipActorContext, sessionId: string) {
  await assertMembershipActor(actor);
  const session = await retrieveCheckoutSession(sessionId);
  if (session.client_reference_id !== actor.organizationId) {
    throw new MembershipServiceError("CHECKOUT_ORGANIZATION_MISMATCH", "This checkout session belongs to another organization.", 403);
  }
  const subscriptionId = objectId(session.subscription);
  const customerId = objectId(session.customer);
  await bindCheckoutToSubscription({
    organizationId: actor.organizationId,
    checkoutSessionId: session.id,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId,
  });

  if (session.payment_status === "paid" && subscriptionId) {
    await applySubscriptionStatus({
      stripeSubscriptionId: subscriptionId,
      status: "active",
      eventName: "checkout_return_verified",
      activate: true,
      payload: { checkoutSessionId: session.id },
    });
  }

  return {
    checkoutSessionId: session.id,
    paymentStatus: session.payment_status,
    membership: await getCurrentMembership(actor.organizationId),
  };
}

async function handleCheckoutCompleted(event: Stripe.Event, session: Stripe.Checkout.Session) {
  const organizationId = session.metadata?.rfxchange_organization_id ?? session.client_reference_id;
  if (!organizationId) return;
  await bindCheckoutToSubscription({
    organizationId,
    checkoutSessionId: session.id,
    stripeCustomerId: objectId(session.customer),
    stripeSubscriptionId: objectId(session.subscription),
    externalEventId: event.id,
  });
}

async function handleInvoice(event: Stripe.Event, invoice: Stripe.Invoice, paid: boolean) {
  const subscriptionId = subscriptionIdFromInvoice(invoice);
  if (!subscriptionId) return;
  const subscription = await retrieveSubscription(subscriptionId);
  const organizationId = subscription.metadata?.rfxchange_organization_id;
  if (!organizationId) return;

  await upsertInvoice({
    organizationId,
    stripeInvoiceId: invoice.id,
    status: invoice.status ?? (paid ? "paid" : "open"),
    amountDueCents: invoice.amount_due,
    amountPaidCents: invoice.amount_paid,
    currency: invoice.currency,
    invoicePdfUrl: invoice.invoice_pdf ?? null,
    issuedAt: dateFromUnix(invoice.created),
    paidAt: dateFromUnix(invoice.status_transitions?.paid_at),
  });

  if (paid) {
    await recordInvoicePayment({
      organizationId,
      stripeInvoiceId: invoice.id,
      status: "succeeded",
      amountCents: invoice.amount_paid,
      currency: invoice.currency,
    });
    await applySubscriptionStatus({
      stripeSubscriptionId: subscriptionId,
      status: "active",
      eventName: "invoice_paid",
      externalEventId: event.id,
      activate: true,
      payload: { invoiceId: invoice.id, paymentIntentId: paymentIntentIdFromInvoice(invoice) },
    });
  } else {
    await applySubscriptionStatus({
      stripeSubscriptionId: subscriptionId,
      status: "past_due",
      eventName: "invoice_payment_failed",
      externalEventId: event.id,
      payload: { invoiceId: invoice.id },
    });
  }
}

async function handleSubscriptionUpdate(event: Stripe.Event, subscription: Stripe.Subscription) {
  if (subscription.status === "past_due" || subscription.status === "unpaid") {
    await applySubscriptionStatus({
      stripeSubscriptionId: subscription.id,
      status: "past_due",
      eventName: "subscription_payment_state_changed",
      externalEventId: event.id,
      payload: { stripeStatus: subscription.status },
    });
  }
  if (subscription.status === "canceled") {
    await applySubscriptionStatus({
      stripeSubscriptionId: subscription.id,
      status: "cancelled",
      eventName: "subscription_cancelled",
      externalEventId: event.id,
      payload: { stripeStatus: subscription.status },
    });
  }
}

export async function reconcileStripeWebhook(payload: string, signature: string) {
  const event = constructStripeWebhook(payload, signature);
  const shouldProcess = await beginStripeWebhook(event.id, event.type);
  if (!shouldProcess) return { eventId: event.id, duplicate: true };

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event, event.data.object as Stripe.Checkout.Session);
        break;
      case "invoice.paid":
        await handleInvoice(event, event.data.object as Stripe.Invoice, true);
        break;
      case "invoice.payment_failed":
        await handleInvoice(event, event.data.object as Stripe.Invoice, false);
        break;
      case "customer.subscription.updated":
        await handleSubscriptionUpdate(event, event.data.object as Stripe.Subscription);
        break;
      case "customer.subscription.deleted":
        await applySubscriptionStatus({
          stripeSubscriptionId: (event.data.object as Stripe.Subscription).id,
          status: "cancelled",
          eventName: "subscription_deleted",
          externalEventId: event.id,
        });
        break;
      default:
        break;
    }
    await finishStripeWebhook(event.id);
    return { eventId: event.id, duplicate: false };
  } catch (error) {
    await finishStripeWebhook(event.id, error);
    throw error;
  }
}
