import { NextResponse } from "next/server";
import { ExchangeForbiddenError, ExchangeUnauthorizedError } from "./actor";
import { ExchangeServiceUnavailableError } from "./database";
import { ExchangeConflictError, ExchangeNotFoundError } from "./resource-service";

export function exchangeServiceErrorResponse(error: unknown) {
  if (error instanceof ExchangeUnauthorizedError) {
    return NextResponse.json({ error: error.message, code: "unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  if (error instanceof ExchangeForbiddenError) {
    return NextResponse.json({ error: error.message, code: "forbidden" }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }
  if (error instanceof ExchangeNotFoundError) {
    return NextResponse.json({ error: error.message, code: "not_found" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  if (error instanceof ExchangeConflictError) {
    return NextResponse.json({ error: error.message, code: "conflict" }, { status: 409, headers: { "Cache-Control": "no-store" } });
  }
  if (error instanceof ExchangeServiceUnavailableError) {
    return NextResponse.json({ error: error.message, code: "service_unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }

  console.error("Exchange service request failed", error);
  return NextResponse.json(
    { error: "The Exchange service could not complete this request.", code: "request_failed" },
    { status: 500, headers: { "Cache-Control": "no-store" } },
  );
}
