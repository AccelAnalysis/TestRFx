-- Resource Provider geocoding and map projection.
-- Apply after db/resource-provider-seeding.sql and db/resources-extension.sql.

ALTER TABLE resource_ingestion_candidates
  ADD COLUMN IF NOT EXISTS geocode_status text NOT NULL DEFAULT 'pending' CHECK (geocode_status IN ('pending', 'accepted', 'review', 'failed')),
  ADD COLUMN IF NOT EXISTS geocode_provider text,
  ADD COLUMN IF NOT EXISTS geocode_benchmark text,
  ADD COLUMN IF NOT EXISTS geocode_match_type text,
  ADD COLUMN IF NOT EXISTS geocode_matched_address text,
  ADD COLUMN IF NOT EXISTS geocode_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS geocoded_at timestamptz,
  ADD COLUMN IF NOT EXISTS geocode_verified_at timestamptz;

CREATE INDEX IF NOT EXISTS resource_ingestion_candidates_geocode_idx
  ON resource_ingestion_candidates(market_key, geocode_status, updated_at DESC);

-- Promoted remains a terminal lifecycle state, while enrichment fields may be
-- refreshed later. This supersedes the stricter PR #66 trigger that returned
-- OLD wholesale and therefore blocked post-promotion geocode enrichment.
CREATE OR REPLACE FUNCTION preserve_promoted_resource_ingestion_candidate()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.candidate_state = 'promoted' THEN
    NEW.candidate_state := 'promoted';
    NEW.promoted_organization_id := OLD.promoted_organization_id;
    NEW.promoted_exchange_record_id := OLD.promoted_exchange_record_id;
    NEW.promoted_at := OLD.promoted_at;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS resource_location_geocodes (
  location_id uuid PRIMARY KEY REFERENCES locations(id) ON DELETE CASCADE,
  provider text NOT NULL,
  benchmark text,
  status text NOT NULL CHECK (status IN ('accepted', 'review', 'failed')),
  match_type text,
  requested_address jsonb NOT NULL DEFAULT '{}'::jsonb,
  matched_address text,
  latitude double precision,
  longitude double precision,
  response_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  geocoded_at timestamptz NOT NULL DEFAULT now(),
  verified_at timestamptz,
  CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180)
);
CREATE INDEX IF NOT EXISTS resource_location_geocodes_status_idx
  ON resource_location_geocodes(status, geocoded_at DESC);

-- `public-location` means there is a real point the shared map can render.
-- An address-only canonical Location is not enough; retain service-area/off-map
-- behavior until a reviewed coordinate exists.
CREATE OR REPLACE FUNCTION enforce_resource_public_location_has_point()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  has_point boolean;
  service_area_label text;
BEGIN
  IF NEW.visibility <> 'public-location' THEN
    RETURN NEW;
  END IF;

  SELECT l.point IS NOT NULL
  INTO has_point
  FROM exchange_records er
  LEFT JOIN locations l ON l.id = er.location_id
  WHERE er.id = NEW.exchange_record_id;

  IF COALESCE(has_point, false) THEN
    RETURN NEW;
  END IF;

  service_area_label := NULLIF(BTRIM(COALESCE(NEW.availability->>'serviceArea', '')), '');
  NEW.visibility := CASE WHEN service_area_label IS NOT NULL THEN 'service-area' ELSE 'off-map' END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS resources_require_point_for_public_location ON resources;
CREATE TRIGGER resources_require_point_for_public_location
BEFORE INSERT OR UPDATE OF visibility, exchange_record_id, availability ON resources
FOR EACH ROW
EXECUTE FUNCTION enforce_resource_public_location_has_point();

-- Correct already-promoted address-only Resources created before this migration.
UPDATE resources r
SET visibility = CASE
  WHEN NULLIF(BTRIM(COALESCE(r.availability->>'serviceArea', '')), '') IS NOT NULL THEN 'service-area'
  ELSE 'off-map'
END
FROM exchange_records er
LEFT JOIN locations l ON l.id = er.location_id
WHERE r.exchange_record_id = er.id
  AND r.visibility = 'public-location'
  AND l.point IS NULL;

COMMENT ON TABLE resource_location_geocodes IS
  'Geocoder provenance for canonical Resource Provider Locations. Only accepted coordinates populate locations.point; review/failed responses remain off-map.';
