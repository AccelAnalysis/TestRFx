-- Universal Search productionization migration.
-- Apply to an existing RFxchange PostgreSQL/PostGIS database after the original schema.

ALTER TABLE exchange_records ADD COLUMN IF NOT EXISTS geography_label text NOT NULL DEFAULT '';

-- PostgreSQL cannot alter a generated expression in place. Rebuild the search
-- document so public identifiers and geography participate in deterministic full-text retrieval.
DROP INDEX IF EXISTS exchange_records_search_gin;
ALTER TABLE exchange_records DROP COLUMN IF EXISTS search_document;
ALTER TABLE exchange_records ADD COLUMN search_document tsvector GENERATED ALWAYS AS (
  to_tsvector('english', coalesce(public_id, '') || ' ' || coalesce(title, '') || ' ' || coalesce(summary, '') || ' ' || coalesce(geography_label, ''))
) STORED;
CREATE INDEX IF NOT EXISTS exchange_records_search_gin ON exchange_records USING gin(search_document);
CREATE INDEX IF NOT EXISTS exchange_records_org_idx ON exchange_records(organization_id, record_type);
CREATE INDEX IF NOT EXISTS exchange_records_updated_idx ON exchange_records(updated_at DESC);

ALTER TABLE rfx_records ADD COLUMN IF NOT EXISTS performance_area geometry(MultiPolygon, 4326);
CREATE INDEX IF NOT EXISTS rfx_records_performance_area_gix ON rfx_records USING gist(performance_area);
CREATE INDEX IF NOT EXISTS rfx_records_due_idx ON rfx_records(due_at);
CREATE INDEX IF NOT EXISTS capabilities_amacs_idx ON capabilities(amacs_node_id);

CREATE TABLE IF NOT EXISTS saved_searches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
  name text NOT NULL CHECK (length(trim(name)) > 0),
  lens text NOT NULL CHECK (lens IN ('rfx', 'resources', 'intelligence', 'capabilities')),
  state jsonb NOT NULL,
  alert_enabled boolean NOT NULL DEFAULT false,
  result_fingerprint text,
  last_checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE saved_searches ADD COLUMN IF NOT EXISTS result_fingerprint text;
ALTER TABLE saved_searches ADD COLUMN IF NOT EXISTS last_checked_at timestamptz;
CREATE INDEX IF NOT EXISTS saved_searches_user_lens_idx ON saved_searches(user_id, lens, updated_at DESC);
CREATE INDEX IF NOT EXISTS saved_searches_alert_idx ON saved_searches(alert_enabled, last_checked_at) WHERE alert_enabled = true;

CREATE TABLE IF NOT EXISTS search_activity (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_name text NOT NULL,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
  lens text NOT NULL CHECK (lens IN ('rfx', 'resources', 'intelligence', 'capabilities')),
  state jsonb NOT NULL,
  result_count integer NOT NULL DEFAULT 0 CHECK (result_count >= 0),
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS search_activity_user_lens_idx ON search_activity(user_id, lens, occurred_at DESC);
CREATE INDEX IF NOT EXISTS search_activity_event_idx ON search_activity(event_name, occurred_at DESC);

CREATE TABLE IF NOT EXISTS sponsored_placements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exchange_record_id uuid NOT NULL REFERENCES exchange_records(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'Sponsored',
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS sponsored_placements_active_idx ON sponsored_placements(exchange_record_id, starts_at, ends_at);
