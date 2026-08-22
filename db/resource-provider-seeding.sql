-- Resource Provider Seeding, Unclaimed Listings & Claims
-- Apply after db/schema.sql, db/organization-selection.sql, and db/resources-extension.sql.
-- This migration is additive: canonical Organization, Location, Exchange Record,
-- Resource, and Organization Claim identities remain the source of truth.

CREATE TABLE IF NOT EXISTS resource_provider_profiles (
  organization_id uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  provider_type text NOT NULL,
  provider_class text NOT NULL CHECK (provider_class IN ('community_institutional', 'commercial')),
  participation_policy text NOT NULL CHECK (participation_policy IN ('free_standard', 'commercial_paid')),
  classification_basis text NOT NULL,
  market_key text,
  seeded_at timestamptz,
  claimed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS resource_provider_profiles_class_idx ON resource_provider_profiles(provider_class, participation_policy);
CREATE INDEX IF NOT EXISTS resource_provider_profiles_market_idx ON resource_provider_profiles(market_key) WHERE market_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS external_resource_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key text NOT NULL UNIQUE,
  name text NOT NULL,
  authority text NOT NULL CHECK (authority IN ('authoritative', 'licensed', 'curated')),
  source_url text,
  license_or_use_basis text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (source_url IS NULL OR source_url ~ '^https://')
);

CREATE TABLE IF NOT EXISTS resource_ingestion_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES external_resource_sources(id),
  market_key text NOT NULL,
  status text NOT NULL DEFAULT 'staging' CHECK (status IN ('staging', 'review', 'completed', 'failed')),
  received_count integer NOT NULL DEFAULT 0,
  ready_count integer NOT NULL DEFAULT 0,
  duplicate_count integer NOT NULL DEFAULT 0,
  review_count integer NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  failure_message text
);
CREATE INDEX IF NOT EXISTS resource_ingestion_runs_source_market_idx ON resource_ingestion_runs(source_id, market_key, started_at DESC);

CREATE TABLE IF NOT EXISTS resource_ingestion_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ingestion_run_id uuid NOT NULL REFERENCES resource_ingestion_runs(id) ON DELETE CASCADE,
  source_id uuid NOT NULL REFERENCES external_resource_sources(id),
  source_record_id text NOT NULL,
  source_record_url text,
  market_key text NOT NULL,
  organization_name text NOT NULL,
  normalized_name text NOT NULL,
  website text,
  primary_domain text,
  provider_type text NOT NULL,
  provider_class text NOT NULL CHECK (provider_class IN ('community_institutional', 'commercial')),
  participation_policy text NOT NULL CHECK (participation_policy IN ('free_standard', 'commercial_paid')),
  classification_basis text NOT NULL,
  requires_classification_review boolean NOT NULL DEFAULT false,
  resource_category text NOT NULL,
  service_name text NOT NULL,
  service_summary text NOT NULL,
  address_line_1 text,
  locality text,
  region text,
  postal_code text,
  latitude double precision,
  longitude double precision,
  phone text,
  contact_email text,
  service_area text,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  candidate_state text NOT NULL DEFAULT 'staged' CHECK (candidate_state IN ('staged', 'ready', 'review_duplicate', 'duplicate_exact', 'rejected', 'promoted')),
  matched_organization_id uuid REFERENCES organizations(id),
  dedupe_score numeric(5,4),
  dedupe_basis text,
  promoted_organization_id uuid REFERENCES organizations(id),
  promoted_exchange_record_id uuid REFERENCES exchange_records(id),
  promoted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_id, source_record_id),
  CHECK (source_record_url IS NULL OR source_record_url ~ '^https://'),
  CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180)
);
CREATE INDEX IF NOT EXISTS resource_ingestion_candidates_state_idx ON resource_ingestion_candidates(candidate_state, market_key, created_at DESC);
CREATE INDEX IF NOT EXISTS resource_ingestion_candidates_domain_idx ON resource_ingestion_candidates(lower(primary_domain)) WHERE primary_domain IS NOT NULL;
CREATE INDEX IF NOT EXISTS resource_ingestion_candidates_name_idx ON resource_ingestion_candidates(normalized_name);
CREATE INDEX IF NOT EXISTS resource_ingestion_candidates_match_idx ON resource_ingestion_candidates(matched_organization_id) WHERE matched_organization_id IS NOT NULL;

-- Promotion is a terminal ingestion state. A later refresh of the same external
-- source record must not regress the candidate back to ready/review and make a
-- second canonical Resource eligible for promotion. The source provenance row
-- remains the durable place to record later checks of an already-promoted item.
CREATE OR REPLACE FUNCTION preserve_promoted_resource_ingestion_candidate()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.candidate_state = 'promoted' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS resource_ingestion_candidates_preserve_promoted_state ON resource_ingestion_candidates;
CREATE TRIGGER resource_ingestion_candidates_preserve_promoted_state
BEFORE UPDATE ON resource_ingestion_candidates
FOR EACH ROW
EXECUTE FUNCTION preserve_promoted_resource_ingestion_candidate();

CREATE TABLE IF NOT EXISTS external_resource_source_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES external_resource_sources(id) ON DELETE CASCADE,
  source_record_id text NOT NULL,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  exchange_record_id uuid REFERENCES exchange_records(id) ON DELETE SET NULL,
  source_url text,
  retrieved_at timestamptz NOT NULL DEFAULT now(),
  last_checked_at timestamptz NOT NULL DEFAULT now(),
  raw_payload_hash text,
  source_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (source_id, source_record_id),
  CHECK (source_url IS NULL OR source_url ~ '^https://')
);
CREATE INDEX IF NOT EXISTS external_resource_source_records_org_idx ON external_resource_source_records(organization_id, last_checked_at DESC);
CREATE INDEX IF NOT EXISTS external_resource_source_records_exchange_idx ON external_resource_source_records(exchange_record_id) WHERE exchange_record_id IS NOT NULL;

COMMENT ON TABLE resource_provider_profiles IS
  'Classifies Resource Providers independently from claim, verification, sponsorship, and recommendation state. Community/institutional providers receive free standard participation; commercial providers require commercial participation to publish commercial services.';
COMMENT ON TABLE resource_ingestion_candidates IS
  'Staging area for external Resource Provider candidates. No candidate becomes a visible RFxchange listing until dedupe/classification review and explicit promotion create or attach canonical Organization/Location/Resource records. Promoted rows are terminal and immutable to restaging.';
COMMENT ON TABLE external_resource_source_records IS
  'Persistent provenance for promoted externally sourced Resource Provider records.';
