-- RFxchange public policy and media-provenance persistence contract.
-- Terms, Privacy, and Platform Rules are versioned policy documents. Accessibility is
-- a public information/commitment page and is not a required legal acknowledgement.

CREATE TYPE legal_document_type AS ENUM ('terms', 'privacy', 'platform_rules');
CREATE TYPE legal_acknowledgement_status AS ENUM ('accepted', 'acknowledged');

CREATE TABLE legal_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type legal_document_type NOT NULL,
  version text NOT NULL,
  status text NOT NULL CHECK (status IN ('draft', 'scheduled', 'current', 'superseded')),
  body_markdown text NOT NULL,
  content_hash text NOT NULL,
  published_at timestamptz,
  effective_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_type, version)
);

CREATE UNIQUE INDEX legal_documents_current_type_idx
  ON legal_documents(document_type)
  WHERE status = 'current';

CREATE TABLE policy_acceptances (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  legal_document_id uuid NOT NULL REFERENCES legal_documents(id),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
  status legal_acknowledgement_status NOT NULL,
  acceptance_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, legal_document_id)
);

CREATE INDEX policy_acceptances_user_idx
  ON policy_acceptances(user_id, accepted_at DESC);

CREATE TABLE media_attributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_key text NOT NULL UNIQUE,
  creator_or_source text NOT NULL,
  source_url text NOT NULL,
  license_name text,
  license_url text,
  attribution_text text NOT NULL,
  usage_context text NOT NULL,
  evidence_use text NOT NULL DEFAULT 'atmosphere-only' CHECK (evidence_use = 'atmosphere-only'),
  active boolean NOT NULL DEFAULT true,
  commercial_license_review_required boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
