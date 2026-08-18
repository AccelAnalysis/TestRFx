-- Source-defined Capabilities flow: Save / Publish updates → Capability profile available in Exchange.
-- Apply after db/schema.sql.
ALTER TABLE capabilities
  ADD COLUMN IF NOT EXISTS publication_status text NOT NULL DEFAULT 'draft'
  CHECK (publication_status IN ('draft', 'published', 'archived'));

CREATE INDEX IF NOT EXISTS capabilities_publication_status_idx ON capabilities(publication_status);
