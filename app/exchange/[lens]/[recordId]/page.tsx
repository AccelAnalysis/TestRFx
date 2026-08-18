import { notFound } from "next/navigation";
import { ExchangeShell } from "@/components/exchange/exchange-shell";
import { exchangeSeed } from "@/lib/exchange/seed";
import { isExchangeLens } from "@/lib/exchange/lenses";
import { typeByLens } from "@/lib/exchange/filter";

export default async function RecordPage({ params }: { params: Promise<{ lens: string; recordId: string }> }) {
  const { lens, recordId } = await params;
  if (!isExchangeLens(lens)) notFound();
  const record = exchangeSeed.find((item) => item.id === recordId);
  if (!record || record.type !== typeByLens[lens]) notFound();
  return <ExchangeShell initialLens={lens} initialRecordId={recordId} />;
}
