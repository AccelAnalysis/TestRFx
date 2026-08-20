import type { PoolClient, QueryResultRow } from "pg";
import type {
  CurrentMembership,
  MembershipActorContext,
  MembershipCapacity,
  MembershipLifecycleStatus,
  MembershipPlanCode,
} from "@/lib/membership/contracts";
import { MembershipServiceError } from "@/lib/membership/contracts";
import { queryMembership, withMembershipTransaction } from "@/lib/membership/db";

type PlanRow = QueryResultRow & {
  id: string;
  code: string;
  public_name: string;
  description: string;
  price_cents: number;
  currency: string;
  billing_interval: string;
  capacity_limit: number | null;
  founding_designation: boolean;
  stripe_product_id: string | null;
  stripe_price_id: string | null;
  stripe_lookup_key: string | null;
};

type ActorRow = QueryResultRow & {
  organization_name: string;
  user_email: string;
};

type MembershipRow = QueryResultRow & {
  id: string;
  organization_id: string;
  code: MembershipPlanCode;
  public_name: string;
  status: MembershipLifecycleStatus;
  selected_at: Date;
  activated_at: Date | null;
  ended_at: Date | null;
  stripe_subscription_id: string | null;
};

export interface BillingIdentity {
  organizationName: string;
  userEmail: string;
}

export interface CapacityReservation {
  reservationId: string;
  membershipId: string;
}

function asIso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

export async function assertMembershipActor(actor: MembershipActorContext): Promise<BillingIdentity> {
  const result = await queryMembership<ActorRow>(
    `SELECT o.name AS organization_name, u.email AS user_email
       FROM organization_memberships om
       JOIN organizations o ON o.id = om.organization_id
       JOIN users u ON u.id = om.user_id
      WHERE om.organization_id = $1 AND om.user_id = $2`,
    [actor.organizationId, actor.userId],
  );
  const row = result.rows[0];
  if (!row) {
    throw new MembershipServiceError(
      "ORGANIZATION_MEMBERSHIP_REQUIRED",
      "The signed-in person is not authorized for the selected organization.",
      403,
    );
  }
  return { organizationName: row.organization_name, userEmail: row.user_email };
}

export async function getPlanRow(code: MembershipPlanCode): Promise<PlanRow> {
  const result = await queryMembership<PlanRow>(
    `SELECT id, code, public_name, description, price_cents, currency, billing_interval,
            capacity_limit, founding_designation, stripe_product_id, stripe_price_id, stripe_lookup_key
       FROM membership_plans
      WHERE code = $1 AND public = true AND retired_at IS NULL`,
    [code],
  );
  const row = result.rows[0];
  if (!row) {
    throw new MembershipServiceError("MEMBERSHIP_PLAN_NOT_CONFIGURED", `Membership plan ${code} is not configured.`, 503);
  }
  return row;
}

export async function syncStripePlan(input: {
  code: MembershipPlanCode;
  productId: string;
  priceId: string;
  lookupKey: string;
  priceCents: number;
  currency: string;
}): Promise<void> {
  await queryMembership(
    `UPDATE membership_plans
        SET stripe_product_id = $2,
            stripe_price_id = $3,
            stripe_lookup_key = $4,
            price_cents = $5,
            currency = $6
      WHERE code = $1`,
    [input.code, input.productId, input.priceId, input.lookupKey, input.priceCents, input.currency.toUpperCase()],
  );
}

async function capacityForPlan(client: PoolClient, plan: PlanRow): Promise<MembershipCapacity> {
  const limit = plan.capacity_limit;
  if (!limit) {
    return { limit: Number.MAX_SAFE_INTEGER, consumed: 0, reserved: 0, remaining: Number.MAX_SAFE_INTEGER, state: "open" };
  }

  await client.query(
    `UPDATE membership_capacity_reservations
        SET status = 'expired'
      WHERE membership_plan_id = $1 AND status = 'reserved' AND expires_at <= now()`,
    [plan.id],
  );

  const counts = await client.query<{ consumed: string; reserved: string }>(
    `SELECT
       (SELECT count(DISTINCT organization_id)::text
          FROM organization_plan_memberships
         WHERE membership_plan_id = $1 AND activated_at IS NOT NULL) AS consumed,
       (SELECT count(*)::text
          FROM membership_capacity_reservations
         WHERE membership_plan_id = $1 AND status = 'reserved' AND expires_at > now()) AS reserved`,
    [plan.id],
  );
  const consumed = Number(counts.rows[0]?.consumed ?? 0);
  const reserved = Number(counts.rows[0]?.reserved ?? 0);
  const remaining = Math.max(0, limit - consumed - reserved);
  return { limit, consumed, reserved, remaining, state: remaining > 0 ? "open" : "full" };
}

