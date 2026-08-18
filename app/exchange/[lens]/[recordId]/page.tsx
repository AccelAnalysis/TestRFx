import { notFound, redirect } from "next/navigation";
import { ExchangeShell } from "@/components/exchange/exchange-shell";
import { ExchangeRuntimeUnavailable } from "@/components/exchange/exchange-runtime-unavailable";
import { isExchangeLens } from "@/lib/exchange/lenses";
import { typeByLens } from "@/lib/exchange/search";
import { DatabaseUnavailableError } from "@/lib/server/database";
import { ExchangeAuthenticationRequiredError, ExchangeOrganizationRequiredError, loadExchangePageData } from "@/lib/server/exchange-page-data";

export const dynamic = "force-dynamic";

export default async function RecordPage({ params }: { params: Promise<{ lens: string; recordId: string }> }) {
  const { lens, recordId } = await params;
  if (!isExchangeLens(lens)) notFound();
  const returnTo = `/exchange/${lens}/${recordId}`;
  try {
    const { records } = await loadExchangePageData();
    const record = records.find((item) => item.id === recordId);
    if (!record || record.type !== typeByLens[lens]) notFound();
    return <ExchangeShell initialLens={lens} initialRecordId={recordId} initialRecords={records} />;
  } catch (error) {
    if (error instanceof ExchangeAuthenticationRequiredError) redirect(`/login?returnTo=${encodeURIComponent(returnTo)}`);
    if (error instanceof ExchangeOrganizationRequiredError) redirect(`/onboarding/organization?returnTo=${encodeURIComponent(returnTo)}`);
    if (error instanceof DatabaseUnavailableError) return <ExchangeRuntimeUnavailable message={error.message} />;
    throw error;
  }
}
