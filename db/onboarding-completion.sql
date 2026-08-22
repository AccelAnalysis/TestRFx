-- RFxchange Identity & Onboarding: Exchange-ready completion runtime.
-- Apply after db/schema.sql, db/identity-verification.sql, db/geography-extension.sql,
-- db/organization-profile.sql, db/capability-enrichment.sql, db/membership.sql, and db/membership-runtime.sql.
--
-- Readiness is derived from canonical domain records; this table records only the
-- controlled activation handoff and its audit snapshot. It is not a second source of
-- truth for identity, organization authority, geography, capabilities, or membership.

CREATE TABLE IF NOT EXISTS onboarding_exchange_activations (
  organization_id uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  activated_by_user_id uuid NOT NULL REFERENCES users(id),
  status text NOT NULL CHECK (status IN ('exchange_active')),
  destination text NOT NULL,
  readiness_snapshot jsonb NOT NULL,
  activated_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS onboarding_exchange_activations_activated_idx
  ON onboarding_exchange_activations(activated_at DESC);

COMMENT ON TABLE onboarding_exchange_activations IS
  'Audit record for the Step 9 -> Step 10 Exchange-ready handoff. Readiness is re-derived from canonical domain records before every activation.';
