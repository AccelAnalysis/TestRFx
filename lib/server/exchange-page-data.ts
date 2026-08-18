import { cookies } from "next/headers";
import { EXCHANGE_SESSION_COOKIE, resolveExchangeActorFromToken, resolveRuntimeSessionFromToken } from "./exchange-actor";
import { listExchangeRecords } from "./exchange-record-repository";

export class ExchangeAuthenticationRequiredError extends Error {
  constructor() { super("An authenticated RFxchange session is required."); this.name = "ExchangeAuthenticationRequiredError"; }
}

export class ExchangeOrganizationRequiredError extends Error {
  constructor() { super("Select an active organization before entering the Exchange."); this.name = "ExchangeOrganizationRequiredError"; }
}

export async function loadExchangePageData() {
  const cookieStore = await cookies();
  const token = cookieStore.get(EXCHANGE_SESSION_COOKIE)?.value;
  const session = await resolveRuntimeSessionFromToken(token);
  if (!session) throw new ExchangeAuthenticationRequiredError();
  if (!session.activeOrganizationId) throw new ExchangeOrganizationRequiredError();
  const actor = await resolveExchangeActorFromToken(token);
  if (!actor) throw new ExchangeOrganizationRequiredError();
  const records = await listExchangeRecords({}, actor);
  return { actor, records };
}
