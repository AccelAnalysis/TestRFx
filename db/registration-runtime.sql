-- RFxchange Identity & Onboarding Shell: Registration runtime persistence.
-- Apply after db/schema.sql and db/identity-verification.sql.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'registration_transaction_state') THEN
    CREATE TYPE registration_transaction_state AS ENUM (
      'pending_verification',
      'verified',
      'existing_account',
      'abandoned',
      'blocked'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS registration_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email text NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  state registration_transaction_state NOT NULL DEFAULT 'pending_verification',
  entry_kind text NOT NULL,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS registration_transactions_active_user_uidx
  ON registration_transactions(user_id)
  WHERE state = 'pending_verification';
CREATE INDEX IF NOT EXISTS registration_transactions_email_idx
  ON registration_transactions(lower(btrim(email)), created_at DESC);

CREATE TABLE IF NOT EXISTS registration_attributions (
  registration_id uuid PRIMARY KEY REFERENCES registration_transactions(id) ON DELETE CASCADE,
  source text,
  campaign text,
  referral text,
  invitation text,
  organization_intent text,
  membership_intent text,
  geography_intent text,
  record_intent text,
  return_to text,
  captured_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS identity_policy_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  registration_id uuid REFERENCES registration_transactions(id) ON DELETE SET NULL,
  policy_kind text NOT NULL CHECK (policy_kind IN ('terms', 'privacy')),
  policy_version text NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  request_ip inet,
  request_user_agent text,
  UNIQUE(user_id, policy_kind, policy_version)
);

CREATE TABLE IF NOT EXISTS identity_marketing_consents (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  registration_id uuid REFERENCES registration_transactions(id) ON DELETE SET NULL,
  consented boolean NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE email_verification_challenges
  ADD COLUMN IF NOT EXISTS registration_id uuid REFERENCES registration_transactions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS email_verification_challenges_registration_idx
  ON email_verification_challenges(registration_id, state, issued_at DESC);

CREATE TABLE IF NOT EXISTS identity_email_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid REFERENCES email_verification_challenges(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  registration_id uuid REFERENCES registration_transactions(id) ON DELETE SET NULL,
  recipient_email text NOT NULL,
  message_type text NOT NULL,
  delivery_state text NOT NULL CHECK (delivery_state IN ('sent', 'failed')),
  detail text,
  attempted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS identity_email_deliveries_registration_idx
  ON identity_email_deliveries(registration_id, attempted_at DESC);

COMMENT ON TABLE registration_transactions IS
  'Durable person-level registration transactions. Organization, geography, capability, membership, and Exchange authorization remain downstream onboarding truth.';
COMMENT ON TABLE registration_attributions IS
  'Acquisition and deep-link intent preserved from Public shell entry; these values never grant organization authority or Exchange permissions.';
COMMENT ON TABLE identity_policy_acceptances IS
  'Versioned acceptance evidence for the policy text presented at account creation.';
COMMENT ON TABLE identity_email_deliveries IS
  'Transactional identity-email delivery audit; no delivery is treated as successful unless the configured transport returns success.';
