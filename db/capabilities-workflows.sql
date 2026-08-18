-- Capabilities deep-workflow production persistence target.
-- Apply after db/schema.sql and db/shared-workflows.sql.
-- The current Node service uses a durable JSON adapter when a database adapter is not configured;
-- these normalized tables are the PostgreSQL target for the same contracts.

CREATE TABLE IF NOT EXISTS organization_capability_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exchange_record_id uuid NOT NULL REFERENCES exchange_records(id) ON DELETE CASCADE,
  claim_key text NOT NULL,
  name text NOT NULL,
  description text NOT NULL,
  amacs_node_id text,
  amacs_label text,
  mapping_status text NOT NULL CHECK (mapping_status IN ('suggested', 'accepted', 'needs-review')),
  publication_status text NOT NULL CHECK (publication_status IN ('draft', 'ready', 'published')),
  evidence_state text NOT NULL CHECK (evidence_state IN ('claimed', 'supported', 'review-needed')),
  specialties jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (exchange_record_id, claim_key)
);
CREATE INDEX IF NOT EXISTS organization_capability_claims_exchange_idx ON organization_capability_claims(exchange_record_id, publication_status);
CREATE INDEX IF NOT EXISTS organization_capability_claims_amacs_idx ON organization_capability_claims(amacs_node_id) WHERE amacs_node_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS capability_evidence_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  capability_claim_id uuid NOT NULL REFERENCES organization_capability_claims(id) ON DELETE CASCADE,
  evidence_kind text NOT NULL CHECK (evidence_kind IN ('certification', 'license', 'past-performance', 'case-study', 'document', 'link')),
  label text NOT NULL,
  issuer text,
  note text,
  object_key text,
  source_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS capability_evidence_claim_idx ON capability_evidence_items(capability_claim_id, created_at DESC);

CREATE TABLE IF NOT EXISTS capability_profile_publications (
  exchange_record_id uuid PRIMARY KEY REFERENCES exchange_records(id) ON DELETE CASCADE,
  profile_strength integer NOT NULL DEFAULT 0 CHECK (profile_strength BETWEEN 0 AND 100),
  published_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- AMACS candidate interpretation is deliberately not authoritative. Persist the participant
-- disposition so an accepted/edited mapping is distinguishable from an automated suggestion.
CREATE TABLE IF NOT EXISTS capability_mapping_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  capability_claim_id uuid NOT NULL REFERENCES organization_capability_claims(id) ON DELETE CASCADE,
  candidate_amacs_node_id text,
  candidate_label text,
  disposition text NOT NULL CHECK (disposition IN ('accept', 'edit', 'reject')),
  decided_by_user_id uuid REFERENCES users(id),
  source_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS capability_mapping_decisions_claim_idx ON capability_mapping_decisions(capability_claim_id, created_at DESC);
