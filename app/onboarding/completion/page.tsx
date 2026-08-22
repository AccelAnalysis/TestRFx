import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ExchangeReadyCompletion } from "@/components/onboarding/exchange-ready-completion";
import { resolveExchangeDestination } from "@/lib/onboarding/readiness";
import {
  loadAuthoritativeReadiness,
  OnboardingReadinessError,
} from "@/lib/server/onboarding/readiness-service";

interface CompletionPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export const dynamic = "force-dynamic";

export default async function CompletionPage({ searchParams }: CompletionPageProps) {
  const params = await searchParams;
  const requestedReturnTo = Array.isArray(params.returnTo) ? params.returnTo[0] : params.returnTo;
  const returnTo = resolveExchangeDestination(requestedReturnTo);
  const requestHeaders = await headers();

  try {
    const readiness = await loadAuthoritativeReadiness(requestHeaders.get("cookie"));
    return <ExchangeReadyCompletion readiness={readiness} returnTo={returnTo} />;
  } catch (error) {
    if (error instanceof OnboardingReadinessError && error.status === 401) {
      redirect(`/login?returnTo=${encodeURIComponent(`/onboarding/completion?returnTo=${returnTo}`)}`);
    }
    throw error;
  }
}
