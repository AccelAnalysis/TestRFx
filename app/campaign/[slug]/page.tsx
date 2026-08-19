import { notFound, redirect } from "next/navigation";
import {
  campaignCanonicalPath,
  campaigns,
  getCampaign,
} from "@/lib/public/campaigns";

export function generateStaticParams() {
  return campaigns
    .filter((campaign) => campaign.status === "live")
    .map((campaign) => ({ slug: campaign.slug }));
}

export default async function LegacyCampaignPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const campaign = getCampaign(slug);
  if (!campaign) notFound();
  redirect(campaignCanonicalPath(campaign));
}
