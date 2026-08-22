-- Canonical organization-owned media used by Organization Profile and Exchange card projections.
-- Apply after db/organization-profile.sql.

CREATE TABLE IF NOT EXISTS organization_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  media_role text NOT NULL CHECK (media_role IN ('intro_video')),
  source_type text NOT NULL CHECK (source_type IN ('linked', 'uploaded')),
  provider text NOT NULL CHECK (provider IN ('youtube', 'vimeo', 'rfxchange')),
  provider_video_id text,
  canonical_url text,
  poster_url text,
  storage_key text,
  playback_url text,
  duration_seconds integer CHECK (duration_seconds IS NULL OR duration_seconds > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready', 'rejected')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, media_role),
  CHECK (
    (source_type = 'linked' AND provider IN ('youtube', 'vimeo') AND provider_video_id IS NOT NULL AND canonical_url IS NOT NULL AND storage_key IS NULL)
    OR
    (source_type = 'uploaded' AND provider = 'rfxchange' AND storage_key IS NOT NULL)
  ),
  CHECK (
    (source_type = 'linked' AND (duration_seconds IS NULL OR duration_seconds <= 30))
    OR
    (source_type = 'uploaded' AND duration_seconds IS NOT NULL AND duration_seconds <= 15)
  )
);

CREATE INDEX IF NOT EXISTS organization_media_org_status_idx
  ON organization_media (organization_id, status, media_role);

COMMENT ON TABLE organization_media IS
  'Organization-owned media. Linked intro videos are provider-allowlisted; direct uploads are reserved for the RFxchange media pipeline.';
COMMENT ON COLUMN organization_media.status IS
  'pending until provider/storage metadata verifies duration and playback; only ready media should project to Exchange cards.';
