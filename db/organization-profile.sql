-- Organization Profile extension for the RFxchange reference schema.
-- Apply alongside db/schema.sql in a production migration system.
-- Organization account/tenancy remains in organizations + organization_memberships;
-- this table stores the Exchange-facing canonical organization profile.

CREATE TABLE organization_profiles (
  organization_id uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  legal_name text,
  description text NOT NULL,
  website text,
  primary_domain text,
  industries jsonb NOT NULL DEFAULT '[]'::jsonb,
  industry_codes jsonb NOT NULL DEFAULT '[]'::jsonb,
  organization_roles text[] NOT NULL DEFAULT '{}',
  onboarding_goals text[] NOT NULL DEFAULT '{}',
  capability_seed text NOT NULL,
  profile_status text NOT NULL DEFAULT 'in_progress' CHECK (profile_status IN ('in_progress', 'complete', 'enriched')),
  visibility jsonb NOT NULL DEFAULT '{"searchable": true, "mapVisible": true, "publicContact": false, "locationPrecision": "locality"}'::jsonb,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE organization_contacts (
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
CREATE UNIQUE INDEX organization_contacts_one_primary_idx
  ON organization_contacts(organization_id)
  WHERE is_primary;

-- Existing locations remains the authoritative geography store:
-- address -> locations.address
-- confirmed geocode -> locations.point
-- service territory -> locations.service_area
-- Public location precision belongs in organization_profiles.visibility and must not
-- overwrite the authoritative internal location.

CREATE INDEX organization_profiles_status_idx ON organization_profiles(profile_status);
CREATE INDEX organization_profiles_roles_gin ON organization_profiles USING gin(organization_roles);
CREATE INDEX organization_profiles_goals_gin ON organization_profiles USING gin(onboarding_goals);
