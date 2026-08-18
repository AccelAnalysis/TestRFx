import { NextRequest, NextResponse } from "next/server";
import type { CapabilityCommand } from "@/lib/capabilities/contracts";
import { getAmacsCandidates } from "@/lib/capabilities/amacs";
import { matchCapabilityProfileToRfx } from "@/lib/capabilities/matching";
import { applyCapabilityCommand, getCapabilityProfile, listCapabilityProfiles } from "@/lib/capabilities/repository";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const recordId = request.nextUrl.searchParams.get("recordId");
  if (!recordId) return NextResponse.json({ profiles: await listCapabilityProfiles(), persistence: "server-file-repository" }, { headers: { "Cache-Control": "no-store" } });
  const profile = await getCapabilityProfile(recordId);
  if (!profile) return NextResponse.json({ error: "Capability profile not found" }, { status: 404 });
  return NextResponse.json({ profile, persistence: "server-file-repository" }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { operation?: string; recordId?: string; capabilityId?: string; command?: CapabilityCommand } | null;
  if (!body?.operation || !body.recordId) return NextResponse.json({ error: "operation and recordId are required" }, { status: 400 });
  try {
    if (body.operation === "command") {
      if (!body.command) return NextResponse.json({ error: "command is required" }, { status: 400 });
      const profile = await applyCapabilityCommand(body.recordId, body.command);
      return NextResponse.json({ profile, persisted: true }, { headers: { "Cache-Control": "no-store" } });
    }
    const profile = await getCapabilityProfile(body.recordId);
    if (!profile) return NextResponse.json({ error: "Capability profile not found" }, { status: 404 });
    if (body.operation === "match") return NextResponse.json({ matches: matchCapabilityProfileToRfx(profile), source: "structured-rfx-catalog" }, { headers: { "Cache-Control": "no-store" } });
    if (body.operation === "amacs-candidates") {
      const claim = profile.capabilities.find((item) => item.id === body.capabilityId);
      if (!claim) return NextResponse.json({ error: "Capability claim not found" }, { status: 404 });
      return NextResponse.json(await getAmacsCandidates(claim), { headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json({ error: "Unsupported capability operation" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Capability service failed" }, { status: 409 });
  }
}
