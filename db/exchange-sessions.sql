-- RFxchange authenticated Exchange runtime sessions.
-- Apply after db/schema.sql and after the production Identity provider has verified the user.
-- Identity issues the raw token to the browser as an HttpOnly, Secure, SameSite=Lax cookie;
-- only its SHA-256 hash is persisted here.

CREATE TABLE IF NOT EXISTS exchange_sessions (
  token_hash bytea PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  active_organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CHECK (expires_at > issued_at)
);

CREATE INDEX IF NOT EXISTS exchange_sessions_user_idx
  ON exchange_sessions(user_id, expires_at DESC)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS exchange_sessions_org_idx
  ON exchange_sessions(active_organization_id, expires_at DESC)
  WHERE revoked_at IS NULL;

COMMENT ON TABLE exchange_sessions IS
  'Server-authoritative RFxchange sessions. Raw bearer tokens are never persisted.';
