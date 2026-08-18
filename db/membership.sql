-- RFxchange pricing / membership persistence extension.
-- Apply after db/schema.sql. PostgreSQL is the canonical target; Stripe processes payments,
-- while RFxchange remains the source of truth for organization membership and entitlements.

CREATE TYPE membership_lifecycle_status AS ENUM (
  'selected',
  'checkout_pending',
  'active',
  'past_due',
  'cancelled',
  'ended'
);

CREATE TABLE membership_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  public_name text NOT NULL,
  description text NOT NULL,
  price_cents integer NOT NULL CHECK (price_cents >= 0),
  currency text NOT NULL DEFAULT 'USD',
  billing_interval text NOT NULL CHECK (billing_interval IN ('month')),
  organization_level boolean NOT NULL DEFAULT true,
  public boolean NOT NULL DEFAULT true,
  capacity_limit integer CHECK (capacity_limit IS NULL OR capacity_limit > 0),
  founding_designation boolean NOT NULL DEFAULT false,
  stripe_product_id text,
  stripe_price_id text,
  entitlement_bundle jsonb NOT NULL DEFAULT '[]'::jsonb,
  effective_at timestamptz NOT NULL DEFAULT now(),
  retired_at timestamptz
);

INSERT INTO membership_plans (
  code,
  public_name,
  description,
  price_cents,
  billing_interval,
  capacity_limit,
  founding_designation
) VALUES (
  'founding',
  'Founding Membership',
  'Organization-level RFxchange membership for the first 250 participating organizations.',
  4900,
  'month',
  250,
  true
) ON CONFLICT (code) DO NOTHING;

CREATE TABLE organization_plan_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  membership_plan_id uuid NOT NULL REFERENCES membership_plans(id),
  status membership_lifecycle_status NOT NULL DEFAULT 'selected',
  selected_by_user_id uuid REFERENCES users(id),
  selected_at timestamptz NOT NULL DEFAULT now(),
  activated_at timestamptz,
  ended_at timestamptz,
  stripe_subscription_id text UNIQUE,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX organization_one_current_plan_idx
  ON organization_plan_memberships(organization_id)
  WHERE status IN ('selected', 'checkout_pending', 'active', 'past_due');

CREATE TABLE membership_lifecycle_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_plan_membership_id uuid NOT NULL REFERENCES organization_plan_memberships(id) ON DELETE CASCADE,
  event_name text NOT NULL,
  from_status membership_lifecycle_status,
  to_status membership_lifecycle_status,
  actor_user_id uuid REFERENCES users(id),
  external_event_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX membership_lifecycle_events_membership_idx
  ON membership_lifecycle_events(organization_plan_membership_id, occurred_at DESC);

CREATE TABLE membership_capacity_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_plan_id uuid NOT NULL REFERENCES membership_plans(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('reserved', 'converted', 'released', 'expired')),
  reserved_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  converted_membership_id uuid REFERENCES organization_plan_memberships(id),
  UNIQUE (membership_plan_id, organization_id)
);
CREATE INDEX membership_capacity_reservations_active_idx
  ON membership_capacity_reservations(membership_plan_id, status, expires_at);

CREATE TABLE billing_accounts (
  organization_id uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  stripe_customer_id text UNIQUE,
  billing_email text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE billing_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  stripe_invoice_id text NOT NULL UNIQUE,
  status text NOT NULL,
  amount_due_cents integer NOT NULL DEFAULT 0,
  amount_paid_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  invoice_pdf_url text,
  issued_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX billing_invoices_org_idx ON billing_invoices(organization_id, created_at DESC);

CREATE TABLE billing_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  billing_invoice_id uuid REFERENCES billing_invoices(id) ON DELETE SET NULL,
  stripe_payment_intent_id text UNIQUE,
  status text NOT NULL,
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  currency text NOT NULL DEFAULT 'USD',
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX billing_payments_org_idx ON billing_payments(organization_id, occurred_at DESC);

CREATE TABLE credit_accounts (
  organization_id uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE credit_ledger_entries (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES credit_accounts(organization_id) ON DELETE CASCADE,
  entry_type text NOT NULL CHECK (entry_type IN ('issued', 'consumed', 'adjusted', 'reversed', 'expired')),
  credits numeric(12,2) NOT NULL,
  usd_value_per_credit numeric(12,2) NOT NULL DEFAULT 1.00,
  source_reference text,
  expires_at timestamptz,
  related_entry_id bigint REFERENCES credit_ledger_entries(id),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX credit_ledger_entries_org_idx ON credit_ledger_entries(organization_id, occurred_at DESC);
CREATE INDEX credit_ledger_entries_expiration_idx ON credit_ledger_entries(expires_at) WHERE expires_at IS NOT NULL;
