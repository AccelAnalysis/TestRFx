import type { ExchangeRecord, LensAction } from "@/lib/exchange/contracts";
import { resolveLensActions } from "@/lib/exchange/action-registry";

/** RFx domain adapter into the chassis-governed four-slot action registry. */
export function resolveRfxActions(record?: ExchangeRecord): LensAction[] {
  return resolveLensActions("rfx", record);
}
