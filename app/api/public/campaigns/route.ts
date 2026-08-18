import { NextResponse } from "next/server";
import {
  buildCampaignNavigationTree,
  campaigns,
  liveCampaignFamilies,
} from "@/lib/public/campaigns";

export async function GET() {
  return NextResponse.json(
    {
      families: liveCampaignFamilies(),
      campaigns: campaigns.filter((campaign) => campaign.status === "live"),
      navigation: buildCampaignNavigationTree(),
    },
    {
      headers: {
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      },
    },
  );
}
