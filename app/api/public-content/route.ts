import { NextRequest, NextResponse } from "next/server";
import {
  publicAudiences,
  publicContentCatalog,
  publicContentTopics,
  publicContentTypes,
} from "@/lib/public-content/catalog";

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams.get("q")?.trim().toLowerCase() ?? "";
  const topic = request.nextUrl.searchParams.get("topic");
  const audience = request.nextUrl.searchParams.get("audience");
  const type = request.nextUrl.searchParams.get("type");

  if (topic && !publicContentTopics.includes(topic as (typeof publicContentTopics)[number])) {
    return NextResponse.json({ error: "Unsupported topic" }, { status: 400 });
  }
  if (audience && !publicAudiences.includes(audience as (typeof publicAudiences)[number])) {
    return NextResponse.json({ error: "Unsupported audience" }, { status: 400 });
  }
  if (type && !publicContentTypes.includes(type as (typeof publicContentTypes)[number])) {
    return NextResponse.json({ error: "Unsupported content type" }, { status: 400 });
  }

  const items = publicContentCatalog.filter((item) => {
    const haystack = [item.title, item.summary, item.topic, item.type, ...item.audiences].join(" ").toLowerCase();
    return (
      (!search || haystack.includes(search)) &&
      (!topic || item.topic === topic) &&
      (!audience || item.audiences.includes(audience as (typeof publicAudiences)[number])) &&
      (!type || item.type === type)
    );
  });

  return NextResponse.json({
    items,
    facets: {
      topics: publicContentTopics,
      audiences: publicAudiences,
      types: publicContentTypes,
    },
  });
}
