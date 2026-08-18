-- Source-required recipient referral policy / fee lookup used by cross-lens referrals.
-- This stores the organization's published policy as governed JSON rather than inventing
-- a platform-wide fee structure. Commercial settlement remains owned by billing/referrals.

CREATE TABLE IF NOT EXISTS referral_policies (
  organization_id uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  policy jsonb NOT NULL DEFAULT '{}'::jsonb,
  fee jsonb NOT NULL DEFAULT '{}'::jsonb,
  published_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS referral_policies_published_idx
  ON referral_policies(published_at)
  WHERE published_at IS NOT NULL;
