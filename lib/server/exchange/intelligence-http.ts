import { NextResponse } from "next/server";
import { DatabaseServiceUnavailableError } from "@/lib/server/database";
import { ExchangeForbiddenError, ExchangeUnauthorizedError } from "@/lib/server/exchange/actor";
import { IntelligenceServiceError } from "@/lib/server/exchange/intelligence-service";

export function intelligenceErrorResponse(error: unknown) {
  if (error instanceof IntelligenceServiceError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof ExchangeUnauthorizedError) return NextResponse.json({ error: error.message }, { status: 401 });
  if (error instanceof ExchangeForbiddenError) return NextResponse.json({ error: error.message }, { status: 403 });
  if (error instanceof DatabaseServiceUnavailableError) return NextResponse.json({ error: error.message, service: "postgresql" }, { status: 503 });
  console.error(error);
  return NextResponse.json({ error: "Intelligence service failed." }, { status: 500 });
}
