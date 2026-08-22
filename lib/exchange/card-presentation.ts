import type {
  ExchangeCardMedia,
  ExchangeCardMediaKind,
  ExchangeCardPlacement,
  ExchangeCardStatus,
  ExchangeRecord,
} from "./contracts";

export interface ResolvedExchangeCardMedia {
  kind: ExchangeCardMediaKind;
  label: string;
  src?: string;
  poster?: string;
  videoSrc?: string;
  alt: string;
  attribution?: string;
  ownerLabel?: string;
  fallback: boolean;
}

export interface ExchangeCardPresentation {
  title: string;
  subtitle?: string;
  contextLine?: string;
  classifications: string[];
  media: ResolvedExchangeCardMedia;
  placement: ExchangeCardPlacement;
  status?: ExchangeCardStatus;
  detailLabel: "Details" | "Profile";
}

const fallbackLabels: Record<ExchangeRecord["type"], string> = {
  rfx: "RFx opportunity",
  resource: "Resource listing",
  intelligence: "Exchange intelligence",
  capability: "Organization capability",
};

function normalized(value?: string) {
  return value?.trim().toLowerCase() ?? "";
}

function compact(items: Array<string | undefined>) {
  return items.map((item) => item?.trim()).filter((item): item is string => Boolean(item));
}

function unique(items: string[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = normalized(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function hasVisualSource(media?: ExchangeCardMedia) {
  return Boolean(media?.src || media?.poster);
}

function mediaAlt(record: ExchangeRecord, media?: ExchangeCardMedia) {
  if (media?.alt?.trim()) return media.alt.trim();
  if (media?.kind === "logo") return `${record.organization} logo`;
  if (media?.kind === "visualization") return `${record.title} visualization`;
  if (media?.kind === "video") return `${record.title} video preview`;
  return `${record.title} preview image`;
}

function resolvedMedia(record: ExchangeRecord): ResolvedExchangeCardMedia {
  const featured = record.card?.media;
  const organizationHero = record.card?.organizationMedia?.hero;
  const organizationLogo = record.card?.organizationMedia?.logo;

  const candidates: Array<ExchangeCardMedia | undefined> = [
    featured?.kind === "video" ? featured : undefined,
    featured && (featured.kind === "image" || featured.kind === "visualization") ? featured : undefined,
    hasVisualSource(organizationHero) ? organizationHero : undefined,
    featured?.kind === "logo" ? featured : undefined,
    hasVisualSource(organizationLogo) ? organizationLogo : undefined,
  ];

  const media = candidates.find(Boolean);
  if (media) {
    return {
      kind: media.kind,
      label: media.label,
      src: media.src,
      poster: media.poster,
      videoSrc: media.videoSrc,
      alt: mediaAlt(record, media),
      attribution: media.attribution,
      ownerLabel: media.ownerLabel,
      fallback: false,
    };
  }

  return {
    kind: "category",
    label: featured?.label?.trim() || fallbackLabels[record.type],
    alt: "",
    fallback: true,
  };
}

function metadataMatching(record: ExchangeRecord, matcher: RegExp) {
  return record.metadata.find((item) => matcher.test(item));
}

function metadataClassifications(record: ExchangeRecord) {
  return record.metadata.filter((item) => {
    const value = normalized(item);
    if (!value) return false;
    if (/^due\b/i.test(item)) return false;
    if (/\b(day|week|month|updated|current|view)\b/i.test(item)) return false;
    if (/^(source:|off-map|sponsored|available|limited|scheduled)/i.test(item)) return false;
    if (/^\$/.test(item)) return false;
    if (/\bamacs mapped\b/i.test(item)) return false;
    return true;
  });
}

function classificationsFor(record: ExchangeRecord) {
  const preferred = record.card?.classifications ?? [];
  const values = unique([...preferred, ...metadataClassifications(record)]).filter((item) => {
    if (normalized(item) === normalized(record.title)) return false;
    if (normalized(item) === normalized(record.organization)) return false;
    if (/\bamacs mapped\b/i.test(item)) return false;
    return true;
  });
  return values.slice(0, 2);
}

function geographyWithDistance(record: ExchangeRecord) {
  return compact([record.geography, record.card?.distance]).join(" · ");
}

export function buildCardPresentation(record: ExchangeRecord): ExchangeCardPresentation {
  const placement = record.card?.placement ?? (record.featured ? "featured" : "organic");
  const status = record.card?.status;
  const media = resolvedMedia(record);
  const classifications = classificationsFor(record);

  if (record.type === "capability") {
    return {
      title: record.organization,
      subtitle: record.title,
      contextLine: geographyWithDistance(record) || undefined,
      classifications,
      media,
      placement,
      status,
      detailLabel: "Profile",
    };
  }

  if (record.type === "resource") {
    const availability = record.resource?.availabilityLabel ?? status?.label;
    return {
      title: record.title,
      subtitle: record.organization,
      contextLine: compact([availability, geographyWithDistance(record)]).join(" · ") || undefined,
      classifications,
      media,
      placement,
      status,
      detailLabel: "Details",
    };
  }

  if (record.type === "intelligence") {
    const recency = metadataMatching(record, /\b(\d+[- ]day|\d+[- ]week|\d+[- ]month|updated|current|today|recent)\b/i) ?? status?.label;
    return {
      title: record.title,
      subtitle: record.organization,
      contextLine: compact([record.geography, recency]).join(" · ") || undefined,
      classifications,
      media,
      placement,
      status,
      detailLabel: "Details",
    };
  }

  const due = metadataMatching(record, /^due\b/i);
  return {
    title: record.title,
    subtitle: record.organization,
    contextLine: compact([due, geographyWithDistance(record)]).join(" · ") || undefined,
    classifications,
    media,
    placement,
    status,
    detailLabel: "Details",
  };
}
