-- RFxchange Geography extension.
-- Apply after db/schema.sql. This preserves the operating-chassis schema while adding
-- the named-geography, organization-location, privacy, and service-area relationships
-- required by Identity & Onboarding -> Geography.

DO $$ BEGIN
  CREATE TYPE geography_release_state AS ENUM ('released', 'visible', 'limited', 'restricted');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE location_visibility AS ENUM ('exact', 'approximate', 'locality_only');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS geographies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL DEFAULT 'US',
  state_code text,
  fips_code text UNIQUE,
  name text NOT NULL,
  geography_type text NOT NULL,
  parent_geography_id uuid REFERENCES geographies(id),
  boundary geometry(MultiPolygon, 4326),
  centroid geography(Point, 4326),
  map_bounds jsonb,
  default_camera jsonb NOT NULL DEFAULT '{}'::jsonb,
  release_state geography_release_state NOT NULL DEFAULT 'visible',
  activated_at timestamptz,
  boundary_source text,
  boundary_version text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS geographies_boundary_gix ON geographies USING gist(boundary);
CREATE INDEX IF NOT EXISTS geographies_centroid_gix ON geographies USING gist(centroid);
CREATE INDEX IF NOT EXISTS geographies_release_state_idx ON geographies(release_state);

CREATE TABLE IF NOT EXISTS geography_adjacency (
  geography_id uuid NOT NULL REFERENCES geographies(id) ON DELETE CASCADE,
  adjacent_geography_id uuid NOT NULL REFERENCES geographies(id) ON DELETE CASCADE,
  PRIMARY KEY (geography_id, adjacent_geography_id),
  CHECK (geography_id <> adjacent_geography_id)
);

ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS geography_id uuid REFERENCES geographies(id),
  ADD COLUMN IF NOT EXISTS normalized_address jsonb,
  ADD COLUMN IF NOT EXISTS visibility location_visibility NOT NULL DEFAULT 'approximate',
  ADD COLUMN IF NOT EXISTS is_primary boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_home_based boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'unverified';

CREATE INDEX IF NOT EXISTS locations_geography_idx ON locations(geography_id);
CREATE UNIQUE INDEX IF NOT EXISTS locations_one_primary_per_org_idx
  ON locations(organization_id)
  WHERE is_primary = true AND organization_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS organization_geographies (
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  geography_id uuid NOT NULL REFERENCES geographies(id) ON DELETE CASCADE,
  relationship_type text NOT NULL CHECK (relationship_type IN ('primary', 'service', 'branch', 'other')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, geography_id, relationship_type)
);

CREATE UNIQUE INDEX IF NOT EXISTS organization_geographies_one_primary_idx
  ON organization_geographies(organization_id)
  WHERE relationship_type = 'primary';

CREATE INDEX IF NOT EXISTS organization_geographies_geography_idx
  ON organization_geographies(geography_id, relationship_type);
