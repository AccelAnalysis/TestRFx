-- RFxchange Identity & Onboarding Shell: Organization Selection / Creation persistence.
-- Apply after db/schema.sql, db/identity-verification.sql, and db/organization-profile.sql.
-- This extension provides real organization entity resolution, invitations, claims,
-- access requests, authority evidence, resumable onboarding state, and one-primary-org rules.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS organization_identity (
  organization_id uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  organization_type text NOT NULL DEFAULT 'Other',
  website text,
  primary_domain text,
  claim_state text NOT NULL DEFAULT 'unclaimed' CHECK (claim_state IN ('unclaimed', 'claimed', 'verified')),
  created_source text NOT NULL DEFAULT 'onboarding',
  created_by_user_id uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS organization_identity_domain_idx ON organization_identity(lower(primary_domain));
CREATE INDEX IF NOT EXISTS organizations_name_trgm_idx ON organizations USING gin (lower(name) gin_trgm_ops);

CREATE TABLE IF NOT EXISTS organization_aliases (
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  alias text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, alias)
);
CREATE INDEX IF NOT EXISTS organization_aliases_trgm_idx ON organization_aliases USING gin (lower(alias) gin_trgm_ops);

ALTER TABLE organization_memberships
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS is_primary boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS organization_memberships_one_primary_idx
  ON organization_memberships(user_id)
  WHERE is_primary AND status = 'active';

CREATE TABLE IF NOT EXISTS platform_user_roles (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('platform_admin')),
  permissions jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role)
);

CREATE TABLE IF NOT EXISTS organization_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  inviter_user_id uuid REFERENCES users(id),
  invited_email text NOT NULL,
  role text NOT NULL,
  token_hash bytea NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  source_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS organization_invitations_email_status_idx
  ON organization_invitations(lower(invited_email), status, expires_at DESC);

CREATE TABLE IF NOT EXISTS organization_join_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  requester_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  requested_role text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'cancelled')),
  acquisition_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by_user_id uuid REFERENCES users(id)
);
CREATE UNIQUE INDEX IF NOT EXISTS organization_join_requests_one_pending_idx
  ON organization_join_requests(organization_id, requester_user_id)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS organization_join_requests_org_status_idx
  ON organization_join_requests(organization_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS organization_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  claimant_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  authority_method text NOT NULL CHECK (authority_method IN ('domain_email', 'registry_record', 'supporting_document', 'manual_review')),
  evidence_note text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'conflict')),
  acquisition_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by_user_id uuid REFERENCES users(id)
);
CREATE UNIQUE INDEX IF NOT EXISTS organization_claims_one_active_per_claimant_idx
  ON organization_claims(organization_id, claimant_user_id)
  WHERE status IN ('pending', 'conflict');
CREATE INDEX IF NOT EXISTS organization_claims_org_status_idx
  ON organization_claims(organization_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS organization_claim_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL REFERENCES organization_claims(id) ON DELETE CASCADE,
  evidence_type text NOT NULL CHECK (evidence_type IN ('registry_record', 'supporting_document', 'authority_note')),
  label text,
  evidence_reference text,
  evidence_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (evidence_url IS NULL OR evidence_url ~ '^https://')
);
CREATE INDEX IF NOT EXISTS organization_claim_evidence_claim_idx
  ON organization_claim_evidence(claim_id, created_at ASC);

CREATE TABLE IF NOT EXISTS organization_onboarding_state (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
  resolution_mode text CHECK (resolution_mode IN ('claim', 'join', 'create', 'invitation')),
  membership_state text CHECK (membership_state IN ('active', 'pending-approval', 'authority-pending')),
  authority_state text CHECK (authority_state IN ('invited', 'admin-approved', 'domain-verified', 'self-attested', 'pending-review')),
  organization_role text,
  current_step text NOT NULL DEFAULT 'welcome',
  request_id uuid,
  claim_id uuid,
  acquisition_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE organization_identity IS
  'Minimum canonical organization identity required before Geography and Organization Profile enrichment.';
COMMENT ON TABLE organization_onboarding_state IS
  'Durable resume state for Organization Selection / Creation. Browser session storage is not authoritative.';
COMMENT ON TABLE organization_invitations IS
  'Organization invitation tokens are stored only as SHA-256 hashes; raw tokens must not be persisted.';
COMMENT ON TABLE organization_claim_evidence IS
  'Evidence references used for organization authority review. HTTPS references are persisted; files themselves belong in approved object storage.';
COMMENT ON TABLE platform_user_roles IS
  'Platform-level authorization for exceptional onboarding workflows such as competing organization-claim review.';
