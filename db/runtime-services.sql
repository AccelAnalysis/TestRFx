-- Runtime service persistence for the authenticated RFxchange Exchange.
-- Apply after db/schema.sql and db/shared-workflows.sql.
-- This migration deliberately has no reference/demo identities. Production identity
-- must issue an opaque session token and store only its SHA-256 hash here.

CREATE TABLE IF NOT EXISTS app_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  active_organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  token_hash bytea NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz,
  CHECK (expires_at > created_at)
);
CREATE INDEX IF NOT EXISTS app_sessions_user_idx ON app_sessions(user_id, expires_at DESC);
CREATE INDEX IF NOT EXISTS app_sessions_active_idx ON app_sessions(active_organization_id, expires_at DESC) WHERE revoked_at IS NULL;

COMMENT ON TABLE app_sessions IS
  'Authenticated runtime sessions. Raw session tokens are never persisted and there is no demo/reference fallback.';

-- Record-card analytics use the canonical activity_events table. The same event stream
-- supports recently viewed cards without creating a second history subsystem.
CREATE INDEX IF NOT EXISTS activity_events_actor_recent_idx
  ON activity_events(actor_user_id, occurred_at DESC)
  WHERE actor_user_id IS NOT NULL;
