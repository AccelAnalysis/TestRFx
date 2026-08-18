import { notFound } from "next/navigation";
import { OnboardingDetailSurface } from "@/components/onboarding/OnboardingDetailSurface";
import {
  getOnboardingDetailDefinition,
  getOnboardingDetailNode,
  isOnboardingDetailSubject,
  sanitizeInternalDetailHref,
} from "@/lib/onboarding/detail-surface";

interface NestedDetailPageProps {
  params: Promise<{ subject: string; path: string[] }>;
  searchParams: Promise<{ returnTo?: string | string[] }>;
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function NestedOnboardingDetailPage({ params, searchParams }: NestedDetailPageProps) {
  const { subject, path } = await params;
  const query = await searchParams;
  if (!isOnboardingDetailSubject(subject)) notFound();

  const definition = getOnboardingDetailDefinition(subject);
  const active = getOnboardingDetailNode(subject, path);
  if (!definition || !active) notFound();

  const returnHref = sanitizeInternalDetailHref(first(query.returnTo), "/onboarding");
  return <OnboardingDetailSurface definition={definition} activePath={path} returnHref={returnHref} />;
}
