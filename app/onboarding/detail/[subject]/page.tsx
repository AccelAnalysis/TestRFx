import { notFound } from "next/navigation";
import { OnboardingDetailSurface } from "@/components/onboarding/OnboardingDetailSurface";
import {
  getOnboardingDetailDefinition,
  sanitizeInternalDetailHref,
} from "@/lib/onboarding/detail-surface";

interface DetailPageProps {
  params: Promise<{ subject: string }>;
  searchParams: Promise<{ returnTo?: string | string[]; next?: string | string[] }>;
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function OnboardingDetailPage({ params, searchParams }: DetailPageProps) {
  const { subject } = await params;
  const query = await searchParams;
  const definition = getOnboardingDetailDefinition(subject);
  if (!definition) notFound();

  const withContinuity = {
    ...definition,
    returnHref: sanitizeInternalDetailHref(first(query.returnTo), definition.returnHref),
    nextHref: sanitizeInternalDetailHref(first(query.next), definition.nextHref),
  };

  return <OnboardingDetailSurface definition={withContinuity} />;
}
