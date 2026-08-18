import { notFound } from "next/navigation";
import { ExchangeShell } from "@/components/exchange/exchange-shell";
import { ExchangeRuntimeUnavailable } from "@/components/exchange/exchange-runtime-unavailable";
import { isExchangeLens } from "@/lib/exchange/lenses";
import { DatabaseUnavailableError } from "@/lib/server/database";
import { loadExchangePageData } from "@/lib/server/exchange-page-data";

export const dynamic = "force-dynamic";

export default async function LensPage({ params }: { params: Promise<{ lens: string }> }) {
  const { lens } = await params;
  if (!isExchangeLens(lens)) notFound();
  try {
    const { records } = await loadExchangePageData();
    return <ExchangeShell initialLens={lens} initialRecords={records} />;
  } catch (error) {
    if (error instanceof DatabaseUnavailableError) return <ExchangeRuntimeUnavailable message={error.message} />;
    throw error;
  }
}
