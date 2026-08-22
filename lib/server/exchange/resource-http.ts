import { NextResponse } from "next/server";
import { DatabaseServiceUnavailableError } from "@/lib/server/database";
import { ExchangeForbiddenError, ExchangeUnauthorizedError } from "@/lib/server/exchange/actor";
import { ExchangeInvalidInputError } from "@/lib/server/exchange/resource-input";
import { ExchangeConflictError, ExchangeNotFoundError } from "@/lib/server/exchange/resource-service";
import { SharedExchangeWorkflowError } from "@/lib/server/exchange/shared-workflow-service";

export function resourceErrorResponse(error: unknown) {
  if (error instanceof ExchangeInvalidInputError) return NextResponse.json({ error: error.message }, { status: 400 });
  if (error instanceof ExchangeUnauthorizedError) return NextResponse.json({ error: error.message }, { status: 401 });
  if (error instanceof ExchangeForbiddenError) return NextResponse.json({ error: error.message }, { status: 403 });
  if (error instanceof ExchangeNotFoundError) return NextResponse.json({ error: error.message }, { status: 404 });
  if (error instanceof ExchangeConflictError) return NextResponse.json({ error: error.message }, { status: 409 });
  if (error instanceof SharedExchangeWorkflowError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof DatabaseServiceUnavailableError) return NextResponse.json({ error: error.message }, { status: 503 });
  return NextResponse.json({ error: error instanceof Error ? error.message : "Resources service failed." }, { status: 500 });
}
