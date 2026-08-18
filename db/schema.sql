-- RFxchange reference data foundation.
-- PostgreSQL + PostGIS is the canonical target for production persistence.
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
  status text NOT NULL DEFAULT 'active',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  search_document tsvector GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(summary, ''))
  ) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX exchange_records_search_gin ON exchange_records USING gin(search_document);
CREATE INDEX exchange_records_type_idx ON exchange_records(record_type);

CREATE TABLE capabilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exchange_record_id uuid NOT NULL UNIQUE REFERENCES exchange_records(id) ON DELETE CASCADE,
  amacs_node_id text,
  evidence_state text NOT NULL DEFAULT 'unverified',
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE rfx_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exchange_record_id uuid NOT NULL UNIQUE REFERENCES exchange_records(id) ON DELETE CASCADE,
  solicitation_type text,
  due_at timestamptz,
  requirements jsonb NOT NULL DEFAULT '[]'::jsonb
);

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
