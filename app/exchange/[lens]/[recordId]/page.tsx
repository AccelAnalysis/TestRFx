import { notFound, redirect } from "next/navigation";
import { ExchangeShell } from "@/components/exchange/exchange-shell";
import { exchangeSeed } from "@/lib/exchange/seed";
import { isExchangeLens } from "@/lib/exchange/lenses";
import { typeByLens } from "@/lib/exchange/filter";

export default async function RecordPage({
  params,
  searchParams,
}: {
  params: Promise<{ lens: string; recordId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { lens, recordId } = await params;
  if (!isExchangeLens(lens)) notFound();

  // Intelligence is canonical runtime data. The one-time q parameter causes the
  // authenticated list service to resolve this exact public ID so the mounted
  // shell can restore selection/detail even when the record is not on page one.
  if (lens === "intelligence") {
    const query = (await searchParams).q;
    const currentQuery = Array.isArray(query) ? query[0] : query;
    if (currentQuery !== recordId) redirect(`/exchange/intelligence/${encodeURIComponent(recordId)}?q=${encodeURIComponent(recordId)}`);
    return <ExchangeShell initialLens="intelligence" initialRecordId={recordId} />;
  }

  const record = exchangeSeed.find((item) => item.id === recordId);
  if (!record || record.type !== typeByLens[lens]) notFound();
  return <ExchangeShell initialLens={lens} initialRecordId={recordId} />;
}
