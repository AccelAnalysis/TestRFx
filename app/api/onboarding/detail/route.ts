import { NextRequest, NextResponse } from "next/server";
import {
  getOnboardingDetailBreadcrumbs,
  getOnboardingDetailDefinition,
  getOnboardingDetailNode,
  isOnboardingDetailSubject,
  listOnboardingDetailDefinitions,
} from "@/lib/onboarding/detail-surface";

export function GET(request: NextRequest) {
  const subject = request.nextUrl.searchParams.get("subject");
  if (!subject) {
    return NextResponse.json({
      contract: "identity-onboarding-detail-surface/v2",
      responsibility: "hierarchy-continuity-routing",
      persistence: "owning-domain-services",
      subjects: listOnboardingDetailDefinitions().map(({ subject: id, label, step, classification, workflow, children }) => ({
        id,
        label,
        step,
        classification,
        workflow,
        childCount: children.length,
      })),
    }, { headers: { "Cache-Control": "no-store" } });
  }

  if (!isOnboardingDetailSubject(subject)) {
    return NextResponse.json({ error: "Unknown onboarding detail subject." }, { status: 404 });
  }

  const rawPath = request.nextUrl.searchParams.get("path")?.trim() ?? "";
  const path = rawPath ? rawPath.split("/").filter(Boolean) : [];
  const definition = getOnboardingDetailDefinition(subject);
  const active = getOnboardingDetailNode(subject, path);
  if (!definition || !active) {
    return NextResponse.json({ error: "Unknown onboarding detail path." }, { status: 404 });
  }

  return NextResponse.json({
    contract: "identity-onboarding-detail-surface/v2",
    responsibility: "hierarchy-continuity-routing",
    persistence: "owning-domain-services",
    definition,
    activePath: path,
    breadcrumbs: getOnboardingDetailBreadcrumbs(subject, path),
    active,
  }, { headers: { "Cache-Control": "no-store" } });
}
