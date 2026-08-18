import Link from "next/link";
import { notFound } from "next/navigation";
import { AcquisitionContextCapture } from "@/components/marketing/acquisition-context";
import {
  CampaignBreadcrumbs,
  CampaignHierarchy,
} from "@/components/public/campaign-hierarchy";
import { PublicFooter } from "@/components/public/public-footer";
import { PublicHeader } from "@/components/public/public-header";
import {
  campaignCanonicalPath,
  campaignsForFamily,
  getCampaignFamily,
  liveCampaignFamilies,
  type CampaignFamily,
} from "@/lib/public/campaigns";

export function generateStaticParams() {
  return liveCampaignFamilies().map((family) => ({ family: family.id }));
}

export default async function CampaignFamilyPage({
  params,
}: {
  params: Promise<{ family: string }>;
}) {
  const { family: familyParam } = await params;
  const family = getCampaignFamily(familyParam);
  if (!family) notFound();
  const campaigns = campaignsForFamily(family.id);

  return (
    <main className="campaign-shell">
      <AcquisitionContextCapture />
      <div className="campaign-accent" aria-hidden="true" />
      <PublicHeader />

      <div className="campaign-page-width">
        <CampaignBreadcrumbs family={family.id} />
        <header className="campaign-directory-hero">
          <p className="eyebrow">Campaign family</p>
          <h1>{family.label}</h1>
          <p>{family.summary}</p>
        </header>

        <div className="campaign-directory-layout">
          <CampaignHierarchy activeFamily={family.id as CampaignFamily} />
          <section aria-labelledby="campaign-family-children">
            <p className="eyebrow">Campaign children</p>
            <h2 id="campaign-family-children" className="sr-only">{family.label} campaigns</h2>
            <div className="campaign-directory-grid">
              {campaigns.map((campaign) => (
                <article className="campaign-directory-card" key={campaign.slug}>
                  <p className="eyebrow">{campaign.eyebrow}</p>
                  <h2>{campaign.headline}</h2>
                  <p>{campaign.summary}</p>
                  <p className="muted">Audience: {campaign.audience}</p>
                  <Link href={campaignCanonicalPath(campaign)}>Open campaign workflow →</Link>
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>

      <PublicFooter />
    </main>
  );
}