export async function getPlanCapacity(code: MembershipPlanCode): Promise<MembershipCapacity> {
  return withMembershipTransaction(async (client) => {
    const planResult = await client.query<PlanRow>(
      `SELECT id, code, public_name, description, price_cents, currency, billing_interval,
              capacity_limit, founding_designation, stripe_product_id, stripe_price_id, stripe_lookup_key
         FROM membership_plans
        WHERE code = $1 AND public = true AND retired_at IS NULL
        FOR SHARE`,
      [code],
    );
    const plan = planResult.rows[0];
    if (!plan) throw new MembershipServiceError("MEMBERSHIP_PLAN_NOT_CONFIGURED", `Membership plan ${code} is not configured.`, 503);
    return capacityForPlan(client, plan);
  });
}

export async function reserveMembershipCapacity(
  actor: MembershipActorContext,
  code: MembershipPlanCode,
  ttlMinutes = 30,
): Promise<CapacityReservation> {
  await assertMembershipActor(actor);

  return withMembershipTransaction(async (client) => {
    const planResult = await client.query<PlanRow>(
      `SELECT id, code, public_name, description, price_cents, currency, billing_interval,
              capacity_limit, founding_designation, stripe_product_id, stripe_price_id, stripe_lookup_key
         FROM membership_plans
        WHERE code = $1 AND public = true AND retired_at IS NULL
        FOR UPDATE`,
      [code],
    );
    const plan = planResult.rows[0];
    if (!plan) throw new MembershipServiceError("MEMBERSHIP_PLAN_NOT_CONFIGURED", `Membership plan ${code} is not configured.`, 503);

    const priorFounder = await client.query<{ exists: boolean }>(
      `SELECT EXISTS(
         SELECT 1 FROM organization_plan_memberships
          WHERE organization_id = $1 AND membership_plan_id = $2 AND activated_at IS NOT NULL
       ) AS exists`,
      [actor.organizationId, plan.id],
    );

    if (!priorFounder.rows[0]?.exists && plan.capacity_limit) {
      const capacity = await capacityForPlan(client, plan);
      const existingReservation = await client.query<{ id: string }>(
        `SELECT id FROM membership_capacity_reservations
          WHERE membership_plan_id = $1 AND organization_id = $2 AND status = 'reserved' AND expires_at > now()`,
        [plan.id, actor.organizationId],
      );
      if (!existingReservation.rows[0] && capacity.remaining <= 0) {
        throw new MembershipServiceError("MEMBERSHIP_CAPACITY_FULL", "Founding Membership capacity has been reached.", 409);
      }
    }

    const membershipResult = await client.query<{ id: string }>(
      `INSERT INTO organization_plan_memberships (
         organization_id, membership_plan_id, status, selected_by_user_id, selected_at, updated_at
       ) VALUES ($1, $2, 'checkout_pending', $3, now(), now())
       ON CONFLICT (organization_id) WHERE status IN ('selected', 'checkout_pending', 'active', 'past_due')
       DO UPDATE SET membership_plan_id = EXCLUDED.membership_plan_id,
                     status = CASE
                       WHEN organization_plan_memberships.status IN ('active', 'past_due') THEN organization_plan_memberships.status
                       ELSE 'checkout_pending'::membership_lifecycle_status
                     END,
                     selected_by_user_id = EXCLUDED.selected_by_user_id,
                     updated_at = now()
       RETURNING id`,
      [actor.organizationId, plan.id, actor.userId],
    );
    const membershipId = membershipResult.rows[0].id;

    const reservationResult = await client.query<{ id: string }>(
      `INSERT INTO membership_capacity_reservations (
         membership_plan_id, organization_id, status, reserved_at, expires_at
       ) VALUES ($1, $2, 'reserved', now(), now() + ($3::text || ' minutes')::interval)
       ON CONFLICT (membership_plan_id, organization_id)
       DO UPDATE SET status = 'reserved', reserved_at = now(), expires_at = EXCLUDED.expires_at
       RETURNING id`,
      [plan.id, actor.organizationId, ttlMinutes],
    );

    await client.query(
      `INSERT INTO membership_lifecycle_events (
         organization_plan_membership_id, event_name, to_status, actor_user_id, payload
       ) VALUES ($1, 'checkout_started', 'checkout_pending', $2, $3::jsonb)`,
      [membershipId, actor.userId, JSON.stringify({ planCode: code })],
    );

    return { reservationId: reservationResult.rows[0].id, membershipId };
  });
}

