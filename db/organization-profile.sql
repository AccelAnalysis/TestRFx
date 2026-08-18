-- Identity & Onboarding -> Organization Profile.
-- Apply after db/schema.sql and db/geography-extension.sql.
-- This migration is the canonical persistence target for the profile workspace;
-- Geography remains authoritative for physical address, map point, privacy, and service geography.

CREATE TABLE IF NOT EXISTS organization_profiles (
  organization_id uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  legal_name text,
  description text NOT NULL DEFAULT '',
  website text,
  primary_domain text,
  industries jsonb NOT NULL DEFAULT '[]'::jsonb,
  industry_codes jsonb NOT NULL DEFAULT '[]'::jsonb,
  organization_roles text[] NOT NULL DEFAULT '{}',
  onboarding_goals text[] NOT NULL DEFAULT '{}',
  brand_name text,
  logo_url text,
  profile_status text NOT NULL DEFAULT 'in_progress' CHECK (profile_status IN ('in_progress', 'complete', 'enriched')),
  visibility jsonb NOT NULL DEFAULT '{"searchable": true, "mapVisible": true, "publicContact": false}'::jsonb,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE organization_profiles ADD COLUMN IF NOT EXISTS brand_name text;
ALTER TABLE organization_profiles ADD COLUMN IF NOT EXISTS logo_url text;

-- Older Organization Profile builds stored a plain-language capability seed here.
-- Capability claims now belong to Capability Enrichment, so preserve the legacy column
-- only for compatibility and remove it as a Profile Complete requirement.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'organization_profiles'
      AND column_name = 'capability_seed'
  ) THEN
    EXECUTE 'ALTER TABLE organization_profiles ALTER COLUMN capability_seed DROP NOT NULL';
    COMMENT ON COLUMN organization_profiles.capability_seed IS
      'Legacy compatibility only. New capability claims are owned by Capability Enrichment.';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS organization_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contact_name text NOT NULL,
  title text,
  email text NOT NULL,
  phone text,
  is_primary boolean NOT NULL DEFAULT false,
  public_visibility boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS organization_contacts_one_primary_idx
  ON organization_contacts(organization_id)
  WHERE is_primary;

CREATE TABLE IF NOT EXISTS organization_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  field_key text NOT NULL,
  field_label text NOT NULL,
  value text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'verified', 'rejected', 'expired')),
  source text,
  verified_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS organization_verifications_org_status_idx
  ON organization_verifications(organization_id, status, field_key);

CREATE TABLE IF NOT EXISTS organization_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL,
  permissions jsonb NOT NULL DEFAULT '[]'::jsonb,
  token_hash bytea NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
  invited_by_user_id uuid NOT NULL REFERENCES users(id),
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > created_at)
);
CREATE INDEX IF NOT EXISTS organization_invitations_org_status_idx
  ON organization_invitations(organization_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS organization_invitations_email_idx
  ON organization_invitations(lower(email), status);

-- Geography is deliberately not duplicated here. These are the canonical owners:
--   locations.address / normalized_address -> physical address
--   locations.point                         -> confirmed map point
--   locations.visibility                    -> exact/approximate/locality-only privacy
--   organization_geographies                -> primary/service/branch geography relationships

CREATE INDEX IF NOT EXISTS organization_profiles_status_idx ON organization_profiles(profile_status);
CREATE INDEX IF NOT EXISTS organization_profiles_roles_gin ON organization_profiles USING gin(organization_roles);
CREATE INDEX IF NOT EXISTS organization_profiles_goals_gin ON organization_profiles USING gin(onboarding_goals);
