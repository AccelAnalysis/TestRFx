import { redirect } from "next/navigation";
import { ExchangeShell } from "@/components/exchange/exchange-shell";
import { ExchangeRuntimeUnavailable } from "@/components/exchange/exchange-runtime-unavailable";
import { DatabaseUnavailableError } from "@/lib/server/database";
import { ExchangeAuthenticationRequiredError, ExchangeOrganizationRequiredError, loadExchangePageData } from "@/lib/server/exchange-page-data";

export const dynamic = "force-dynamic";

export default async function ExchangePage() {
  const returnTo = "/exchange";
  try {
    const { records } = await loadExchangePageData();
    return <ExchangeShell initialLens="rfx" initialRecords={records} />;
  } catch (error) {
    if (error instanceof ExchangeAuthenticationRequiredError) redirect(`/login?returnTo=${encodeURIComponent(returnTo)}`);
    if (error instanceof ExchangeOrganizationRequiredError) redirect(`/onboarding/organization?returnTo=${encodeURIComponent(returnTo)}`);
    if (error instanceof DatabaseUnavailableError) return <ExchangeRuntimeUnavailable message={error.message} />;
    throw error;
  }
}
