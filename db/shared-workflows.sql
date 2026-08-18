-- RFxchange Authenticated Exchange → Shared workflows/services persistence extension.
-- Apply after db/schema.sql. This file extends the canonical tables; it does not create
-- lens-specific copies of users, organizations, Exchange records, referrals, or events.

CREATE TABLE IF NOT EXISTS record_relationships (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exchange_record_id uuid NOT NULL REFERENCES exchange_records(id) ON DELETE CASCADE,
  relationship_kind text NOT NULL CHECK (relationship_kind IN ('saved', 'watching', 'tracking', 'following')),
  preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, exchange_record_id, relationship_kind)
);
CREATE INDEX IF NOT EXISTS record_relationships_record_idx ON record_relationships(exchange_record_id, relationship_kind);

-- Keep the original favorites table as the simple Save compatibility projection.
INSERT INTO record_relationships (user_id, exchange_record_id, relationship_kind)
SELECT user_id, exchange_record_id, 'saved' FROM favorites
ON CONFLICT DO NOTHING;

ALTER TABLE referrals ADD COLUMN IF NOT EXISTS created_by_user_id uuid REFERENCES users(id);
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS source_lens text;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS note text;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS completed_at timestamptz;

CREATE TABLE IF NOT EXISTS referral_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  referral_id uuid NOT NULL REFERENCES referrals(id) ON DELETE CASCADE,
  event_name text NOT NULL,
  actor_user_id uuid REFERENCES users(id),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS referral_events_referral_idx ON referral_events(referral_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS collaboration_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_kind text NOT NULL CHECK (request_kind IN ('teaming', 'connection')),
  exchange_record_id uuid NOT NULL REFERENCES exchange_records(id) ON DELETE CASCADE,
  sender_organization_id uuid NOT NULL REFERENCES organizations(id),
  recipient_organization_id uuid REFERENCES organizations(id),
  created_by_user_id uuid REFERENCES users(id),
  status text NOT NULL DEFAULT 'requested',
  message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS collaboration_requests_record_idx ON collaboration_requests(exchange_record_id, status);

CREATE TABLE IF NOT EXISTS share_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exchange_record_id uuid NOT NULL REFERENCES exchange_records(id) ON DELETE CASCADE,
  created_by_user_id uuid REFERENCES users(id),
  token_hash text,
  audience jsonb NOT NULL DEFAULT '{}'::jsonb,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  exchange_record_id uuid REFERENCES exchange_records(id) ON DELETE CASCADE,
  event_name text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  deep_link text,
  read_at timestamptz,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications(user_id, read_at, created_at DESC);

CREATE TABLE IF NOT EXISTS workflow_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id text NOT NULL,
  source_lens text,
  source_surface text NOT NULL,
  actor_user_id uuid REFERENCES users(id),
  actor_organization_id uuid REFERENCES organizations(id),
  exchange_record_id uuid REFERENCES exchange_records(id),
  state text NOT NULL DEFAULT 'started',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS workflow_executions_record_idx ON workflow_executions(exchange_record_id, started_at DESC);

-- Matching remains a service boundary rather than a source-of-truth table. Persist a match
-- decision only when a downstream workflow needs durable provenance.
CREATE TABLE IF NOT EXISTS match_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_exchange_record_id uuid NOT NULL REFERENCES exchange_records(id) ON DELETE CASCADE,
  matched_exchange_record_id uuid NOT NULL REFERENCES exchange_records(id) ON DELETE CASCADE,
  requested_by_user_id uuid REFERENCES users(id),
  score numeric,
  rationale jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'suggested',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_exchange_record_id, matched_exchange_record_id, requested_by_user_id)
);

-- Membership, billing, credits, referral fee settlement, and payouts remain one commercial
-- service owned at the organization level. A separate membership migration may extend that
-- domain; this shared-workflow extension intentionally does not duplicate it.
