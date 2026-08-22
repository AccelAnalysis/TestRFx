-- RFxchange Resources runtime extension.
-- Apply after db/schema.sql and db/shared-workflows.sql.
--
-- Resources owns Resource offers/requests/shares. Cross-lens Save/Follow/Watch/Track,
-- referrals, collaboration, share links, and match provenance remain shared services.

ALTER TABLE resources ALTER COLUMN resource_mode SET DEFAULT 'offer';
ALTER TABLE resources ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS availability_state text;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS availability_label text;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS capacity text;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS service_area_label text;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'off-map';
ALTER TABLE resources ADD COLUMN IF NOT EXISTS terms text;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
ALTER TABLE resources ADD COLUMN IF NOT EXISTS sponsored boolean NOT NULL DEFAULT false;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE resources ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$ BEGIN
  ALTER TABLE resources ADD CONSTRAINT resources_availability_state_check
    CHECK (availability_state IS NULL OR availability_state IN ('available', 'limited', 'scheduled'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE resources ADD CONSTRAINT resources_visibility_check
    CHECK (visibility IN ('public-location', 'service-area', 'off-map'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE resources ADD CONSTRAINT resources_status_check
    CHECK (status IN ('active', 'archived'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS resources_status_idx ON resources(status, availability_state);
CREATE INDEX IF NOT EXISTS resources_category_idx ON resources(category);

CREATE TABLE IF NOT EXISTS resource_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exchange_record_id uuid NOT NULL REFERENCES exchange_records(id) ON DELETE CASCADE,
  requester_organization_id uuid NOT NULL REFERENCES organizations(id),
  requester_user_id uuid NOT NULL REFERENCES users(id),
  scope text NOT NULL,
  needed_by date,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'connected', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS resource_requests_record_idx ON resource_requests(exchange_record_id, created_at DESC);
CREATE INDEX IF NOT EXISTS resource_requests_requester_idx ON resource_requests(requester_organization_id, created_at DESC);

CREATE TABLE IF NOT EXISTS resource_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exchange_record_id uuid NOT NULL REFERENCES exchange_records(id) ON DELETE CASCADE,
  sender_organization_id uuid NOT NULL REFERENCES organizations(id),
  sender_user_id uuid NOT NULL REFERENCES users(id),
  recipient_organization_id uuid NOT NULL REFERENCES organizations(id),
  message text,
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'viewed', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS resource_shares_record_idx ON resource_shares(exchange_record_id, created_at DESC);
CREATE INDEX IF NOT EXISTS resource_shares_recipient_idx ON resource_shares(recipient_organization_id, created_at DESC);

CREATE TABLE IF NOT EXISTS referral_policies (
  organization_id uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  policy_summary text,
  fee_summary text,
  active boolean NOT NULL DEFAULT true,
  rules jsonb NOT NULL DEFAULT '[]'::jsonb,
  eligibility_criteria jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE referrals ADD COLUMN IF NOT EXISTS policy_snapshot jsonb;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS fee_snapshot jsonb;
CREATE INDEX IF NOT EXISTS referrals_sender_idx ON referrals(sender_organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS referrals_recipient_idx ON referrals(recipient_organization_id, created_at DESC);

COMMENT ON TABLE resource_requests IS 'Transactional requests against canonical Resource offers; not public Exchange listings.';
COMMENT ON TABLE resource_shares IS 'Resources-specific send-to-organization delivery records. Generic share links remain in shared-workflows.sql.';
COMMENT ON TABLE referral_policies IS 'Organization-published referral policy/fee disclosure read by the shared referral service before creation.';
