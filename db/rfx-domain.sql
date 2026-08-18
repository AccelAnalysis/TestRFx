-- Additive RFx domain extension for the RFxchange operating chassis.
-- This file preserves exchange_records as the normalized shell identity and
-- extends rfx_records with lifecycle/workflow data needed by the RFx lens.

ALTER TABLE rfx_records
  ADD COLUMN IF NOT EXISTS solicitation_number text,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'external',
  ADD COLUMN IF NOT EXISTS lifecycle_status text NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS issued_at timestamptz,
  ADD COLUMN IF NOT EXISTS performance_geography jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS estimated_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS scope jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS deliverables jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS response_requirements jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS evaluation_method jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS external_submission_required boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS rfx_watches (
  rfx_record_id uuid NOT NULL REFERENCES rfx_records(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (rfx_record_id, organization_id)
);

DO $$
BEGIN
  CREATE TYPE rfx_pursuit_state AS ENUM (
    'discovered',
    'watching',
    'assessing',
    'declined',
    'pursuing',
    'teaming',
    'drafting',
    'ready',
    'submitted',
    'withdrawn',
    'clarification',
    'selected',
    'not_selected',
    'executing',
    'outcome_reported'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS rfx_pursuits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rfx_record_id uuid NOT NULL REFERENCES rfx_records(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  state rfx_pursuit_state NOT NULL DEFAULT 'discovered',
  decision_reason text,
  gap_summary jsonb NOT NULL DEFAULT '[]'::jsonb,
  started_at timestamptz,
  submitted_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rfx_record_id, organization_id)
);

CREATE TABLE IF NOT EXISTS rfx_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rfx_record_id uuid NOT NULL REFERENCES rfx_records(id) ON DELETE CASCADE,
  requirement_key text NOT NULL,
  label text NOT NULL,
  requirement_kind text NOT NULL,
  mandatory boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (rfx_record_id, requirement_key)
);

CREATE TABLE IF NOT EXISTS rfx_addenda (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rfx_record_id uuid NOT NULL REFERENCES rfx_records(id) ON DELETE CASCADE,
  version integer NOT NULL,
  summary text NOT NULL,
  published_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (rfx_record_id, version)
);

CREATE TABLE IF NOT EXISTS rfx_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rfx_record_id uuid NOT NULL REFERENCES rfx_records(id) ON DELETE CASCADE,
  respondent_organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'draft',
  response_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  submitted_at timestamptz,
  external_submission_reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rfx_record_id, respondent_organization_id)
);

CREATE INDEX IF NOT EXISTS rfx_records_due_idx ON rfx_records(due_at);
CREATE INDEX IF NOT EXISTS rfx_records_status_idx ON rfx_records(lifecycle_status);
CREATE INDEX IF NOT EXISTS rfx_pursuits_org_state_idx ON rfx_pursuits(organization_id, state);
CREATE INDEX IF NOT EXISTS rfx_responses_rfx_status_idx ON rfx_responses(rfx_record_id, status);
