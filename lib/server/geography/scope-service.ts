import "server-only";

import { assertExchangeWrite, type ExchangeServerActor } from "@/lib/server/exchange/actor";
import { getDatabase } from "@/lib/server/database";
import type { GeographicScope, GeographicScopeKind, GeographyReference } from "@/lib/geography/contracts";
import { resolveCensusAddressProfile } from "./census-profile-resolver";
import { upsertExchangeRecordGeographicScope, upsertOrganizationGeographicScope } from "./geography-repository";

export class GeographicScopeError extends Error {
  constructor(message: string, public readonly status = 400, public readonly code = "geographic_scope_error") {
    super(message);
    this.name = "GeographicScopeError";
  }
}

function clean(value: unknown, max = 600) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

async function canonicalGeographies(tokens: string[]) {
  if (!tokens.length) return [];
  const sql = getDatabase();
  const lowered = tokens.map((token) => token.toLowerCase());
  const rows = await sql<{
    id: string;
    geography_type: GeographyReference["type"];
    name: string;
    country_code: string;
    state_code: string | null;
    fips_code: string | null;
    external_id: string | null;
    source_layer: string | null;
    vintage: string | null;
    is_economic_development_zone: boolean;
  }[]>`
    SELECT id::text, geography_type, name, country_code, state_code, fips_code,
           external_id, source_layer, vintage, is_economic_development_zone
    FROM geographies
    WHERE id::text IN ${sql(tokens)}
       OR external_id IN ${sql(tokens)}
       OR fips_code IN ${sql(tokens)}
       OR lower(name) IN ${sql(lowered)}
    ORDER BY geography_type, name
  `;
  return rows.map((row): GeographyReference => ({
    key: `canonical:${row.id}`,
    type: row.geography_type,
    name: row.name,
    countryCode: row.country_code,
    ...(row.state_code ? { stateCode: row.state_code } : {}),
    ...(row.fips_code ? { geoid: row.fips_code } : {}),
    ...(row.external_id ? { externalId: row.external_id } : {}),
    source: "manual",
    ...(row.source_layer ? { sourceLayer: row.source_layer } : {}),
    ...(row.vintage ? { vintage: row.vintage } : {}),
    economicDevelopmentZone: row.is_economic_development_zone,
  }));
}

async function ownedExchangeRecord(actor: ExchangeServerActor, publicId: string) {
  const sql = getDatabase();
  const rows = await sql<{ id: string; record_type: string }[]>`
    SELECT id::text, record_type
    FROM exchange_records
    WHERE public_id = ${publicId}
      AND organization_id = ${actor.organizationId}::uuid
    LIMIT 1
  `;
  return rows[0];
}

function allowedKindForRecordType(recordType: string, kind: GeographicScopeKind) {
  if (recordType === "resource") return kind === "resource_service_area";
  if (recordType === "rfx") return kind === "rfx_performance_area";
  if (recordType === "intelligence") return kind === "intelligence_analysis_area";
  if (recordType === "capability") return kind === "capability_service_area";
  return false;
}

function writePermissionForRecordType(recordType: string) {
  if (recordType === "resource") return "resources:write";
  if (recordType === "capability") return "capabilities:write";
  if (recordType === "intelligence") return "intelligence:write";
  return "exchange:write";
}

export async function setGeographicScope(input: {
  actor: ExchangeServerActor;
  target: "organization" | "record";
  kind: GeographicScopeKind;
  recordId?: string;
  mode: GeographicScope["mode"];
  label?: string;
  geographyIds?: string[];
  address?: GeographicScope["address"];
  point?: GeographicScope["point"];
  radiusMeters?: number;
}) {
  let scope: GeographicScope = {
    kind: input.kind,
    mode: input.mode,
    ...(input.label ? { label: input.label } : {}),
    ...(input.point ? { point: input.point } : {}),
    ...(input.radiusMeters !== undefined ? { radiusMeters: input.radiusMeters } : {}),
  };

  if (input.mode === "address") {
    const address = input.address;
    if (!address?.address1 || !address.city || !address.state) throw new GeographicScopeError("Address scopes require address1, city, and state.");
    const resolved = await resolveCensusAddressProfile({
      address1: address.address1,
      address2: address.address2,
      city: address.city,
      state: address.state,
      postalCode: address.postalCode,
    });
    scope = {
      ...scope,
      address,
      point: resolved.coordinates,
      derivedProfile: resolved.profile,
      label: input.label || resolved.matchedAddress,
    };
  } else if (input.mode === "geographies") {
    const tokens = (input.geographyIds ?? []).map((item) => clean(item, 180)).filter(Boolean).slice(0, 100);
    const geographies = await canonicalGeographies(tokens);
    if (!geographies.length) throw new GeographicScopeError("Select at least one canonical geography for this scope.", 422, "geography_required");
    scope = { ...scope, geographies };
  } else if (input.mode === "radius") {
    const radius = input.radiusMeters;
    if (!input.point || !Number.isFinite(input.point.latitude) || !Number.isFinite(input.point.longitude) || typeof radius !== "number" || !Number.isFinite(radius) || radius <= 0) {
      throw new GeographicScopeError("Radius scopes require a valid center point and positive radiusMeters.");
    }
  }

  if (input.target === "organization") {
    if (input.kind !== "organization_service_area") throw new GeographicScopeError("Organization targets only support organization_service_area.");
    assertExchangeWrite(input.actor);
    const scopeId = await upsertOrganizationGeographicScope({ organizationId: input.actor.organizationId, scope });
    return { scopeId, target: "organization" as const, organizationId: input.actor.organizationId, scope };
  }

  const publicId = clean(input.recordId, 180);
  if (!publicId) throw new GeographicScopeError("recordId is required for Exchange record scopes.");
  const record = await ownedExchangeRecord(input.actor, publicId);
  if (!record) throw new GeographicScopeError("The Exchange record was not found for the active organization.", 404, "record_not_found");
  if (!allowedKindForRecordType(record.record_type, input.kind)) throw new GeographicScopeError("The requested geographic scope kind does not apply to this record type.", 409, "scope_kind_mismatch");
  assertExchangeWrite(input.actor, writePermissionForRecordType(record.record_type));
  const scopeId = await upsertExchangeRecordGeographicScope({ exchangeRecordId: record.id, scope });
  return { scopeId, target: "record" as const, recordId: publicId, scope };
}
