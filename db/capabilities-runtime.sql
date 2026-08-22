-- RFxchange Capabilities Exchange projection.
-- Apply after db/schema.sql, db/capability-enrichment.sql, db/shared-workflows.sql,
-- and db/organization-media.sql.
--
-- Canonical capability assertions remain organization_capability_claims/evidence/profile.
-- This migration adds only Exchange publication state to the existing capabilities projection.

ALTER TABLE capabilities ADD COLUMN IF NOT EXISTS publication_status text NOT NULL DEFAULT 'draft';
ALTER TABLE capabilities ADD COLUMN IF NOT EXISTS published_at timestamptz;
ALTER TABLE capabilities ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$ BEGIN
  ALTER TABLE capabilities ADD CONSTRAINT capabilities_publication_status_check
    CHECK (publication_status IN ('draft', 'published'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS capabilities_publication_idx
  ON capabilities(publication_status, published_at DESC);

-- Existing active capability projections predate explicit publication state. Preserve
-- their current Exchange visibility during migration rather than unexpectedly hiding them.
UPDATE capabilities c
SET publication_status = 'published',
    published_at = COALESCE(c.published_at, er.updated_at, now()),
    updated_at = now()
FROM exchange_records er
WHERE er.id = c.exchange_record_id
  AND er.status = 'active'
  AND c.publication_status = 'draft';

COMMENT ON COLUMN capabilities.publication_status IS
  'Exchange publication state only. Canonical claims, AMACS mapping decisions, and evidence remain in organization_capability_* tables.';
