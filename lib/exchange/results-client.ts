import type { ExchangeLens, ExchangeRecord, ExchangeSearchState } from "./contracts";
import { searchStateToParams } from "./search";

export interface ExchangeResultsApiResponse {
  lens: ExchangeLens;
  state: ExchangeSearchState;
  records: ExchangeRecord[];
  summary: { total: number; mapped: number; offMap: number };
  nextCursor: string | null;
  serviceMode: "postgres" | "reference";
}

export function exchangeResultsUrl(lens: ExchangeLens, state: ExchangeSearchState, cursor?: string) {
  const params = searchStateToParams(state);
  params.set("lens", lens);
  params.set("limit", "40");
  if (cursor) params.set("cursor", cursor);
  return `/api/exchange/results?${params.toString()}`;
}
