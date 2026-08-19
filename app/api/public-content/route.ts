import { NextRequest, NextResponse } from "next/server";
import type { PublicAudience, PublicContentTopic, PublicContentType } from "@/lib/public-content/catalog";
import {
  publicContentFacets,
  queryPublishedContent,
  type PublicContentQuery,
} from "@/lib/public-content/service";

export async function GET(request: NextRequest) {
  const facets = publicContentFacets();
  const q = request.nextUrl.searchParams.get("q")?.trim() || undefined;
  const rawTopic = request.nextUrl.searchParams.get("topic");
  const rawAudience = request.nextUrl.searchParams.get("audience");
  const rawType = request.nextUrl.searchParams.get("type");

  if (rawTopic && !facets.topics.includes(rawTopic as PublicContentTopic)) {
    return NextResponse.json({ error: "Unsupported topic" }, { status: 400 });
  }
  if (rawAudience && !facets.audiences.includes(rawAudience as PublicAudience)) {
    return NextResponse.json({ error: "Unsupported audience" }, { status: 400 });
  }
  if (rawType && !facets.types.includes(rawType as PublicContentType)) {
    return NextResponse.json({ error: "Unsupported content type" }, { status: 400 });
  }

  const query: PublicContentQuery = {
    q,
    topic: rawTopic as PublicContentTopic | undefined,
    audience: rawAudience as PublicAudience | undefined,
    type: rawType as PublicContentType | undefined,
  };

  return NextResponse.json({
    items: queryPublishedContent(query),
    facets,
    query,
    source: "published-public-content",
  });
}
