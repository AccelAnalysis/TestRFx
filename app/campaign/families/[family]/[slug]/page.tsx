import { notFound } from "next/navigation";
import { CampaignLandingPage } from "@/components/public/campaign-landing-page";
import { campaigns, getCampaign } from "@/lib/public/campaigns";

export function generateStaticParams() {
  return campaigns
    .filter((campaign) => campaign.status === "live")
    .map((campaign) => ({ family: campaign.family, slug: campaign.slug }));
}

export default async function CampaignPage({
  params,
}: {
  params: Promise<{ family: string; slug: string }>;
}) {
  const { family, slug } = await params;
  const campaign = getCampaign(slug);
  if (!campaign || campaign.family !== family) notFound();
  return <CampaignLandingPage campaign={campaign} />;
}
