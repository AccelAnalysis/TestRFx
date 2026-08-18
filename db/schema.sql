-- RFxchange transactional data foundation.
-- PostgreSQL + PostGIS is the canonical persistence layer for production services.
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE exchange_record_type AS ENUM ('rfx', 'resource', 'intelligence', 'capability');

CREATE TABLE organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  display_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE organization_memberships (
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL,
  permissions jsonb NOT NULL DEFAULT '[]'::jsonb,
  PRIMARY KEY (organization_id, user_id)
);

CREATE TABLE locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  label text,
  address jsonb,
  point geography(Point, 4326),
  service_area geometry(MultiPolygon, 4326),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX locations_point_gix ON locations USING gist(point);
CREATE INDEX locations_service_area_gix ON locations USING gist(service_area);

CREATE TABLE exchange_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id text NOT NULL UNIQUE,
  record_type exchange_record_type NOT NULL,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  location_id uuid REFERENCES locations(id),
  title text NOT NULL,
  summary text NOT NULL,
  geography_label text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'active',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  search_document tsvector GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(public_id, '') || ' ' || coalesce(title, '') || ' ' || coalesce(summary, '') || ' ' || coalesce(geography_label, ''))
  ) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX exchange_records_search_gin ON exchange_records USING gin(search_document);
CREATE INDEX exchange_records_type_idx ON exchange_records(record_type);
CREATE INDEX exchange_records_org_idx ON exchange_records(organization_id, record_type);
CREATE INDEX exchange_records_updated_idx ON exchange_records(updated_at DESC);

CREATE TABLE capabilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exchange_record_id uuid NOT NULL UNIQUE REFERENCES exchange_records(id) ON DELETE CASCADE,
  amacs_node_id text,
  evidence_state text NOT NULL DEFAULT 'unverified',
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb
);
CREATE INDEX capabilities_amacs_idx ON capabilities(amacs_node_id);

CREATE TABLE rfx_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exchange_record_id uuid NOT NULL UNIQUE REFERENCES exchange_records(id) ON DELETE CASCADE,
  solicitation_type text,
  due_at timestamptz,
  performance_area geometry(MultiPolygon, 4326),
  requirements jsonb NOT NULL DEFAULT '[]'::jsonb
);
CREATE INDEX rfx_records_performance_area_gix ON rfx_records USING gist(performance_area);
CREATE INDEX rfx_records_due_idx ON rfx_records(due_at);

CREATE TABLE resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exchange_record_id uuid NOT NULL UNIQUE REFERENCES exchange_records(id) ON DELETE CASCADE,
  resource_mode text NOT NULL CHECK (resource_mode IN ('offer', 'request')),
  availability jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE intelligence_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exchange_record_id uuid NOT NULL UNIQUE REFERENCES exchange_records(id) ON DELETE CASCADE,
  signal_type text,
  observed_at timestamptz,
  source_context jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE favorites (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exchange_record_id uuid NOT NULL REFERENCES exchange_records(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, exchange_record_id)
);

CREATE TABLE referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_organization_id uuid NOT NULL REFERENCES organizations(id),
  recipient_organization_id uuid NOT NULL REFERENCES organizations(id),
  exchange_record_id uuid REFERENCES exchange_records(id),
  status text NOT NULL DEFAULT 'proposed',
  terms jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE activity_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_name text NOT NULL,
  actor_user_id uuid REFERENCES users(id),
  organization_id uuid REFERENCES organizations(id),
  exchange_record_id uuid REFERENCES exchange_records(id),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX activity_events_record_idx ON activity_events(exchange_record_id, occurred_at DESC);

-- Saved searches belong to an authenticated participant and optionally retain
-- the active organization that created the search. Alert delivery is performed
-- by the shared notification service; Universal Search owns change detection.
CREATE TABLE saved_searches (
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
CREATE INDEX saved_searches_user_lens_idx ON saved_searches(user_id, lens, updated_at DESC);
CREATE INDEX saved_searches_alert_idx ON saved_searches(alert_enabled, last_checked_at) WHERE alert_enabled = true;

-- Search activity is a first-party event source for recent searches and
-- privacy-safe aggregate intelligence. Raw history is scoped to its user.
CREATE TABLE search_activity (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_name text NOT NULL,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
  lens text NOT NULL CHECK (lens IN ('rfx', 'resources', 'intelligence', 'capabilities')),
  state jsonb NOT NULL,
  result_count integer NOT NULL DEFAULT 0 CHECK (result_count >= 0),
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX search_activity_user_lens_idx ON search_activity(user_id, lens, occurred_at DESC);
CREATE INDEX search_activity_event_idx ON search_activity(event_name, occurred_at DESC);

-- Sponsored placements are disclosed separately and are never added to the
-- organic relevance score.
CREATE TABLE sponsored_placements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exchange_record_id uuid NOT NULL REFERENCES exchange_records(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'Sponsored',
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR ends_at > starts_at)
);
CREATE INDEX sponsored_placements_active_idx ON sponsored_placements(exchange_record_id, starts_at, ends_at);
