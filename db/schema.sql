-- RFxchange data foundation.
-- PostgreSQL + PostGIS is the canonical transactional persistence target.
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

-- Resources are discoverable Exchange offers. Requests are transactional records
-- created against an offer rather than separate public Resource listings.
CREATE TABLE resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exchange_record_id uuid NOT NULL UNIQUE REFERENCES exchange_records(id) ON DELETE CASCADE,
  resource_mode text NOT NULL DEFAULT 'offer' CHECK (resource_mode IN ('offer', 'request')),
  category text NOT NULL,
  availability_state text NOT NULL CHECK (availability_state IN ('available', 'limited', 'scheduled')),
  availability_label text NOT NULL,
  availability jsonb NOT NULL DEFAULT '{}'::jsonb,
  capacity text,
  service_area_label text,
  visibility text NOT NULL DEFAULT 'off-map' CHECK (visibility IN ('public-location', 'service-area', 'off-map')),
  terms text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  sponsored boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX resources_status_idx ON resources(status, availability_state);
CREATE INDEX resources_category_idx ON resources(category);

CREATE TABLE resource_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exchange_record_id uuid NOT NULL REFERENCES exchange_records(id) ON DELETE CASCADE,
  requester_organization_id uuid NOT NULL REFERENCES organizations(id),
  requester_user_id uuid NOT NULL REFERENCES users(id),
  scope text NOT NULL,
  needed_by date,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'connected', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX resource_requests_record_idx ON resource_requests(exchange_record_id, created_at DESC);
CREATE INDEX resource_requests_requester_idx ON resource_requests(requester_organization_id, created_at DESC);

-- The Resources source explicitly distinguishes Save and Follow. These are
-- durable user/organization relationships with a Resource record.
CREATE TABLE resource_relationships (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  exchange_record_id uuid NOT NULL REFERENCES exchange_records(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('saved', 'following')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, exchange_record_id, kind)
);

-- "Share" in the Resources source leads to a send-to-organization workflow.
CREATE TABLE resource_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exchange_record_id uuid NOT NULL REFERENCES exchange_records(id) ON DELETE CASCADE,
  sender_organization_id uuid NOT NULL REFERENCES organizations(id),
  sender_user_id uuid NOT NULL REFERENCES users(id),
  recipient_organization_id uuid NOT NULL REFERENCES organizations(id),
  message text,
  status text NOT NULL DEFAULT 'sent',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX resource_shares_record_idx ON resource_shares(exchange_record_id, created_at DESC);

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

-- Recipient policy and fee are read before a cross-lens referral is submitted.
CREATE TABLE referral_policies (
  organization_id uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  policy_summary text,
  fee_summary text,
  active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_organization_id uuid NOT NULL REFERENCES organizations(id),
  recipient_organization_id uuid NOT NULL REFERENCES organizations(id),
  actor_user_id uuid REFERENCES users(id),
  exchange_record_id uuid REFERENCES exchange_records(id),
  status text NOT NULL DEFAULT 'proposed',
  message text,
  terms jsonb NOT NULL DEFAULT '{}'::jsonb,
  policy_snapshot jsonb,
  fee_snapshot jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX referrals_sender_idx ON referrals(sender_organization_id, created_at DESC);
CREATE INDEX referrals_recipient_idx ON referrals(recipient_organization_id, created_at DESC);

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
