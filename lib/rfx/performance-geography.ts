import "server-only";

import type { GeographicScope, GeographyReference } from "@/lib/geography/contracts";
import { getDatabase } from "@/lib/server/database";
import { resolveCensusAddressProfile } from "@/lib/server/geography/census-profile-resolver";
import { upsertExchangeRecordGeographicScope } from "@/lib/server/geography/geography-repository";
import type { RfxWorkspace } from "./contracts";

function value(workspace: RfxWorkspace, key: string) {
  const current = workspace.values[key];
  return current === null || current === undefined ? "" : String(current).trim();
}

function parseUsAddress(value: string) {
  const parts = value.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length < 3 || !/^\d/.test(parts[0])) return undefined;
  const stateZip = parts.at(-1) ?? "";
  const match = stateZip.match(/^([A-Za-z]{2})\s*(\d{5}(?:-\d{4})?)?$/);
  if (!match) return undefined;
  return {
    address1: parts.slice(0, -2).join(", "),
    city: parts.at(-2) ?? "",
    state: match[1].toUpperCase(),
    postalCode: match[2],
  };
}

async function geographyReferences(tokens: string[]) {
  if (!tokens.length) return [];
  const sql = getDatabase();
  const rows = await sql<{
    id: string;
    geography_type: GeographyReference["type"];
    name: string;
    country_code: string;
    state_code: string | null;
    fips_code: string | null;
    external_id: string | null;
    vintage: string | null;
    source_layer: string | null;
    is_economic_development_zone: boolean;
  }[]>`
    SELECT id::text, geography_type, name, country_code, state_code, fips_code,
           external_id, vintage, source_layer, is_economic_development_zone
    FROM geographies
    WHERE id::text IN ${sql(tokens)}
       OR external_id IN ${sql(tokens)}
       OR fips_code IN ${sql(tokens)}
       OR lower(name) IN ${sql(tokens.map((token) => token.toLowerCase()))}
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

export async function buildRfxPerformanceScope(workspace: RfxWorkspace): Promise<GeographicScope | undefined> {
  const mode = value(workspace, "performance.mode");
  const explicitAddress = {
    address1: value(workspace, "performance.address1"),
    city: value(workspace, "performance.city"),
    state: value(workspace, "performance.state"),
    postalCode: value(workspace, "performance.postalCode"),
  };
  const legacy = value(workspace, "capabilities.geography") || value(workspace, "scope.serviceLocations");
  const parsedLegacyAddress = !mode ? parseUsAddress(legacy) : undefined;
  const address = explicitAddress.address1 && explicitAddress.city && explicitAddress.state
    ? explicitAddress
    : parsedLegacyAddress;

  if ((mode === "Specific address" || (!mode && address)) && address) {
    const resolved = await resolveCensusAddressProfile({
      address1: address.address1,
      city: address.city,
      state: address.state,
      postalCode: address.postalCode || undefined,
    });
    return {
      kind: "rfx_performance_area",
      mode: "address",
      label: resolved.matchedAddress,
      address: { ...address, postalCode: address.postalCode || undefined, country: "US" },
      point: resolved.coordinates,
      derivedProfile: resolved.profile,
    };
  }

  if (mode === "Statewide") return { kind: "rfx_performance_area", mode: "statewide", label: legacy || "Statewide performance area" };
  if (mode === "Nationwide") return { kind: "rfx_performance_area", mode: "nationwide", label: "Nationwide performance area" };
  if (mode === "Remote / virtual") return { kind: "rfx_performance_area", mode: "remote", label: "Remote / virtual performance" };

  const rawIds = value(workspace, "performance.geographyIds");
  const tokens = rawIds.split(/[\n,;]+/).map((item) => item.trim()).filter(Boolean).slice(0, 50);
  const geographies = await geographyReferences(tokens);
  if (geographies.length) {
    return {
      kind: "rfx_performance_area",
      mode: "geographies",
      label: legacy || geographies.map((item) => item.name).join(", "),
      geographies,
    };
  }

  if (legacy) return { kind: "rfx_performance_area", mode: "geographies", label: legacy };
  return undefined;
}

export async function persistRfxPerformanceScope(exchangeRecordId: string, scope: GeographicScope | undefined) {
  if (!scope) return undefined;
  return upsertExchangeRecordGeographicScope({ exchangeRecordId, scope });
}
