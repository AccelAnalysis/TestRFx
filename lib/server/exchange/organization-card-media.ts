import type { ExchangeCardOrganizationMedia } from "@/lib/exchange/contracts";

export type OrganizationCardMediaRow = {
  logo_url?: string | null;
  media_source_type?: "linked" | "uploaded" | null;
  media_provider?: "youtube" | "vimeo" | "rfxchange" | null;
  media_provider_video_id?: string | null;
  media_poster_url?: string | null;
  media_playback_url?: string | null;
  media_status?: "pending" | "ready" | "rejected" | null;
};

export function organizationCardMedia(row: OrganizationCardMediaRow, organizationName: string): ExchangeCardOrganizationMedia | undefined {
  const logoUrl = row.logo_url?.trim();
  const ready = row.media_status === "ready";

  const hero = ready && row.media_source_type === "linked" && (row.media_provider === "youtube" || row.media_provider === "vimeo") && row.media_provider_video_id
    ? {
        kind: "video" as const,
        label: "Organization introduction",
        poster: row.media_poster_url ?? undefined,
        videoProvider: row.media_provider,
        providerVideoId: row.media_provider_video_id,
        alt: `${organizationName} introduction video`,
        ownerLabel: organizationName,
      }
    : ready && row.media_source_type === "uploaded" && row.media_provider === "rfxchange" && row.media_playback_url
      ? {
          kind: "video" as const,
          label: "Organization introduction",
          poster: row.media_poster_url ?? undefined,
          videoSrc: row.media_playback_url,
          videoProvider: "rfxchange" as const,
          alt: `${organizationName} introduction video`,
          ownerLabel: organizationName,
        }
      : undefined;

  const logo = logoUrl
    ? {
        kind: "logo" as const,
        label: `${organizationName} logo`,
        src: logoUrl,
        alt: `${organizationName} logo`,
        ownerLabel: organizationName,
      }
    : undefined;

  return hero || logo ? { hero, logo } : undefined;
}
