-- RFxchange Identity & Onboarding Shell: durable Account Verification target.
-- Apply after db/schema.sql. The server runtime uses the same lifecycle contract;
-- PostgreSQL is the multi-instance production persistence target.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS registration_id text,
  ADD COLUMN IF NOT EXISTS email_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'pending_verification';

CREATE UNIQUE INDEX IF NOT EXISTS users_registration_id_uidx
  ON users (registration_id)
  WHERE registration_id IS NOT NULL;

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

CREATE TABLE IF NOT EXISTS identity_onboarding_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash bytea NOT NULL UNIQUE,
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  CHECK (expires_at > issued_at)
);
CREATE INDEX IF NOT EXISTS identity_onboarding_sessions_user_idx
  ON identity_onboarding_sessions(user_id, expires_at DESC)
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS email_verification_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email text NOT NULL,
  token_hash bytea NOT NULL UNIQUE,
  state email_verification_challenge_state NOT NULL DEFAULT 'issued',
  reason text NOT NULL DEFAULT 'send' CHECK (reason IN ('send', 'resend', 'email_change')),
  delivery_state text NOT NULL DEFAULT 'pending' CHECK (delivery_state IN ('pending', 'sent', 'failed')),
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  delivered_at timestamptz,
  consumed_at timestamptz,
  revoked_at timestamptz,
  revoked_reason text,
  superseded_at timestamptz,
  superseded_by uuid REFERENCES email_verification_challenges(id),
  request_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  request_ip inet,
  request_user_agent text,
  CHECK (expires_at > issued_at)
);

ALTER TABLE email_verification_challenges
  ADD COLUMN IF NOT EXISTS reason text NOT NULL DEFAULT 'send',
  ADD COLUMN IF NOT EXISTS delivery_state text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS revoked_reason text,
  ADD COLUMN IF NOT EXISTS superseded_at timestamptz;

CREATE INDEX IF NOT EXISTS email_verification_challenges_user_state_idx
  ON email_verification_challenges(user_id, state, issued_at DESC);
CREATE INDEX IF NOT EXISTS email_verification_challenges_expiry_idx
  ON email_verification_challenges(expires_at)
  WHERE state = 'issued';

COMMENT ON TABLE identity_onboarding_sessions IS
  'HttpOnly onboarding-session backing records. Store only a cryptographic hash of the browser token.';
COMMENT ON TABLE email_verification_challenges IS
  'One-time account email verification challenges. Raw tokens are delivered by email and never persisted.';
COMMENT ON COLUMN users.email_verified_at IS
  'Identity proof only. Does not grant organization membership, geography, capability truth, commercial membership, or Exchange readiness.';
