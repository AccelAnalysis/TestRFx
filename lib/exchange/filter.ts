import type { ExchangeLens, ExchangeRecord } from "./contracts";

export const typeByLens: Record<ExchangeLens, ExchangeRecord["type"]> = {
  rfx: "rfx",
  resources: "resource",
  intelligence: "intelligence",
  capabilities: "capability",
};

export function filterExchangeRecords(records: ExchangeRecord[], lens: ExchangeLens, search: string) {
  const query = search.trim().toLowerCase();
  return records.filter((record) => {
    if (record.type !== typeByLens[lens]) return false;
    if (!query) return true;
    return [record.title, record.organization, record.summary, record.geography, ...record.metadata]
      .join(" ")
      .toLowerCase()
      .includes(query);
  });
}
