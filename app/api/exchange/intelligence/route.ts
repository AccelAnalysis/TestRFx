import { NextRequest, NextResponse } from "next/server";
import type { IntelligenceInsightInput, IntelligenceSourceType } from "@/lib/exchange/intelligence";
import { createIntelligence, getIntelligenceDetail } from "@/lib/server/intelligence-repository";
import { searchIntelligence, type IntelligenceDiscoveryLocation, type IntelligenceDiscoveryOwnership, type IntelligenceDiscoverySort } from "@/lib/server/intelligence-search";
import { requireExchangeActor } from "@/lib/server/exchange-session";
import { serviceErrorResponse } from "@/lib/server/http-errors";

const sourceTypes = new Set<IntelligenceSourceType>(["exchange-activity", "participant-observation", "external-dataset"]);
const locations = new Set<IntelligenceDiscoveryLocation>(["all", "mapped", "off-map"]);
const ownerships = new Set<IntelligenceDiscoveryOwnership>(["all", "mine", "others"]);
const sorts = new Set<IntelligenceDiscoverySort>(["relevance", "title", "organization", "geography"]);

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function insightInput(value: unknown): IntelligenceInsightInput | undefined {
  if (!value || typeof value !== "object") return undefined;
  const body = value as Record<string, unknown>;
  const title = text(body.title);
  const summary = text(body.summary);
  const geography = text(body.geography);
  const signalType = text(body.signalType);
  const sourceLabel = text(body.sourceLabel);
  const sourceType = text(body.sourceType) as IntelligenceSourceType;
  if (!title || !summary || !geography || !signalType || !sourceLabel || !sourceTypes.has(sourceType)) return undefined;
  return {
    title,
    summary,
    geography,
    signalType,
    sourceLabel,
    sourceType,
    observedFrom: text(body.observedFrom) || undefined,
    observedTo: text(body.observedTo) || undefined,
    sourceUri: text(body.sourceUri) || undefined,
    locationId: text(body.locationId) || undefined,
  };
}

export async function GET(request: NextRequest) {
  try {
    const actor = await requireExchangeActor(request);
    const params = request.nextUrl.searchParams;
    const query = params.get("q")?.trim() ?? "";

    // A deep-linked Intelligence public ID is resolved by the canonical repository,
    // not by seed data or by requiring it to happen to be inside the first result page.
    if (/^intel-[0-9a-f-]+$/i.test(query)) {
      const detail = await getIntelligenceDetail(actor, query);
      return NextResponse.json({
        records: [detail.record],
        total: 1,
        mapped: detail.record.location ? 1 : 0,
        offMap: detail.record.location ? 0 : 1,
        offset: 0,
        limit: 1,
      });
    }

    const locationParam = (params.get("location") ?? "all") as IntelligenceDiscoveryLocation;
    const ownershipParam = (params.get("ownership") ?? "all") as IntelligenceDiscoveryOwnership;
    const sortParam = (params.get("sort") ?? "relevance") as IntelligenceDiscoverySort;
    const response = await searchIntelligence(actor, {
      query,
      geography: params.get("geo") ?? "",
      location: locations.has(locationParam) ? locationParam : "all",
      ownership: ownerships.has(ownershipParam) ? ownershipParam : "all",
      tags: params.getAll("tag"),
      trackedOnly: params.get("tracked") === "1",
      sort: sorts.has(sortParam) ? sortParam : "relevance",
      offset: Number(params.get("offset") ?? 0),
      limit: Number(params.get("limit") ?? 24),
    });
    return NextResponse.json(response);
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireExchangeActor(request);
    const input = insightInput(await request.json());
    if (!input) return NextResponse.json({ error: "A title, observation, geography, signal type, source label, and valid source type are required." }, { status: 400 });
    const detail = await createIntelligence(actor, input);
    return NextResponse.json(detail, { status: 201 });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
