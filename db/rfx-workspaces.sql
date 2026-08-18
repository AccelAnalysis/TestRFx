-- RFxchange RFx workflow persistence.
-- The workflow service persists the nested issuer/responder workspace as one
-- versioned JSONB state while the normalized RFx tables continue to own
-- solicitation, requirement, response, addendum, and outcome truth.

CREATE TABLE IF NOT EXISTS rfx_workspaces (
  record_id text NOT NULL,
  perspective text NOT NULL CHECK (perspective IN ('issuer', 'responder')),
  entry text NOT NULL,
  state jsonb NOT NULL,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (record_id, perspective)
);

CREATE TABLE IF NOT EXISTS rfx_workspace_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  record_id text NOT NULL,
  perspective text NOT NULL,
  event_name text NOT NULL,
  workspace_version integer NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rfx_workspace_events_record_idx
  ON rfx_workspace_events(record_id, perspective, occurred_at DESC);
