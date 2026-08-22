import { NextResponse } from "next/server";
import { marketSeedPacks } from "@/lib/resources/market-seed-packs";
import { resourceProviderTypes, RESOURCE_CATEGORY_IDS } from "@/lib/resources/provider-classification";

export async function GET() {
  return NextResponse.json({
    marketSeedPacks,
    providerTypes: resourceProviderTypes,
    resourceCategories: RESOURCE_CATEGORY_IDS,
  }, { headers: { "Cache-Control": "public, max-age=300" } });
}