export async function attachCheckoutSession(input: {
  membershipId: string;
  reservationId: string;
  checkoutSessionId: string;
}): Promise<void> {
  await withMembershipTransaction(async (client) => {
    await client.query(
      `UPDATE organization_plan_memberships
          SET stripe_checkout_session_id = $2, updated_at = now()
        WHERE id = $1`,
      [input.membershipId, input.checkoutSessionId],
    );
    await client.query(
      `UPDATE membership_capacity_reservations
          SET stripe_checkout_session_id = $2
        WHERE id = $1`,
      [input.reservationId, input.checkoutSessionId],
    );
  });
}

export async function getBillingCustomerId(organizationId: string): Promise<string | null> {
  const result = await queryMembership<{ stripe_customer_id: string | null }>(
    `SELECT stripe_customer_id FROM billing_accounts WHERE organization_id = $1`,
    [organizationId],
  );
  return result.rows[0]?.stripe_customer_id ?? null;
}

export async function saveBillingCustomer(input: {
  organizationId: string;
  stripeCustomerId: string;
  billingEmail: string;
}): Promise<void> {
  await queryMembership(
    `INSERT INTO billing_accounts (organization_id, stripe_customer_id, billing_email, created_at, updated_at)
     VALUES ($1, $2, $3, now(), now())
     ON CONFLICT (organization_id)
     DO UPDATE SET stripe_customer_id = EXCLUDED.stripe_customer_id,
                   billing_email = EXCLUDED.billing_email,
                   updated_at = now()`,
    [input.organizationId, input.stripeCustomerId, input.billingEmail],
  );
}

export async function bindCheckoutToSubscription(input: {
  organizationId: string;
  checkoutSessionId: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  externalEventId?: string;
}): Promise<void> {
  await withMembershipTransaction(async (client) => {
    if (input.stripeCustomerId) {
      await client.query(
        `INSERT INTO billing_accounts (organization_id, stripe_customer_id, created_at, updated_at)
         VALUES ($1, $2, now(), now())
         ON CONFLICT (organization_id)
         DO UPDATE SET stripe_customer_id = EXCLUDED.stripe_customer_id, updated_at = now()`,
        [input.organizationId, input.stripeCustomerId],
      );
    }

    const updated = await client.query<{ id: string }>(
      `UPDATE organization_plan_memberships
          SET stripe_subscription_id = COALESCE($3, stripe_subscription_id),
              stripe_checkout_session_id = $2,
              status = CASE WHEN status = 'selected' THEN 'checkout_pending'::membership_lifecycle_status ELSE status END,
              updated_at = now()
        WHERE organization_id = $1 AND status IN ('selected', 'checkout_pending', 'active', 'past_due')
        RETURNING id`,
      [input.organizationId, input.checkoutSessionId, input.stripeSubscriptionId],
    );
    const membershipId = updated.rows[0]?.id;
    if (!membershipId) return;

    await client.query(
      `INSERT INTO membership_lifecycle_events (
         organization_plan_membership_id, event_name, to_status, external_event_id, payload
       ) VALUES ($1, 'checkout_completed', 'checkout_pending', $2, $3::jsonb)`,
      [membershipId, input.externalEventId ?? null, JSON.stringify({ checkoutSessionId: input.checkoutSessionId })],
    );
  });
}

