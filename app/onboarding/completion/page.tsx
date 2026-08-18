import { ExchangeReadyCompletion } from "@/components/onboarding/exchange-ready-completion";
import {
  getReferenceExchangeReadiness,
  resolveExchangeDestination,
} from "@/lib/onboarding/readiness";

interface CompletionPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CompletionPage({ searchParams }: CompletionPageProps) {
  const params = await searchParams;
  const requestedReturnTo = Array.isArray(params.returnTo) ? params.returnTo[0] : params.returnTo;
  const returnTo = resolveExchangeDestination(requestedReturnTo);

  return (
    <ExchangeReadyCompletion
      readiness={getReferenceExchangeReadiness()}
      returnTo={returnTo}
    />
  );
}
