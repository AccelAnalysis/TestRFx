export const ORGANIZATION_LINKED_VIDEO_MAX_SECONDS = 30;
export const ORGANIZATION_UPLOAD_VIDEO_MAX_SECONDS = 15;

export type ApprovedVideoProvider = "youtube" | "vimeo";

export interface ApprovedVideoLink {
  provider: ApprovedVideoProvider;
  videoId: string;
  canonicalUrl: string;
  embedUrl: string;
  thumbnailUrl?: string;
}

const YOUTUBE_ID = /^[A-Za-z0-9_-]{6,32}$/;
const VIMEO_ID = /^\d{5,20}$/;

function youtubeId(url: URL) {
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (host === "youtu.be") return url.pathname.split("/").filter(Boolean)[0];
  if (host !== "youtube.com" && host !== "m.youtube.com") return undefined;
  if (url.pathname === "/watch") return url.searchParams.get("v") ?? undefined;
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts[0] === "shorts" || parts[0] === "embed" || parts[0] === "live") return parts[1];
  return undefined;
}

function vimeoId(url: URL) {
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (host !== "vimeo.com" && host !== "player.vimeo.com") return undefined;
  const parts = url.pathname.split("/").filter(Boolean);
  if (host === "player.vimeo.com" && parts[0] === "video") return parts[1];
  return [...parts].reverse().find((part) => VIMEO_ID.test(part));
}

export function buildApprovedVideoEmbedUrl(provider: ApprovedVideoProvider, videoId: string) {
  if (provider === "youtube") {
    if (!YOUTUBE_ID.test(videoId)) return undefined;
    return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&playsinline=1&autoplay=1`;
  }
  if (!VIMEO_ID.test(videoId)) return undefined;
  return `https://player.vimeo.com/video/${videoId}?dnt=1&title=0&byline=0&portrait=0&autoplay=1`;
}

export function parseApprovedVideoUrl(value: string): ApprovedVideoLink | undefined {
  const input = value.trim();
  if (!input) return undefined;
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return undefined;
  }
  if (url.protocol !== "https:") return undefined;

  const youtube = youtubeId(url);
  if (youtube && YOUTUBE_ID.test(youtube)) {
    return {
      provider: "youtube",
      videoId: youtube,
      canonicalUrl: `https://www.youtube.com/watch?v=${youtube}`,
      embedUrl: buildApprovedVideoEmbedUrl("youtube", youtube)!,
      thumbnailUrl: `https://i.ytimg.com/vi/${youtube}/hqdefault.jpg`,
    };
  }

  const vimeo = vimeoId(url);
  if (vimeo && VIMEO_ID.test(vimeo)) {
    return {
      provider: "vimeo",
      videoId: vimeo,
      canonicalUrl: `https://vimeo.com/${vimeo}`,
      embedUrl: buildApprovedVideoEmbedUrl("vimeo", vimeo)!,
    };
  }

  return undefined;
}

export function approvedVideoProviderLabel(provider: ApprovedVideoProvider) {
  return provider === "youtube" ? "YouTube" : "Vimeo";
}