export async function applySubscriptionStatus(input: {
  stripeSubscriptionId: string;
  status: MembershipLifecycleStatus;
  eventName: string;
  externalEventId?: string;
  activate?: boolean;
  payload?: unknown;
}): Promise<void> {
  await withMembershipTransaction(async (client) => {
    const current = await client.query<{ id: string; status: MembershipLifecycleStatus }>(
      `SELECT id, status FROM organization_plan_memberships WHERE stripe_subscription_id = $1 FOR UPDATE`,
      [input.stripeSubscriptionId],
    );
    const row = current.rows[0];
    if (!row) return;

    await client.query(
      `UPDATE organization_plan_memberships
          SET status = $2,
              activated_at = CASE WHEN $3 THEN COALESCE(activated_at, now()) ELSE activated_at END,
              ended_at = CASE WHEN $2 IN ('cancelled', 'ended') THEN COALESCE(ended_at, now()) ELSE ended_at END,
              updated_at = now()
        WHERE id = $1`,
      [row.id, input.status, Boolean(input.activate)],
    );

    if (input.activate) {
      await client.query(
        `UPDATE membership_capacity_reservations
            SET status = 'converted', converted_membership_id = $2
          WHERE organization_id = (SELECT organization_id FROM organization_plan_memberships WHERE id = $2)
            AND status = 'reserved'`,
        [input.stripeSubscriptionId, row.id],
      ).catch(() => undefined);
      // The converted update above intentionally depends only on the membership id; retry with the portable form below.
      await client.query(
        `UPDATE membership_capacity_reservations
            SET status = 'converted', converted_membership_id = $1
          WHERE organization_id = (SELECT organization_id FROM organization_plan_memberships WHERE id = $1)
            AND membership_plan_id = (SELECT membership_plan_id FROM organization_plan_memberships WHERE id = $1)
            AND status = 'reserved'`,
        [row.id],
      );
    }

    await client.query(
      `INSERT INTO membership_lifecycle_events (
         organization_plan_membership_id, event_name, from_status, to_status, external_event_id, payload
       ) VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
      [row.id, input.eventName, row.status, input.status, input.externalEventId ?? null, JSON.stringify(input.payload ?? {})],
    );
  });
}

export async function getCurrentMembership(organizationId: string): Promise<CurrentMembership | null> {
  const result = await queryMembership<MembershipRow>(
    `SELECT opm.id, opm.organization_id, mp.code, mp.public_name, opm.status,
            opm.selected_at, opm.activated_at, opm.ended_at, opm.stripe_subscription_id
       FROM organization_plan_memberships opm
       JOIN membership_plans mp ON mp.id = opm.membership_plan_id
      WHERE opm.organization_id = $1
      ORDER BY opm.selected_at DESC
      LIMIT 1`,
    [organizationId],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    id: row.id,
    organizationId: row.organization_id,
    planCode: row.code,
    planName: row.public_name,
    status: row.status,
    selectedAt: row.selected_at.toISOString(),
    activatedAt: asIso(row.activated_at),
    endedAt: asIso(row.ended_at),
    stripeSubscriptionId: row.stripe_subscription_id,
  };
}

export async function getCreditLedger(organizationId: string) {
  const result = await queryMembership<{
    id: string;
    entry_type: string;
    credits: string;
    usd_value_per_credit: string;
    source_reference: string | null;
    expires_at: Date | null;
    occurred_at: Date;
  }>(
    `SELECT id::text, entry_type, credits::text, usd_value_per_credit::text, source_reference, expires_at, occurred_at
       FROM credit_ledger_entries
      WHERE organization_id = $1
      ORDER BY occurred_at DESC`,
    [organizationId],
  );
  const entries = result.rows.map((row) => ({
    id: row.id,
    type: row.entry_type,
    credits: Number(row.credits),
    usdValuePerCredit: Number(row.usd_value_per_credit),
    sourceReference: row.source_reference,
    expiresAt: asIso(row.expires_at),
    occurredAt: row.occurred_at.toISOString(),
  }));
  const balance = entries.reduce((total, entry) => {
    const signed = ["consumed", "expired"].includes(entry.type) ? -Math.abs(entry.credits) : entry.credits;
    return total + signed;
  }, 0);
  return { balance, entries };
}

export async function getInvoices(organizationId: string) {
  const result = await queryMembership<{
    id: string;
    stripe_invoice_id: string;
    status: string;
    amount_due_cents: number;
    amount_paid_cents: number;
    currency: string;
    invoice_pdf_url: string | null;
    issued_at: Date | null;
    paid_at: Date | null;
    created_at: Date;
  }>(
    `SELECT id, stripe_invoice_id, status, amount_due_cents, amount_paid_cents, currency,
            invoice_pdf_url, issued_at, paid_at, created_at
       FROM billing_invoices
      WHERE organization_id = $1
      ORDER BY created_at DESC`,
    [organizationId],
  );
  return result.rows.map((row) => ({
    id: row.id,
    stripeInvoiceId: row.stripe_invoice_id,
    status: row.status,
    amountDueCents: row.amount_due_cents,
    amountPaidCents: row.amount_paid_cents,
    currency: row.currency,
    invoicePdfUrl: row.invoice_pdf_url,
    issuedAt: asIso(row.issued_at),
    paidAt: asIso(row.paid_at),
    createdAt: row.created_at.toISOString(),
  }));
}

export async function getInvoicePdfForOrganization(organizationId: string, invoiceId: string): Promise<string | null> {
  const result = await queryMembership<{ invoice_pdf_url: string | null }>(
    `SELECT invoice_pdf_url FROM billing_invoices WHERE organization_id = $1 AND id = $2`,
    [organizationId, invoiceId],
  );
  return result.rows[0]?.invoice_pdf_url ?? null;
}

export async function getPayments(organizationId: string) {
  const result = await queryMembership<{
    id: string;
    stripe_invoice_id: string | null;
    stripe_payment_intent_id: string | null;
    status: string;
    amount_cents: number;
    currency: string;
    occurred_at: Date;
  }>(
    `SELECT id, stripe_invoice_id, stripe_payment_intent_id, status, amount_cents, currency, occurred_at
       FROM billing_payments
      WHERE organization_id = $1
      ORDER BY occurred_at DESC`,
    [organizationId],
  );
  return result.rows.map((row) => ({
    id: row.id,
    stripeInvoiceId: row.stripe_invoice_id,
    stripePaymentIntentId: row.stripe_payment_intent_id,
    status: row.status,
    amountCents: row.amount_cents,
    currency: row.currency,
    occurredAt: row.occurred_at.toISOString(),
  }));
}

export async function getLifecycle(organizationId: string) {
  const result = await queryMembership<{
    id: string;
    event_name: string;
    from_status: MembershipLifecycleStatus | null;
    to_status: MembershipLifecycleStatus | null;
    occurred_at: Date;
    payload: unknown;
  }>(
    `SELECT mle.id::text, mle.event_name, mle.from_status, mle.to_status, mle.occurred_at, mle.payload
       FROM membership_lifecycle_events mle
       JOIN organization_plan_memberships opm ON opm.id = mle.organization_plan_membership_id
      WHERE opm.organization_id = $1
      ORDER BY mle.occurred_at DESC`,
    [organizationId],
  );
  return result.rows.map((row) => ({
    id: row.id,
    eventName: row.event_name,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    occurredAt: row.occurred_at.toISOString(),
    payload: row.payload,
  }));
}

export async function upsertInvoice(input: {
  organizationId: string;
  stripeInvoiceId: string;
  status: string;
  amountDueCents: number;
  amountPaidCents: number;
  currency: string;
  invoicePdfUrl: string | null;
  issuedAt: Date | null;
  paidAt: Date | null;
}): Promise<void> {
  await queryMembership(
    `INSERT INTO billing_invoices (
       organization_id, stripe_invoice_id, status, amount_due_cents, amount_paid_cents,
       currency, invoice_pdf_url, issued_at, paid_at, created_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,now())
     ON CONFLICT (stripe_invoice_id)
     DO UPDATE SET status = EXCLUDED.status,
                   amount_due_cents = EXCLUDED.amount_due_cents,
                   amount_paid_cents = EXCLUDED.amount_paid_cents,
                   currency = EXCLUDED.currency,
                   invoice_pdf_url = EXCLUDED.invoice_pdf_url,
                   issued_at = EXCLUDED.issued_at,
                   paid_at = EXCLUDED.paid_at`,
    [
      input.organizationId,
      input.stripeInvoiceId,
      input.status,
      input.amountDueCents,
      input.amountPaidCents,
      input.currency.toUpperCase(),
      input.invoicePdfUrl,
      input.issuedAt,
      input.paidAt,
    ],
  );
}

export async function recordInvoicePayment(input: {
  organizationId: string;
  stripeInvoiceId: string;
  status: string;
  amountCents: number;
  currency: string;
}): Promise<void> {
  await queryMembership(
    `INSERT INTO billing_payments (
       organization_id, stripe_invoice_id, status, amount_cents, currency, occurred_at
     ) VALUES ($1,$2,$3,$4,$5,now())
     ON CONFLICT (stripe_invoice_id)
     DO UPDATE SET status = EXCLUDED.status,
                   amount_cents = EXCLUDED.amount_cents,
                   currency = EXCLUDED.currency,
                   occurred_at = now()`,
    [input.organizationId, input.stripeInvoiceId, input.status, input.amountCents, input.currency.toUpperCase()],
  );
}

export async function beginStripeWebhook(eventId: string, eventType: string): Promise<boolean> {
  const result = await queryMembership<{ status: string }>(
    `INSERT INTO stripe_webhook_events (stripe_event_id, event_type, status, first_seen_at, last_attempt_at)
     VALUES ($1,$2,'processing',now(),now())
     ON CONFLICT (stripe_event_id)
     DO UPDATE SET status = CASE WHEN stripe_webhook_events.status = 'completed' THEN 'completed' ELSE 'processing' END,
                   last_attempt_at = now()
     RETURNING status`,
    [eventId, eventType],
  );
  return result.rows[0]?.status !== "completed";
}

export async function finishStripeWebhook(eventId: string, error?: unknown): Promise<void> {
  await queryMembership(
    `UPDATE stripe_webhook_events
        SET status = $2,
            completed_at = CASE WHEN $2 = 'completed' THEN now() ELSE completed_at END,
            last_error = $3
      WHERE stripe_event_id = $1`,
    [eventId, error ? "failed" : "completed", error ? String(error) : null],
  );
}
