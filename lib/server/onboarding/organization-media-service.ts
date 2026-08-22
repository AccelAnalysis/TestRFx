import { getDatabase } from "@/lib/server/database";
import {
  ORGANIZATION_LINKED_VIDEO_MAX_SECONDS,
  ORGANIZATION_UPLOAD_VIDEO_MAX_SECONDS,
  parseApprovedVideoUrl,
} from "@/lib/media/approved-video";
import type { OrganizationIntroVideo } from "@/lib/onboarding/organization-profile";
import { assertOrganizationProfilePermission, type OnboardingActor } from "./actor";

export type OrganizationMediaSnapshot = {
  logoUrl: string;
  introVideo: OrganizationIntroVideo | null;
  linkedVideo: {
    providers: readonly ["youtube", "vimeo"];
    maxSeconds: number;
  };
  uploadVideo: {
    enabled: false;
    maxSeconds: number;
  };
};

function asStatus(value: string): "pending" | "ready" {
  return value === "ready" ? "ready" : "pending";
}

function cleanLogoUrl(value: string) {
  const candidate = value.trim().slice(0, 500);
  if (!candidate) return "";
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error();
    return parsed.toString();
  } catch {
    throw new Error("Enter a valid logo URL.");
  }
}

export async function getOrganizationMedia(actor: OnboardingActor): Promise<OrganizationMediaSnapshot> {
  const sql = getDatabase();
  const rows = await sql<{
    logo_url: string | null;
    source_type: "linked" | "uploaded" | null;
    provider: "youtube" | "vimeo" | "rfxchange" | null;
    provider_video_id: string | null;
    canonical_url: string | null;
    poster_url: string | null;
    storage_key: string | null;
    playback_url: string | null;
    duration_seconds: number | null;
    status: "pending" | "ready" | "rejected" | null;
  }[]>`
    SELECT
      op.logo_url,
      om.source_type,
      om.provider,
      om.provider_video_id,
      om.canonical_url,
      om.poster_url,
      om.storage_key,
      om.playback_url,
      om.duration_seconds,
      om.status
    FROM organizations o
    LEFT JOIN organization_profiles op ON op.organization_id = o.id
    LEFT JOIN organization_media om
      ON om.organization_id = o.id
      AND om.media_role = 'intro_video'
    WHERE o.id = ${actor.organizationId}::uuid
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) throw new Error("Organization media is unavailable.");

  let introVideo: OrganizationIntroVideo | null = null;
  if (row.status !== "rejected" && row.source_type === "linked" && (row.provider === "youtube" || row.provider === "vimeo") && row.provider_video_id && row.canonical_url) {
    introVideo = {
      source: "linked",
      provider: row.provider,
      videoId: row.provider_video_id,
      canonicalUrl: row.canonical_url,
      posterUrl: row.poster_url ?? undefined,
      durationSeconds: row.duration_seconds ?? undefined,
      status: asStatus(row.status ?? "pending"),
    };
  } else if (row.status !== "rejected" && row.source_type === "uploaded" && row.provider === "rfxchange" && row.storage_key && row.duration_seconds) {
    introVideo = {
      source: "uploaded",
      provider: "rfxchange",
      storageKey: row.storage_key,
      playbackUrl: row.playback_url ?? undefined,
      posterUrl: row.poster_url ?? undefined,
      durationSeconds: row.duration_seconds,
      status: asStatus(row.status ?? "pending"),
    };
  }

  return {
    logoUrl: row.logo_url ?? "",
    introVideo,
    linkedVideo: { providers: ["youtube", "vimeo"], maxSeconds: ORGANIZATION_LINKED_VIDEO_MAX_SECONDS },
    uploadVideo: { enabled: false, maxSeconds: ORGANIZATION_UPLOAD_VIDEO_MAX_SECONDS },
  };
}

export async function saveOrganizationLogo(actor: OnboardingActor, value: string) {
  assertOrganizationProfilePermission(actor);
  const logoUrl = cleanLogoUrl(value);
  const sql = getDatabase();
  await sql`
    INSERT INTO organization_profiles (organization_id, logo_url, updated_at)
    VALUES (${actor.organizationId}::uuid, ${logoUrl || null}, now())
    ON CONFLICT (organization_id) DO UPDATE SET
      logo_url = EXCLUDED.logo_url,
      updated_at = now()
  `;
  await sql`
    INSERT INTO activity_events (event_name, actor_user_id, organization_id, payload)
    VALUES ('OrganizationLogoUpdated', ${actor.userId}::uuid, ${actor.organizationId}::uuid, ${JSON.stringify({ hasLogo: Boolean(logoUrl) })}::jsonb)
  `;
  return getOrganizationMedia(actor);
}

export async function saveLinkedOrganizationIntroVideo(actor: OnboardingActor, value: string) {
  assertOrganizationProfilePermission(actor);
  const parsed = parseApprovedVideoUrl(value);
  if (!parsed) throw new Error("Use a YouTube or Vimeo video link.");

  const sql = getDatabase();
  await sql`
    INSERT INTO organization_media (
      organization_id, media_role, source_type, provider, provider_video_id,
      canonical_url, poster_url, status, updated_at
    ) VALUES (
      ${actor.organizationId}::uuid,
      'intro_video',
      'linked',
      ${parsed.provider},
      ${parsed.videoId},
      ${parsed.canonicalUrl},
      ${parsed.thumbnailUrl ?? null},
      'pending',
      now()
    )
    ON CONFLICT (organization_id, media_role) DO UPDATE SET
      source_type = EXCLUDED.source_type,
      provider = EXCLUDED.provider,
      provider_video_id = EXCLUDED.provider_video_id,
      canonical_url = EXCLUDED.canonical_url,
      poster_url = COALESCE(EXCLUDED.poster_url, organization_media.poster_url),
      storage_key = NULL,
      playback_url = NULL,
      duration_seconds = CASE
        WHEN organization_media.provider = EXCLUDED.provider
          AND organization_media.provider_video_id = EXCLUDED.provider_video_id
          AND organization_media.status = 'ready'
        THEN organization_media.duration_seconds
        ELSE NULL
      END,
      status = CASE
        WHEN organization_media.provider = EXCLUDED.provider
          AND organization_media.provider_video_id = EXCLUDED.provider_video_id
          AND organization_media.status = 'ready'
        THEN 'ready'
        ELSE 'pending'
      END,
      updated_at = now()
  `;

  await sql`
    INSERT INTO activity_events (event_name, actor_user_id, organization_id, payload)
    VALUES (
      'OrganizationIntroVideoLinked',
      ${actor.userId}::uuid,
      ${actor.organizationId}::uuid,
      ${JSON.stringify({ provider: parsed.provider, videoId: parsed.videoId })}::jsonb
    )
  `;

  return getOrganizationMedia(actor);
}

export async function removeOrganizationIntroVideo(actor: OnboardingActor) {
  assertOrganizationProfilePermission(actor);
  const sql = getDatabase();
  await sql`
    DELETE FROM organization_media
    WHERE organization_id = ${actor.organizationId}::uuid
      AND media_role = 'intro_video'
  `;
  await sql`
    INSERT INTO activity_events (event_name, actor_user_id, organization_id, payload)
    VALUES ('OrganizationIntroVideoRemoved', ${actor.userId}::uuid, ${actor.organizationId}::uuid, '{}'::jsonb)
  `;
  return getOrganizationMedia(actor);
}
