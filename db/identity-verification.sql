-- RFxchange Identity & Onboarding Shell: Account Verification persistence extension.
-- Apply after db/schema.sql. This makes email verification durable and one-time in production.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'pending_verification';

CREATE UNIQUE INDEX IF NOT EXISTS users_email_normalized_uidx
  ON users (lower(btrim(email)));

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'email_verification_challenge_state') THEN
    CREATE TYPE email_verification_challenge_state AS ENUM (
      'issued',
      'consumed',
      'expired',
      'revoked',
      'superseded'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS email_verification_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email text NOT NULL,
  token_hash bytea NOT NULL UNIQUE,
  state email_verification_challenge_state NOT NULL DEFAULT 'issued',
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  revoked_at timestamptz,
  superseded_by uuid REFERENCES email_verification_challenges(id),
  request_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  request_ip inet,
  request_user_agent text,
  CHECK (expires_at > issued_at)
);

CREATE INDEX IF NOT EXISTS email_verification_challenges_user_state_idx
  ON email_verification_challenges(user_id, state, issued_at DESC);

CREATE INDEX IF NOT EXISTS email_verification_challenges_expiry_idx
  ON email_verification_challenges(expires_at)
  WHERE state = 'issued';

COMMENT ON TABLE email_verification_challenges IS
  'One-time account email verification challenges. Raw tokens must never be persisted; store only a cryptographic hash.';

COMMENT ON COLUMN users.email_verified_at IS
  'Identity proof only. Does not grant organization membership, geography, capability truth, membership/payment, or Exchange readiness.';
