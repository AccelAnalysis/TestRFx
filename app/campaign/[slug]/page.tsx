import { notFound } from "next/navigation";
import { CampaignLandingPage } from "@/components/public/campaign-landing-page";
import {
  buildCampaignRegistrationHref,
  campaigns,
  getCampaign,
  type CampaignSearchParams,
} from "@/lib/public/campaigns";

export function generateStaticParams() {
  return campaigns.filter((campaign) => campaign.status === "live").map((campaign) => ({ slug: campaign.slug }));
}

export default async function CampaignPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<CampaignSearchParams>;
}) {
  const { slug } = await params;
  const campaign = getCampaign(slug);
  if (!campaign) notFound();
  const attribution = await searchParams;
  const registrationHref = buildCampaignRegistrationHref(campaign, attribution);
  return <CampaignLandingPage campaign={campaign} registrationHref={registrationHref} />;
}
