import { cookies } from "next/headers";
import { EXCHANGE_SESSION_COOKIE, resolveExchangeActorFromToken } from "./exchange-actor";
import { listExchangeRecords } from "./exchange-record-repository";

export async function loadExchangePageData() {
  const cookieStore = await cookies();
  const actor = await resolveExchangeActorFromToken(cookieStore.get(EXCHANGE_SESSION_COOKIE)?.value);
  const records = await listExchangeRecords({}, actor);
  return { actor, records };
}
