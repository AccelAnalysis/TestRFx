-- RFxchange platform-wide geography model.
-- Apply after db/schema.sql and db/geography-extension.sql.
--
-- Core analytical path:
-- Country -> State -> Region / Market -> County / County Equivalent ->
-- Place / Municipality -> Census Tract -> Block Group -> Census Block.
--
-- Non-nesting geographies attach in parallel: MSA/CSA, ZIP/ZCTA, political
-- districts, school districts, urban areas, planning regions, and governed
-- economic-development zones.

ALTER TABLE geographies
  ADD COLUMN IF NOT EXISTS geography_level text,
  ADD COLUMN IF NOT EXISTS geography_system text NOT NULL DEFAULT 'legacy',
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS vintage text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS source_authority text,
  ADD COLUMN IF NOT EXISTS source_layer text,
  ADD COLUMN IF NOT EXISTS is_economic_development_zone boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS effective_from date,
  ADD COLUMN IF NOT EXISTS effective_to date,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

-- The original onboarding geography table used fips_code as a single global
-- identity. The platform model may retain a legacy county/place row while also
-- storing a source/vintage-qualified analytical row for the same GEOID, so the
-- old uniqueness constraint is intentionally relaxed.
ALTER TABLE geographies DROP CONSTRAINT IF EXISTS geographies_fips_code_key;
CREATE INDEX IF NOT EXISTS geographies_fips_code_idx ON geographies(fips_code);
CREATE UNIQUE INDEX IF NOT EXISTS geographies_system_type_external_vintage_idx
  ON geographies(geography_system, geography_type, external_id, vintage)
  WHERE external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS geographies_type_idx ON geographies(geography_type);
CREATE INDEX IF NOT EXISTS geographies_economic_zone_idx
  ON geographies(is_economic_development_zone)
  WHERE is_economic_development_zone = true;

CREATE TABLE IF NOT EXISTS geography_relationships (
  parent_geography_id uuid NOT NULL REFERENCES geographies(id) ON DELETE CASCADE,
  child_geography_id uuid NOT NULL REFERENCES geographies(id) ON DELETE CASCADE,
  relationship_type text NOT NULL CHECK (relationship_type IN ('contains', 'member_of', 'overlaps', 'market_member')),
  hierarchy_key text NOT NULL DEFAULT 'platform',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (parent_geography_id, child_geography_id, relationship_type, hierarchy_key),
  CHECK (parent_geography_id <> child_geography_id)
);
CREATE INDEX IF NOT EXISTS geography_relationships_child_idx
  ON geography_relationships(child_geography_id, relationship_type, hierarchy_key);

CREATE TABLE IF NOT EXISTS location_geographies (
  location_id uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  geography_id uuid NOT NULL REFERENCES geographies(id) ON DELETE CASCADE,
  relation_role text NOT NULL CHECK (relation_role IN ('core', 'parallel', 'market', 'economic_zone')),
  derivation text NOT NULL CHECK (derivation IN ('address', 'coordinates', 'spatial', 'declared', 'imported', 'source')),
  source text NOT NULL,
  confidence numeric(5,4) NOT NULL DEFAULT 1.0000 CHECK (confidence >= 0 AND confidence <= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (location_id, geography_id, relation_role)
);
CREATE INDEX IF NOT EXISTS location_geographies_geo_idx
  ON location_geographies(geography_id, relation_role, location_id);

CREATE TABLE IF NOT EXISTS location_geography_profiles (
  location_id uuid PRIMARY KEY REFERENCES locations(id) ON DELETE CASCADE,
  profile jsonb NOT NULL,
  resolver text NOT NULL,
  benchmark text,
  vintage text,
  derived_from text NOT NULL CHECK (derived_from IN ('address', 'coordinates', 'declared', 'source')),
  resolved_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS geographic_scopes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  exchange_record_id uuid REFERENCES exchange_records(id) ON DELETE CASCADE,
  scope_kind text NOT NULL CHECK (scope_kind IN (
    'organization_service_area',
    'resource_service_area',
    'rfx_performance_area',
    'intelligence_analysis_area',
    'capability_service_area'
  )),
  scope_mode text NOT NULL CHECK (scope_mode IN (
    'geographies', 'address', 'point', 'polygon', 'radius', 'statewide', 'nationwide', 'remote'
  )),
  label text,
  source_location_id uuid REFERENCES locations(id) ON DELETE SET NULL,
  address jsonb,
  center_point geography(Point, 4326),
  radius_meters numeric,
  boundary geometry(MultiPolygon, 4326),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (CASE WHEN organization_id IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN exchange_record_id IS NOT NULL THEN 1 ELSE 0 END) = 1
  ),
  CHECK (radius_meters IS NULL OR radius_meters >= 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS geographic_scopes_org_kind_idx
  ON geographic_scopes(organization_id, scope_kind)
  WHERE organization_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS geographic_scopes_record_kind_idx
  ON geographic_scopes(exchange_record_id, scope_kind)
  WHERE exchange_record_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS geographic_scopes_boundary_gix ON geographic_scopes USING gist(boundary);
CREATE INDEX IF NOT EXISTS geographic_scopes_center_gix ON geographic_scopes USING gist(center_point);

CREATE TABLE IF NOT EXISTS geographic_scope_geographies (
  scope_id uuid NOT NULL REFERENCES geographic_scopes(id) ON DELETE CASCADE,
  geography_id uuid NOT NULL REFERENCES geographies(id) ON DELETE CASCADE,
  inclusion text NOT NULL DEFAULT 'include' CHECK (inclusion IN ('include', 'exclude')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scope_id, geography_id, inclusion)
);
CREATE INDEX IF NOT EXISTS geographic_scope_geographies_geo_idx
  ON geographic_scope_geographies(geography_id, inclusion, scope_id);

CREATE TABLE IF NOT EXISTS geography_dataset_sources (
  source_key text PRIMARY KEY,
  name text NOT NULL,
  authority text NOT NULL,
  source_url text,
  license_or_use_basis text NOT NULL,
  vintage text NOT NULL DEFAULT '',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE VIEW exchange_record_geography_rollup AS
WITH location_membership AS (
  SELECT er.id AS exchange_record_id, lg.geography_id, 'location'::text AS scope_source
  FROM exchange_records er
  JOIN locations l ON l.id = er.location_id
  JOIN location_geographies lg ON lg.location_id = l.id
), scoped_membership AS (
  SELECT gs.exchange_record_id, gsg.geography_id, gs.scope_kind AS scope_source
  FROM geographic_scopes gs
  JOIN geographic_scope_geographies gsg ON gsg.scope_id = gs.id AND gsg.inclusion = 'include'
  WHERE gs.exchange_record_id IS NOT NULL
)
SELECT * FROM location_membership
UNION
SELECT * FROM scoped_membership;

COMMENT ON TABLE location_geographies IS
  'All core and parallel geographies containing a canonical Location. Supports country-to-block rollups plus overlapping market, political, planning and economic-development identifiers.';
COMMENT ON TABLE geographic_scopes IS
  'Declared or derived service, performance and analysis areas for Organizations and Exchange records. A scope may reference geographies, a resolved address, a point/radius, a polygon, statewide/nationwide coverage, or remote delivery.';
COMMENT ON TABLE geography_dataset_sources IS
  'Provenance for imported geography boundaries such as planning regions, Opportunity Zones, Enterprise Zones, HUBZones and locally governed economic-development districts.';
