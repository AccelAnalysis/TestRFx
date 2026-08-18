import {
  publicContentCatalog,
  type PublicAudience,
  type PublicContentItem,
  type PublicContentTopic,
  type PublicContentType,
} from "@/lib/public-content/catalog";
import type { PublicResourceNode } from "@/lib/public-content/navigation";

export type PublicContentQuery = {
  q?: string;
  topic?: PublicContentTopic;
  audience?: PublicAudience;
  type?: PublicContentType;
};

export type PublicContentFacets = {
  topics: PublicContentTopic[];
  audiences: PublicAudience[];
  types: PublicContentType[];
};

const publishedContent = publicContentCatalog
  .filter((item) => item.publicationStatus === "published")
  .sort((a, b) => b.publishedOn.localeCompare(a.publishedOn) || a.title.localeCompare(b.title));

export function listPublishedContent() {
  return [...publishedContent];
}

export function getFeaturedPublicContent() {
  return publishedContent.find((item) => item.featured) ?? publishedContent[0];
}

export function findPublicContent(slug: string) {
  return publishedContent.find((item) => item.slug === slug);
}

export function publicContentFacets(): PublicContentFacets {
  return {
    topics: Array.from(new Set(publishedContent.map((item) => item.topic))),
    audiences: Array.from(new Set(publishedContent.flatMap((item) => item.audiences))),
    types: Array.from(new Set(publishedContent.map((item) => item.type))),
  };
}

export function queryPublishedContent(query: PublicContentQuery) {
  const normalized = query.q?.trim().toLowerCase() ?? "";
  return publishedContent.filter((item) => {
    const haystack = [
      item.title,
      item.summary,
      item.topic,
      item.type,
      ...item.audiences,
      ...item.collections,
      ...item.body,
      ...(item.takeaways ?? []),
    ].join(" ").toLowerCase();

    return (
      (!normalized || haystack.includes(normalized)) &&
      (!query.topic || item.topic === query.topic) &&
      (!query.audience || item.audiences.includes(query.audience)) &&
      (!query.type || item.type === query.type)
    );
  });
}

export function contentForPublicResourceNode(node: PublicResourceNode) {
  const descendants = new Set<string>();
  const collect = (candidate: PublicResourceNode) => {
    descendants.add(candidate.id);
    candidate.children?.forEach(collect);
  };
  collect(node);

  return publishedContent.filter((item) => {
    const explicitlyAssigned = item.collections.some((collection) => descendants.has(collection));
    if (explicitlyAssigned) return true;
    if (node.audience && item.audiences.includes(node.audience)) return true;
    if (node.topic && item.topic === node.topic && node.kind === "section") return true;
    if (node.types && node.types.includes(item.type) && node.kind === "section") return true;
    return false;
  });
}

export function relatedPublicContent(item: PublicContentItem, limit = 3) {
  return publishedContent
    .filter((candidate) => candidate.slug !== item.slug)
    .map((candidate) => ({
      candidate,
      score:
        Number(candidate.topic === item.topic) * 3 +
        candidate.audiences.filter((audience) => item.audiences.includes(audience)).length * 2 +
        candidate.collections.filter((collection) => item.collections.includes(collection)).length * 4,
    }))
    .sort((a, b) => b.score - a.score || b.candidate.publishedOn.localeCompare(a.candidate.publishedOn))
    .slice(0, limit)
    .map(({ candidate }) => candidate);
}

export function signInForExchangeHref(exchangeHref: string) {
  return `/login?returnTo=${encodeURIComponent(exchangeHref)}`;
}

export function joinForExchangeHref(exchangeHref: string) {
  const params = new URLSearchParams({ source: "resources", returnTo: exchangeHref });
  return `/register?${params.toString()}`;
}
