import { notFound, redirect } from "next/navigation";
import { OnboardingDetailSurface } from "@/components/onboarding/OnboardingDetailSurface";
import {
  getLegacyOnboardingDetailRedirect,
  getOnboardingDetailDefinition,
  sanitizeInternalDetailHref,
} from "@/lib/onboarding/detail-surface";

interface DetailPageProps {
  params: Promise<{ subject: string }>;
  searchParams: Promise<{ returnTo?: string | string[] }>;
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function OnboardingDetailPage({ params, searchParams }: DetailPageProps) {
  const { subject } = await params;
  const query = await searchParams;
  const returnHref = sanitizeInternalDetailHref(first(query.returnTo), "/onboarding");
  const legacyRedirect = getLegacyOnboardingDetailRedirect(subject);
  if (legacyRedirect) {
    redirect(`${legacyRedirect}?returnTo=${encodeURIComponent(returnHref)}`);
  }

  const definition = getOnboardingDetailDefinition(subject);
  if (!definition) notFound();

  return <OnboardingDetailSurface definition={definition} activePath={[]} returnHref={returnHref} />;
}
