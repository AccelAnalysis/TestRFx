-- RFxchange Authenticated Exchange → Intelligence persistence extension.
-- Apply after db/schema.sql and db/shared-workflows.sql.
-- Tracking/following deliberately uses the canonical record_relationships table.

ALTER TABLE intelligence_records
  ADD COLUMN IF NOT EXISTS observed_from timestamptz,
  ADD COLUMN IF NOT EXISTS observed_to timestamptz,
  ADD COLUMN IF NOT EXISTS source_type text,
  ADD COLUMN IF NOT EXISTS provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS intelligence_records_observed_idx
  ON intelligence_records(observed_from DESC, observed_to DESC);

CREATE TABLE IF NOT EXISTS intelligence_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intelligence_record_id uuid NOT NULL REFERENCES intelligence_records(id) ON DELETE CASCADE,
  source_label text NOT NULL,
  source_type text NOT NULL,
  publisher text,
  source_uri text,
  coverage jsonb NOT NULL DEFAULT '{}'::jsonb,
  methodology jsonb NOT NULL DEFAULT '{}'::jsonb,
  rights_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  observed_at timestamptz,
  retrieved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE intelligence_sources DROP CONSTRAINT IF EXISTS intelligence_sources_source_type_check;
ALTER TABLE intelligence_sources
  ADD CONSTRAINT intelligence_sources_source_type_check
  CHECK (source_type IN ('exchange-activity', 'participant-observation', 'external-dataset')) NOT VALID;
CREATE INDEX IF NOT EXISTS intelligence_sources_record_idx ON intelligence_sources(intelligence_record_id, created_at DESC);

CREATE TABLE IF NOT EXISTS intelligence_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intelligence_record_id uuid NOT NULL REFERENCES intelligence_records(id) ON DELETE CASCADE,
  author_user_id uuid NOT NULL REFERENCES users(id),
  organization_id uuid REFERENCES organizations(id),
  visibility text NOT NULL DEFAULT 'organization' CHECK (visibility IN ('personal', 'organization', 'shared')),
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS intelligence_notes_record_idx ON intelligence_notes(intelligence_record_id, created_at DESC);
CREATE INDEX IF NOT EXISTS intelligence_notes_visibility_idx ON intelligence_notes(visibility, organization_id, author_user_id);

-- Older Intelligence builds created a lens-specific tracking table. Canonical tracking/following
-- now lives in record_relationships. Preserve an existing legacy table for migration/audit only;
-- new runtime code must not write it.
COMMENT ON TABLE intelligence_tracking IS
  'Legacy compatibility only. New Intelligence Track/Follow relationships are stored in record_relationships.';

CREATE TABLE IF NOT EXISTS intelligence_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intelligence_record_id uuid NOT NULL REFERENCES intelligence_records(id) ON DELETE CASCADE,
  related_exchange_record_id uuid REFERENCES exchange_records(id) ON DELETE CASCADE,
  related_organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  relationship_type text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (related_exchange_record_id IS NOT NULL OR related_organization_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS intelligence_relationships_record_idx ON intelligence_relationships(intelligence_record_id, relationship_type);

-- Comparison is computed from canonical records and is not stored as market truth.
-- Save/Track/Follow use record_relationships; referrals use referrals/referral_events.
