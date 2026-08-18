import type { ExchangeLens, ExchangeRecord } from "./contracts";
import { defaultSearchState, searchExchangeRecords, typeByLens } from "./search";

export { typeByLens };

/**
 * Compatibility adapter for chassis callers that still provide only a query string.
 * New Universal Search integrations should use searchExchangeRecords with a full search state.
 */
export function filterExchangeRecords(records: ExchangeRecord[], lens: ExchangeLens, search: string) {
  return searchExchangeRecords(records, lens, defaultSearchState(search)).results.map((result) => result.record);
}
