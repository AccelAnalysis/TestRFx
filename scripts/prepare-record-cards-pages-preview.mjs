import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const root = process.cwd();
async function write(relativePath, content) {
  const target = join(root, relativePath);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content, "utf8");
}

const recordsModule = `import { capabilityExchangeRecords } from "@/lib/capabilities/reference";
import { intelligenceSeed } from "@/lib/exchange/intelligence";
import { exchangeSeed } from "@/lib/exchange/seed";

export const pagesPreviewRecords = [
  ...exchangeSeed.filter((record) => record.type !== "intelligence" && record.type !== "capability"),
  ...intelligenceSeed,
  ...capabilityExchangeRecords,
];
`;
await write("lib/exchange/pages-preview-records.ts", recordsModule);

await write("app/exchange/page.tsx", `import { ExchangeShell } from "@/components/exchange/exchange-shell";
import { pagesPreviewRecords } from "@/lib/exchange/pages-preview-records";

export default function ExchangePage() {
  return <ExchangeShell initialLens="rfx" initialRecords={pagesPreviewRecords} serviceMode="preview" />;
}
`);

await write("app/exchange/[lens]/page.tsx", `import { notFound } from "next/navigation";
import { ExchangeShell } from "@/components/exchange/exchange-shell";
import { isExchangeLens, lensOrder } from "@/lib/exchange/lenses";
import { pagesPreviewRecords } from "@/lib/exchange/pages-preview-records";

export function generateStaticParams() { return lensOrder.map((lens) => ({ lens })); }

export default async function LensPage({ params }: { params: Promise<{ lens: string }> }) {
  const { lens } = await params;
  if (!isExchangeLens(lens)) notFound();
  return <ExchangeShell initialLens={lens} initialRecords={pagesPreviewRecords} serviceMode="preview" />;
}
`);

await write("app/exchange/[lens]/[recordId]/page.tsx", `import { notFound } from "next/navigation";
import { ExchangeShell } from "@/components/exchange/exchange-shell";
import { isExchangeLens, lensOrder } from "@/lib/exchange/lenses";
import { typeByLens } from "@/lib/exchange/search";
import { pagesPreviewRecords } from "@/lib/exchange/pages-preview-records";

export function generateStaticParams() {
  return lensOrder.flatMap((lens) => pagesPreviewRecords.filter((record) => record.type === typeByLens[lens]).map((record) => ({ lens, recordId: record.id })));
}

export default async function RecordPage({ params }: { params: Promise<{ lens: string; recordId: string }> }) {
  const { lens, recordId } = await params;
  if (!isExchangeLens(lens)) notFound();
  const record = pagesPreviewRecords.find((item) => item.id === recordId);
  if (!record || record.type !== typeByLens[lens]) notFound();
  return <ExchangeShell initialLens={lens} initialRecordId={recordId} initialRecords={pagesPreviewRecords} serviceMode="preview" />;
}
`);

console.log("Prepared Record Cards fixture projection for static GitHub Pages only.");
