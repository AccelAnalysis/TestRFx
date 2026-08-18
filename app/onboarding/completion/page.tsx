import { cookies } from "next/headers";
import { ExchangeReadyCompletion } from "@/components/onboarding/exchange-ready-completion";
import {
  buildExchangeReadiness,
  resolveExchangeDestination,
} from "@/lib/onboarding/readiness";
import {
  ONBOARDING_PROGRESS_COOKIE,
  readOnboardingProgressCookie,
} from "@/lib/onboarding/progress-store";

interface CompletionPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export const dynamic = "force-dynamic";

export default async function CompletionPage({ searchParams }: CompletionPageProps) {
  const params = await searchParams;
  const requestedReturnTo = Array.isArray(params.returnTo) ? params.returnTo[0] : params.returnTo;
  const returnTo = resolveExchangeDestination(requestedReturnTo);
  const cookieStore = await cookies();
  const progress = readOnboardingProgressCookie(cookieStore.get(ONBOARDING_PROGRESS_COOKIE)?.value);

  return (
    <ExchangeReadyCompletion
      readiness={buildExchangeReadiness(progress)}
      returnTo={returnTo}
    />
  );
}
