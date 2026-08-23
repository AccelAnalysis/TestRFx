import { timingSafeEqual } from "node:crypto";
import { NextRequest } from "next/server";
import { GeographyIngestionError } from "./boundary-ingestion-service";

function equalSecret(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function assertGeographyIngestionAccess(request: NextRequest) {
  const expected = process.env.RFXCHANGE_INGESTION_TOKEN?.trim();
  if (!expected) throw new GeographyIngestionError("Geography ingestion is not configured.", 503, "ingestion_not_configured");
  const supplied = request.headers.get("x-rfxchange-ingestion-token")?.trim() ?? "";
  if (!supplied || !equalSecret(supplied, expected)) {
    throw new GeographyIngestionError("Geography ingestion credentials are invalid.", 403, "ingestion_forbidden");
  }
}
