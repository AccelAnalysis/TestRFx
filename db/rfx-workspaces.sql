-- RFxchange RFx workflow persistence.
-- Workspaces are scoped by record + perspective + active organization so
-- multiple responder organizations can work against the same RFx without
-- sharing response state. Canonical solicitation/response truth remains in
-- the normalized RFx tables.

CREATE TABLE IF NOT EXISTS rfx_workspaces (
  record_id text NOT NULL,
  perspective text NOT NULL CHECK (perspective IN ('issuer', 'responder')),
  organization_id text,
  entry text NOT NULL,
  state jsonb NOT NULL,
  version integer NOT NULL DEFAULT 1,
  created_by_user_id text,
  updated_by_user_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE rfx_workspaces ADD COLUMN IF NOT EXISTS organization_id text;
ALTER TABLE rfx_workspaces ADD COLUMN IF NOT EXISTS created_by_user_id text;
ALTER TABLE rfx_workspaces ADD COLUMN IF NOT EXISTS updated_by_user_id text;
ALTER TABLE rfx_workspaces DROP CONSTRAINT IF EXISTS rfx_workspaces_pkey;
CREATE UNIQUE INDEX IF NOT EXISTS rfx_workspaces_org_unique
  ON rfx_workspaces(record_id, perspective, organization_id);

CREATE TABLE IF NOT EXISTS rfx_workspace_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  record_id text NOT NULL,
  perspective text NOT NULL,
  organization_id text,
  actor_user_id text,
  event_name text NOT NULL,
  workspace_version integer NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE rfx_workspace_events ADD COLUMN IF NOT EXISTS organization_id text;
ALTER TABLE rfx_workspace_events ADD COLUMN IF NOT EXISTS actor_user_id text;
CREATE INDEX IF NOT EXISTS rfx_workspace_events_record_idx
  ON rfx_workspace_events(record_id, perspective, organization_id, occurred_at DESC);
