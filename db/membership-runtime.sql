-- Runtime upgrade for the RFxchange Pricing / Membership domain.
-- Apply after db/schema.sql and db/membership.sql.
-- This migration connects the organization-level membership model to Stripe Billing
-- without making Stripe the RFxchange entitlement source of truth.

ALTER TABLE membership_plans
  ADD COLUMN IF NOT EXISTS stripe_lookup_key text;

UPDATE membership_plans
   SET stripe_lookup_key = COALESCE(stripe_lookup_key, 'rfxchange_founding_monthly')
 WHERE code = 'founding';

CREATE UNIQUE INDEX IF NOT EXISTS membership_plans_stripe_lookup_key_idx
  ON membership_plans(stripe_lookup_key)
  WHERE stripe_lookup_key IS NOT NULL;

ALTER TABLE organization_plan_memberships
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id text;
CREATE UNIQUE INDEX IF NOT EXISTS organization_plan_memberships_checkout_idx
  ON organization_plan_memberships(stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;

ALTER TABLE membership_capacity_reservations
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id text;
CREATE UNIQUE INDEX IF NOT EXISTS membership_capacity_reservations_checkout_idx
  ON membership_capacity_reservations(stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;

ALTER TABLE billing_payments
  ADD COLUMN IF NOT EXISTS stripe_invoice_id text;
CREATE UNIQUE INDEX IF NOT EXISTS billing_payments_invoice_idx
  ON billing_payments(stripe_invoice_id)
  WHERE stripe_invoice_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  stripe_event_id text PRIMARY KEY,
  event_type text NOT NULL,
  status text NOT NULL CHECK (status IN ('processing', 'completed', 'failed')),
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_attempt_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  last_error text
);

CREATE INDEX IF NOT EXISTS stripe_webhook_events_status_idx
  ON stripe_webhook_events(status, last_attempt_at DESC);

-- Capacity correctness: reservations serialize on the locked membership plan row in
-- the application transaction. Historical activated organizations count toward the
-- Founding cap even if they later cancel, preserving "first 250 organizations".
CREATE INDEX IF NOT EXISTS organization_plan_memberships_founder_capacity_idx
  ON organization_plan_memberships(membership_plan_id, organization_id)
  WHERE activated_at IS NOT NULL;
