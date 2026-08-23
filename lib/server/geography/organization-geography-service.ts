import "server-only";

import { getDatabase } from "@/lib/server/database";
import type { GeographyOption, LocationVisibility, ServiceAreaMode } from "@/lib/onboarding/geography";
import type { GeographyProfile, GeographyReference } from "@/lib/geography/contracts";
import { ensureGeography, persistLocationGeographyProfile, upsertOrganizationGeographicScope } from "./geography-repository";

function jsonSafe(value: unknown) {
  return JSON.parse(JSON.stringify(value ?? {}));
}

export function onboardingGeographyReference(option: GeographyOption): GeographyReference {
  const type = option.type === "county" || option.type === "independent_city" ? "county_equivalent" : "place";
  return {
    key: `census_tigerweb:${type}:${option.geoid}`,
    type,
    name: option.name,
    countryCode: option.countryCode,
    stateCode: option.stateCode,
    geoid: option.geoid,
    externalId: option.geoid,
    source: "census_tigerweb",
    vintage: "Current_Current",
  };
}

export async function persistOrganizationGeography(input: {
  organizationId: string;
  address: {
    address1: string;
    address2?: string;
    city: string;
    state: string;
    postalCode?: string;
    country?: string;
  };
  matchedAddress: string;
  latitude: number;
  longitude: number;
  visibility: LocationVisibility;
  homeBased?: boolean;
  profile: GeographyProfile;
  primaryGeography: GeographyOption;
  serviceMode: ServiceAreaMode;
  serviceGeographies: GeographyOption[];
}) {
  const sql = getDatabase();
  return sql.begin(async (tx) => {
    const existingRows = await tx<{ id: string }[]>`
      SELECT id::text
      FROM locations
      WHERE organization_id = ${input.organizationId}::uuid
      ORDER BY is_primary DESC, created_at ASC
      LIMIT 1
    `;
    let locationId = existingRows[0]?.id;
    const address = {
      line1: input.address.address1,
      line2: input.address.address2,
      city: input.address.city,
      region: input.address.state,
      state: input.address.state,
      postalCode: input.address.postalCode,
      country: input.address.country ?? "US",
    };
    const normalized = { ...address, matchedAddress: input.matchedAddress };
    if (locationId) {
      await tx`
        UPDATE locations
        SET label = COALESCE(label, 'Primary organization location'),
            address = ${tx.json(jsonSafe(address))},
            normalized_address = ${tx.json(jsonSafe(normalized))},
            point = ST_SetSRID(ST_MakePoint(${input.longitude}, ${input.latitude}), 4326)::geography,
            visibility = ${input.visibility},
            is_primary = true,
            is_home_based = ${Boolean(input.homeBased)},
            verification_status = 'census-matched'
        WHERE id = ${locationId}::uuid
      `;
    } else {
      const rows = await tx<{ id: string }[]>`
        INSERT INTO locations (
          organization_id, label, address, normalized_address, point,
          visibility, is_primary, is_home_based, verification_status
        ) VALUES (
          ${input.organizationId}::uuid, 'Primary organization location', ${tx.json(jsonSafe(address))}, ${tx.json(jsonSafe(normalized))},
          ST_SetSRID(ST_MakePoint(${input.longitude}, ${input.latitude}), 4326)::geography,
          ${input.visibility}, true, ${Boolean(input.homeBased)}, 'census-matched'
        )
        RETURNING id::text
      `;
      locationId = rows[0]?.id;
    }
    if (!locationId) throw new Error("Canonical organization location could not be persisted.");

    const enrichedProfile = await persistLocationGeographyProfile(locationId, input.profile, { sql: tx });
    const primaryRef = onboardingGeographyReference(input.primaryGeography);
    const primaryId = await ensureGeography(tx, primaryRef);
    await tx`
      DELETE FROM organization_geographies
      WHERE organization_id = ${input.organizationId}::uuid AND relationship_type = 'primary'
    `;
    await tx`
      INSERT INTO organization_geographies (organization_id, geography_id, relationship_type)
      VALUES (${input.organizationId}::uuid, ${primaryId}::uuid, 'primary')
      ON CONFLICT DO NOTHING
    `;

    const serviceRefs = input.serviceGeographies.map(onboardingGeographyReference);
    await upsertOrganizationGeographicScope({
      organizationId: input.organizationId,
      sql: tx,
      scope: {
        kind: "organization_service_area",
        mode: input.serviceMode === "localities" ? "geographies" : input.serviceMode,
        label: input.serviceMode === "localities" ? "Selected service geographies" : input.serviceMode,
        ...(serviceRefs.length ? { geographies: serviceRefs } : {}),
        sourceLocationId: locationId,
      },
    });

    return { locationId, geographyProfile: enrichedProfile, serviceGeographies: serviceRefs };
  });
}
