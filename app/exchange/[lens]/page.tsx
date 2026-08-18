import { notFound } from "next/navigation";
import { ExchangeShell } from "@/components/exchange/exchange-shell";
import { isExchangeLens } from "@/lib/exchange/lenses";

export default async function LensPage({ params }: { params: Promise<{ lens: string }> }) {
  const { lens } = await params;
  if (!isExchangeLens(lens)) notFound();
  return <ExchangeShell initialLens={lens} />;
}
