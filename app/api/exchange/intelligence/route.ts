import { NextRequest, NextResponse } from "next/server";
import type { IntelligenceInsightInput, IntelligenceSourceType } from "@/lib/exchange/intelligence";
import { createIntelligence, listIntelligence } from "@/lib/server/intelligence-repository";
import { requireExchangeActor } from "@/lib/server/exchange-session";
import { serviceErrorResponse } from "@/lib/server/http-errors";

const sourceTypes = new Set<IntelligenceSourceType>(["exchange-activity", "participant-observation", "external-dataset"]);

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
    const response = await listIntelligence(actor, {
      query: params.get("q") ?? "",
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
