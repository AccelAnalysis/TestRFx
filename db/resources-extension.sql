-- Additive Resources domain extension for the RFxchange operating chassis.
-- Keeps exchange_records as the normalized shell identity and extends the
-- existing resources domain without rewriting the canonical base schema.

ALTER TABLE resources
  ALTER COLUMN resource_mode SET DEFAULT 'offer',
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS capacity jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public-location',
  ADD COLUMN IF NOT EXISTS terms jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE INDEX IF NOT EXISTS resources_category_idx ON resources(category);
CREATE INDEX IF NOT EXISTS resources_active_idx ON resources(exchange_record_id) WHERE archived_at IS NULL;

CREATE TABLE IF NOT EXISTS resource_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id uuid NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  requester_organization_id uuid NOT NULL REFERENCES organizations(id),
  provider_organization_id uuid NOT NULL REFERENCES organizations(id),
  requester_user_id uuid REFERENCES users(id),
  request_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'requested',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS resource_requests_resource_idx ON resource_requests(resource_id, created_at DESC);
CREATE INDEX IF NOT EXISTS resource_requests_provider_idx ON resource_requests(provider_organization_id, status, created_at DESC);
