-- Capability Enrichment persistence and immutable AMACS runtime projection.
-- Apply after db/schema.sql and db/organization-profile.sql.

-- Industry & Services is source-defined as enrichment context, but it remains
-- canonical organization-profile data. Do not create a second copy in capability records.
ALTER TABLE organization_profiles
  ADD COLUMN IF NOT EXISTS service_offerings text[] NOT NULL DEFAULT '{}';

CREATE TABLE amacs_runtime_releases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL UNIQUE,
  status text NOT NULL,
  released_at date NOT NULL,
  source_commit_sha char(40) NOT NULL,
  manifest jsonb NOT NULL,
  imported_at timestamptz NOT NULL DEFAULT now(),
  active boolean NOT NULL DEFAULT false
);
CREATE UNIQUE INDEX amacs_runtime_one_active_release_idx ON amacs_runtime_releases(active) WHERE active;

CREATE TABLE amacs_runtime_concepts (
  release_id uuid NOT NULL REFERENCES amacs_runtime_releases(id) ON DELETE CASCADE,
  concept_id text NOT NULL,
  concept_type text NOT NULL,
  preferred_label text NOT NULL,
  definition text NOT NULL,
  status text NOT NULL,
  matchable boolean NOT NULL DEFAULT false,
  editorial_maturity text,
  primary_parent_id text,
  version_introduced text,
  record_checksum char(64) NOT NULL,
  source_record jsonb NOT NULL,
  search_document tsvector GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(preferred_label, '') || ' ' || coalesce(definition, ''))
  ) STORED,
  PRIMARY KEY (release_id, concept_id)
);
CREATE INDEX amacs_runtime_concepts_search_gin ON amacs_runtime_concepts USING gin(search_document);
CREATE INDEX amacs_runtime_concepts_parent_idx ON amacs_runtime_concepts(release_id, primary_parent_id);
CREATE INDEX amacs_runtime_concepts_matchable_idx ON amacs_runtime_concepts(release_id, matchable, status);

CREATE TABLE amacs_runtime_aliases (
  release_id uuid NOT NULL REFERENCES amacs_runtime_releases(id) ON DELETE CASCADE,
  alias_id text NOT NULL,
  concept_id text NOT NULL,
  alias text NOT NULL,
  alias_type text NOT NULL,
  language text NOT NULL,
  region text,
  status text NOT NULL,
  record_checksum char(64) NOT NULL,
  source_record jsonb NOT NULL,
  PRIMARY KEY (release_id, alias_id),
  FOREIGN KEY (release_id, concept_id) REFERENCES amacs_runtime_concepts(release_id, concept_id) ON DELETE CASCADE
);
CREATE INDEX amacs_runtime_aliases_lookup_idx ON amacs_runtime_aliases(release_id, lower(alias));

CREATE TABLE organization_capability_profiles (
  organization_id uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  tags text[] NOT NULL DEFAULT '{}',
  keywords text[] NOT NULL DEFAULT '{}',
  specialties text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE organization_capability_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL,
  solution text,
  amacs_release_id uuid REFERENCES amacs_runtime_releases(id),
  amacs_concept_id text,
  mapping_status text NOT NULL DEFAULT 'unmapped' CHECK (mapping_status IN ('unmapped', 'accepted')),
  claim_status text NOT NULL DEFAULT 'draft' CHECK (claim_status IN ('draft', 'active', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (amacs_release_id, amacs_concept_id) REFERENCES amacs_runtime_concepts(release_id, concept_id)
);
CREATE INDEX organization_capability_claims_org_idx ON organization_capability_claims(organization_id, claim_status);
CREATE INDEX organization_capability_claims_amacs_idx ON organization_capability_claims(amacs_release_id, amacs_concept_id);

CREATE TABLE organization_capability_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  capability_claim_id uuid NOT NULL REFERENCES organization_capability_claims(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('certification', 'license', 'case-study', 'supporting-document')),
  label text NOT NULL,
  issuer text,
  source_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX organization_capability_evidence_claim_idx ON organization_capability_evidence(capability_claim_id, kind);

CREATE TABLE onboarding_capability_progress (
  organization_id uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  last_path text[] NOT NULL DEFAULT '{}',
  completed_leaf_paths text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- AMACS is immutable at runtime. RFxchange capability assertions may point to a deployed
-- AMACS concept, but this schema provides no application path that mutates AMACS records.
