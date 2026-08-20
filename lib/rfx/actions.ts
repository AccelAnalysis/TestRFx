import type { ExchangeRecord, ExchangeViewerContext, LensAction } from "@/lib/exchange/contracts";
import { resolveLensActions, resolveRecordActions } from "@/lib/exchange/action-registry";

/** RFx domain adapters into the chassis-governed lens and record action contracts. */
export function resolveRfxLensActions(viewer: ExchangeViewerContext): LensAction[] {
  return resolveLensActions("rfx", viewer);
}

export function resolveRfxRecordActions(record: ExchangeRecord, viewer: ExchangeViewerContext): LensAction[] {
  return resolveRecordActions("rfx", record, viewer);
}
