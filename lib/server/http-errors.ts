import "server-only";
import { NextResponse } from "next/server";
import { AuthenticationRequiredError } from "./exchange-session";
import { ServiceConfigurationError } from "./database";
import { IntelligenceAuthorizationError, IntelligenceNotFoundError } from "./intelligence-repository";

export function serviceErrorResponse(error: unknown) {
  if (error instanceof AuthenticationRequiredError) return NextResponse.json({ error: error.message, code: "AUTH_REQUIRED" }, { status: 401 });
  if (error instanceof IntelligenceAuthorizationError) return NextResponse.json({ error: error.message, code: "FORBIDDEN" }, { status: 403 });
  if (error instanceof IntelligenceNotFoundError) return NextResponse.json({ error: error.message, code: "NOT_FOUND" }, { status: 404 });
  if (error instanceof ServiceConfigurationError) return NextResponse.json({ error: error.message, code: "SERVICE_NOT_CONFIGURED" }, { status: 503 });
  console.error(error);
  return NextResponse.json({ error: "The Intelligence service could not complete the request.", code: "INTELLIGENCE_SERVICE_ERROR" }, { status: 500 });
}
