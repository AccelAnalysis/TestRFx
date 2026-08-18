-- Optional sponsored placement projection for Exchange drawer results.
-- No placements are seeded here. A record is rendered as sponsored only when a
-- real, active placement exists for that Exchange record.

CREATE TABLE IF NOT EXISTS sponsored_placements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exchange_record_id uuid NOT NULL REFERENCES exchange_records(id) ON DELETE CASCADE,
  sponsor_organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'scheduled',
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  placement_rank integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status IN ('scheduled', 'active', 'paused', 'ended')),
  CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS sponsored_placements_active_record_idx
  ON sponsored_placements(exchange_record_id, starts_at, ends_at)
  WHERE status = 'active';
