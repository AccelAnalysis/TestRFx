import { NextRequest, NextResponse } from "next/server";
import type { IntelligenceInsightInput, IntelligenceSourceType } from "@/lib/exchange/intelligence";
import { getIntelligenceDetail, updateIntelligence } from "@/lib/server/intelligence-repository";
import { requireExchangeActor } from "@/lib/server/exchange-session";
import { serviceErrorResponse } from "@/lib/server/http-errors";

const sourceTypes = new Set<IntelligenceSourceType>(["exchange-activity", "participant-observation", "external-dataset"]);
const text = (value: unknown) => typeof value === "string" ? value.trim() : "";

function safeHttpUrl(value: unknown) {
  const candidate = text(value);
  if (!candidate) return undefined;
  try {
    const url = new URL(candidate);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function parseInput(value: unknown): IntelligenceInsightInput | undefined {
  if (!value || typeof value !== "object") return undefined;
  const body = value as Record<string, unknown>;
  const sourceType = text(body.sourceType) as IntelligenceSourceType;
  const sourceUri = safeHttpUrl(body.sourceUri);
  if (sourceUri === null) return undefined;
  const input: IntelligenceInsightInput = {
    title: text(body.title),
    summary: text(body.summary),
    geography: text(body.geography),
    signalType: text(body.signalType),
    sourceLabel: text(body.sourceLabel),
    sourceType,
    observedFrom: text(body.observedFrom) || undefined,
    observedTo: text(body.observedTo) || undefined,
    sourceUri,
    locationId: text(body.locationId) || undefined,
  };
  return input.title && input.summary && input.geography && input.signalType && input.sourceLabel && sourceTypes.has(sourceType) ? input : undefined;
}

export async function GET(request: NextRequest, context: { params: Promise<{ recordId: string }> }) {
  try {
    const actor = await requireExchangeActor(request);
    const { recordId } = await context.params;
    return NextResponse.json(await getIntelligenceDetail(actor, recordId));
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ recordId: string }> }) {
  try {
    const actor = await requireExchangeActor(request);
    const { recordId } = await context.params;
    const input = parseInput(await request.json());
    if (!input) return NextResponse.json({ error: "A title, observation, geography, signal type, source label, valid source type, and HTTP(S) source URL when supplied are required." }, { status: 400 });
    return NextResponse.json(await updateIntelligence(actor, recordId, input));
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
