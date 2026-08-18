-- Runtime service persistence for the authenticated RFxchange Exchange.
-- Apply after db/schema.sql, db/identity-verification.sql, and db/shared-workflows.sql.
-- This migration deliberately has no reference/demo identities. Production identity
-- issues opaque tokens and stores only cryptographic hashes here.

CREATE TABLE IF NOT EXISTS app_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  active_organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  token_hash bytea NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz,
  CHECK (expires_at > created_at)
);
ALTER TABLE app_sessions ALTER COLUMN active_organization_id DROP NOT NULL;
CREATE INDEX IF NOT EXISTS app_sessions_user_idx ON app_sessions(user_id, expires_at DESC);
CREATE INDEX IF NOT EXISTS app_sessions_active_idx ON app_sessions(active_organization_id, expires_at DESC) WHERE revoked_at IS NULL;

COMMENT ON TABLE app_sessions IS
  'Authenticated runtime sessions. Raw session tokens are never persisted and there is no demo/reference fallback.';

CREATE TABLE IF NOT EXISTS login_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash bytea NOT NULL UNIQUE,
  return_to text NOT NULL,
  requested_user_agent text,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > created_at)
);
CREATE INDEX IF NOT EXISTS login_challenges_user_idx ON login_challenges(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS login_challenges_active_idx ON login_challenges(expires_at) WHERE consumed_at IS NULL AND revoked_at IS NULL;

COMMENT ON TABLE login_challenges IS
  'Single-use passwordless sign-in challenges. Only SHA-256 token hashes are persisted; delivery is delegated to the configured production email gateway.';

-- Record-card analytics use the canonical activity_events table. The same event stream
-- supports recently viewed cards without creating a second history subsystem.
CREATE INDEX IF NOT EXISTS activity_events_actor_recent_idx
  ON activity_events(actor_user_id, occurred_at DESC)
  WHERE actor_user_id IS NOT NULL;
