import { describe, expect, it } from "vitest";
import type { ExchangeRecord } from "@/lib/exchange/contracts";
import { allProfileGeographies, geographyDisplayLabel, type GeographyProfile } from "@/lib/geography/contracts";
import { defaultSearchState, searchExchangeRecords, searchStateFromParams, searchStateToParams } from "@/lib/exchange/search";

const profile: GeographyProfile = {
  hierarchy: {
    country: { key: "country", type: "country", name: "United States", countryCode: "US", source: "census_geocoder" },
    state: { key: "state", type: "state", name: "Virginia", countryCode: "US", stateCode: "VA", geoid: "51", source: "census_geocoder" },
    regionMarket: { key: "market", type: "region_market", name: "Hampton Roads", countryCode: "US", stateCode: "VA", externalId: "hampton-roads-va", source: "rfxchange_market" },
    countyEquivalent: { key: "county", type: "county_equivalent", name: "Norfolk city", countryCode: "US", stateCode: "VA", geoid: "51710", source: "census_geocoder" },
    censusTract: { key: "tract", type: "census_tract", name: "Census Tract 1", countryCode: "US", stateCode: "VA", geoid: "51710000100", source: "census_geocoder" },
    blockGroup: { key: "bg", type: "block_group", name: "Block Group 1", countryCode: "US", stateCode: "VA", geoid: "517100001001", source: "census_geocoder" },
    censusBlock: { key: "block", type: "census_block", name: "Block 1000", countryCode: "US", stateCode: "VA", geoid: "517100001001000", source: "census_geocoder" },
  },
  parallel: [
    { key: "oz", type: "opportunity_zone", name: "Opportunity Zone 51710000100", countryCode: "US", stateCode: "VA", externalId: "51710000100", source: "federal_program", economicDevelopmentZone: true },
  ],
  point: { latitude: 36.85, longitude: -76.29 },
  derivedFrom: "address",
  resolver: "test",
};

const record: ExchangeRecord = {
  id: "res-geography-test",
  type: "resource",
  title: "Business assistance",
  organization: "Test provider",
  summary: "Reference record",
  geography: "Norfolk city, VA",
  metadata: [],
  geographyProfile: profile,
  resource: { category: "Business Support", availability: "available", availabilityLabel: "Available", visibility: "public-location", status: "active" },
};

describe("platform geography", () => {
  it("preserves country-to-block hierarchy plus parallel identifiers", () => {
    expect(allProfileGeographies(profile).map((item) => item.type)).toEqual([
      "country", "state", "region_market", "county_equivalent", "census_tract", "block_group", "census_block", "opportunity_zone",
    ]);
    expect(geographyDisplayLabel(profile)).toBe("Norfolk city, VA");
  });

  it("filters Exchange records by granular and economic-development geographies", () => {
    const tract = defaultSearchState();
    tract.filters.geographyIds = ["51710000100"];
    expect(searchExchangeRecords([record], "resources", tract).total).toBe(1);

    const zone = defaultSearchState();
    zone.filters.geographyTypes = ["opportunity_zone"];
    expect(searchExchangeRecords([record], "resources", zone).total).toBe(1);

    const missing = defaultSearchState();
    missing.filters.geographyIds = ["missing"];
    expect(searchExchangeRecords([record], "resources", missing).total).toBe(0);
  });

  it("round trips structured geography filters through shareable search URLs", () => {
    const state = defaultSearchState("support");
    state.filters.geographyIds = ["517100001001"];
    state.filters.geographyTypes = ["block_group"];
    const parsed = searchStateFromParams(searchStateToParams(state));
    expect(parsed.filters.geographyIds).toEqual(["517100001001"]);
    expect(parsed.filters.geographyTypes).toEqual(["block_group"]);
  });
});
