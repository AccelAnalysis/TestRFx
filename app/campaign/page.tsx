import Link from "next/link";
import { AcquisitionContextCapture } from "@/components/marketing/acquisition-context";
import { CampaignHierarchy } from "@/components/public/campaign-hierarchy";
import { PublicFooter } from "@/components/public/public-footer";
import { PublicHeader } from "@/components/public/public-header";
import {
  campaignFamilyPath,
  campaignsForFamily,
  liveCampaignFamilies,
} from "@/lib/public/campaigns";

export default function CampaignIndexPage() {
  const families = liveCampaignFamilies();

  return (
    <main className="campaign-shell">
      <AcquisitionContextCapture />
      <div className="campaign-accent" aria-hidden="true" />
      <PublicHeader />

      <div className="campaign-page-width">
        <header className="campaign-directory-hero">
          <p className="eyebrow">Public / Acquisition Shell</p>
          <h1>Campaign Landing Pages</h1>
          <p>
            Campaigns organize acquisition by the concrete audiences, launch contexts, use cases,
            capability themes, membership paths, and partner/referral paths that currently exist in
            RFxchange. Each branch leads back into the same Identity, Onboarding, and Exchange chassis.
          </p>
        </header>

        <div className="campaign-directory-layout">
          <CampaignHierarchy />
          <section aria-labelledby="campaign-family-heading">
            <p className="eyebrow">Child workflows</p>
            <h2 id="campaign-family-heading" className="sr-only">Campaign families</h2>
            <div className="campaign-directory-grid">
              {families.map((family) => {
                const familyCampaigns = campaignsForFamily(family.id);
                return (
                  <article className="campaign-directory-card" key={family.id}>
                    <p className="eyebrow">{familyCampaigns.length} live path{familyCampaigns.length === 1 ? "" : "s"}</p>
                    <h2>{family.label}</h2>
                    <p>{family.summary}</p>
                    <Link href={campaignFamilyPath(family.id)}>Open {family.label} →</Link>
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      </div>

      <PublicFooter />
    </main>
  );
}
