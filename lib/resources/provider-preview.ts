import type { ResourceProviderExchangeRecord } from "./provider-listing";
import { classifyResourceProvider } from "./provider-classification";

type PreviewCandidate = [
  seedKey: string,
  organization: string,
  providerType: string,
  resourceCategory: string,
  serviceName: string,
  serviceSummary: string,
  serviceArea: string,
  sourceName: string,
  sourceUrl: string,
  authority: "authoritative" | "curated"
];

const categoryLabels: Record<string, string> = {
  economic_business_development: "Economic & Business Development",
  business_associations_networks: "Business Associations & Networks",
  entrepreneurship_startup_support: "Entrepreneurship & Startup Support",
  workforce_talent: "Workforce & Talent",
  workspace_business_facilities: "Workspace & Business Facilities",
  innovation_technology_research: "Innovation, Technology & Research",
  specialized_industry_resources: "Specialized Industry Resources",
  capital_finance: "Capital & Finance",
};

/**
 * Static, source-backed projection of the Hampton Roads seed pack.
 *
 * These records let the current read-only TestRFx preview show real provider
 * candidates while the protected ingestion pipeline remains the only path that
 * can create canonical Organizations, Locations, Resource records, provenance,
 * and claim state in the runtime database. Coordinates are deliberately absent:
 * map markers are created only after authoritative geocoding/location review.
 */
const hamptonRoadsProviderPreviewCandidates: PreviewCandidate[] = [
  ["hrva-hampton-roads-alliance", "Hampton Roads Alliance", "regional-development-organization", "economic_business_development", "Regional economic development support", "Regional economic-development, business-attraction, and site-selection support for Hampton Roads.", "Hampton Roads, Virginia", "Hampton Roads Alliance 2024 Annual Report", "https://hamptonroadsalliance.com/wp-content/uploads/2025/02/2024-Annual-Report-Hampton-Roads-Alliance.pdf", "authoritative"],
  ["hrva-hampton-roads-chamber", "Hampton Roads Chamber", "chamber-of-commerce", "business_associations_networks", "Business chamber and member network", "Business networking, advocacy, and education serving businesses across the Chamber's Hampton Roads service area.", "Chesapeake | Norfolk | Portsmouth | Suffolk | Virginia Beach", "Hampton Roads Chamber member-directory record", "https://business.hrchamber.com/member-directory/Details/hampton-roads-chamber-3589566", "curated"],
  ["hrva-hampton-roads-sbdc", "Hampton Roads Small Business Development Center", "sbdc", "entrepreneurship_startup_support", "Small-business counseling and assistance", "Small-business counseling and assistance including access to capital and government-contracting support.", "Hampton Roads, Virginia", "Hampton Roads SBDC official public pages", "https://hrsbdc.com/contact-us/", "authoritative"],
  ["hrva-hampton-roads-workforce-council", "Hampton Roads Workforce Council", "workforce-board", "workforce_talent", "Workforce and employer services", "Workforce-development and employer services supporting recruitment, training, and talent needs in Hampton Roads.", "Hampton Roads, Virginia", "Hampton Roads Workforce Council Contact Us", "https://www.theworkforcecouncil.org/contact-us/", "authoritative"],
  ["hrva-odu-iie", "Old Dominion University Institute for Innovation & Entrepreneurship", "public-university", "entrepreneurship_startup_support", "Entrepreneurship and innovation support", "Business counseling, entrepreneurship, innovation, and commercialization support through Old Dominion University.", "Hampton Roads, Virginia | Virginia", "ODU Institute for Innovation & Entrepreneurship", "https://www.odu.edu/iie", "curated"],
  ["hrva-757-collab", "757 Collab", "nonprofit-incubator", "entrepreneurship_startup_support", "Startup support and founder programs", "Startup support, founder programming, mentorship, and entrepreneurship resources for southeastern Virginia.", "Hampton Roads, Virginia", "757 Collab official public site", "https://757collab.org/", "curated"],
  ["hrva-retail-alliance", "Retail Alliance", "nonprofit-business-association", "business_associations_networks", "Retail business association and support", "Business education, networking, advocacy, and retail-support resources for the Hampton Roads business community.", "Hampton Roads, Virginia", "Retail Alliance", "https://retailalliance.com/", "curated"],
  ["hrva-virginia-maritime-association", "Virginia Maritime Association", "nonprofit-business-association", "specialized_industry_resources", "Maritime industry business network", "Maritime-industry association and member network supporting Virginia's port and maritime business community.", "Hampton Roads, Virginia | Virginia", "Virginia Maritime Association official public site", "https://vamaritime.com/", "curated"],
  ["hrva-greater-williamsburg-chamber", "Greater Williamsburg Chamber of Commerce", "chamber-of-commerce", "business_associations_networks", "Business chamber and member network", "Business networking, advocacy, and education for the Greater Williamsburg business community.", "Greater Williamsburg, Virginia", "Greater Williamsburg Chamber Contact", "https://connect.williamsburgchamber.com/contact", "curated"],
  ["hrva-virginia-peninsula-chamber", "Virginia Peninsula Chamber", "chamber-of-commerce", "business_associations_networks", "Business chamber and member network", "Business networking, advocacy, and education serving the Virginia Peninsula business community.", "Hampton | Newport News | Poquoson | James City County | York County", "Virginia Peninsula Chamber Contact", "https://business.virginiapeninsulachamber.com/contact", "curated"],
  ["hrva-launchpad-incubator", "Launchpad Greater Williamsburg Business Incubator", "nonprofit-incubator", "entrepreneurship_startup_support", "Business incubation and startup support", "Business-incubation and entrepreneurship support provided through the Greater Williamsburg Launchpad initiative.", "James City County | City of Williamsburg | York County", "James City County Launchpad Incubator", "https://www.jamescitycountyva.gov/2976/Launchpad-Incubator", "authoritative"],
  ["hrva-bloom-coworking", "Bloom Coworking", "public-coworking", "workspace_business_facilities", "Coworking and meeting space", "Community-oriented coworking, shared workspace, and meeting-space resources in Portsmouth.", "Portsmouth | Hampton Roads, Virginia", "Bloom Coworking About", "https://bloomcoworking.org/about-w-video/", "curated"],
  ["hrva-hampton-reaktor", "Hampton REaKTOR Technology Innovation Center", "nonprofit-incubator", "innovation_technology_research", "Technology incubation and innovation support", "Business-incubation and technology-innovation support provided through the City of Hampton.", "Hampton | Hampton Roads, Virginia", "City of Hampton Business Incubators", "https://www.hampton.gov/2362/Business-Incubators", "authoritative"],
  ["hrva-virginia-beach-hive", "The HIVE", "public-program", "entrepreneurship_startup_support", "Small-business resource hub", "Small-business resource navigation, entrepreneurship support, workspace, and business programming provided by Virginia Beach Economic Development.", "Virginia Beach", "Virginia Beach The HIVE", "https://yesvirginiabeach.com/the-hive", "authoritative"],
  ["hrva-norfolk-economic-development", "Norfolk Department of Economic Development", "economic-development-office", "economic_business_development", "Economic development and business support", "Economic-development, business-retention, site-selection, and business-support services for Norfolk.", "Norfolk", "Norfolk Department of Economic Development", "https://norfolkdevelopment.com/contact-us-2/", "authoritative"],
  ["hrva-virginia-beach-economic-development", "Virginia Beach Department of Economic Development", "economic-development-office", "economic_business_development", "Economic development and business support", "Economic-development, business-retention, site-selection, and small-business support for Virginia Beach.", "Virginia Beach", "Virginia Beach Department of Economic Development", "https://yesvirginiabeach.com/", "authoritative"],
  ["hrva-chesapeake-economic-development", "Chesapeake Economic Development", "economic-development-office", "economic_business_development", "Economic development and business support", "Economic-development, business-retention, site-selection, and small-business support for Chesapeake.", "Chesapeake", "Chesapeake Economic Development", "https://chesapeakeva.biz/", "authoritative"],
  ["hrva-portsmouth-economic-development", "Portsmouth Economic Development", "economic-development-office", "economic_business_development", "Economic development and business support", "Economic-development, business-retention, site-selection, and small-business support for Portsmouth.", "Portsmouth", "Portsmouth Economic Development", "https://www.accessportsmouthva.com/", "authoritative"],
  ["hrva-hampton-economic-development", "Hampton Economic Development", "economic-development-office", "economic_business_development", "Economic development and business support", "Economic-development, business-retention, site-selection, and small-business support for Hampton.", "Hampton", "City of Hampton Economic Development", "https://www.hampton.gov/4072/Economic-Development", "authoritative"],
  ["hrva-newport-news-economic-development-authority", "Newport News Economic Development Authority", "economic-development-authority", "economic_business_development", "Economic development and business support", "Economic-development, business-retention, site-selection, and investment-support services for Newport News.", "Newport News", "Newport News Economic Development", "https://newportnewsva.com/contact/", "authoritative"],
  ["hrva-isle-of-wight-economic-development", "Isle of Wight County Economic Development", "economic-development-office", "economic_business_development", "Economic development and business support", "Economic-development, business-retention, site-selection, and small-business support for Isle of Wight County.", "Isle of Wight County", "Isle of Wight County Economic Development Department", "https://www.insidetheisle.com/about-us/economic-development-department/", "authoritative"],
  ["hrva-james-city-county-economic-development", "James City County Office of Economic Development", "economic-development-office", "economic_business_development", "Economic development and business support", "Economic-development, business-retention, site-selection, and small-business support for James City County.", "James City County", "James City County Economic Development Contact Us", "https://www.jamescitycountyva.gov/3160/Contact-Us", "authoritative"],
  ["hrva-york-county-economic-tourism-development", "York County Department of Economic & Tourism Development", "economic-development-office", "economic_business_development", "Economic development and business support", "Economic-development, business-retention, site-selection, and small-business support for York County.", "York County", "York County Economic Development", "https://www.yorkcounty.gov/239/Economic-Development", "authoritative"],
  ["hrva-williamsburg-economic-development-authority", "Williamsburg Economic Development Authority", "economic-development-authority", "economic_business_development", "Economic development and business support", "Economic-development and business-support activities of the Williamsburg Economic Development Authority.", "Williamsburg", "City of Williamsburg Economic Development Authority", "https://williamsburgva.gov/408/Economic-Development-Authority-EDA", "authoritative"],
  ["hrva-townebank", "TowneBank", "bank", "capital_finance", "Business banking and commercial finance", "Business-banking and commercial-finance services available through TowneBank in Hampton Roads.", "Hampton Roads, Virginia", "TowneBank Churchland", "https://www.townebank.com/location-and-atms/portsmouth-churchland/", "curated"],
  ["hrva-langley-federal-credit-union", "Langley Federal Credit Union", "credit-union", "capital_finance", "Business banking and SBA lending", "Business-banking, commercial-lending, and SBA-lending services offered by Langley Federal Credit Union.", "Hampton Roads, Virginia", "Langley Federal Credit Union Business SBA Loans", "https://www.langleyfcu.org/business-sba-loans", "curated"],
  ["hrva-bayport-credit-union", "BayPort Credit Union", "credit-union", "capital_finance", "Business banking and commercial lending", "Business-banking and lending services offered by BayPort Credit Union.", "Hampton Roads, Virginia", "BayPort Business Banking and Loans", "https://www.bayportcu.org/business-banking-and-loans/", "curated"],
  ["hrva-first-advantage-federal-credit-union", "1st Advantage Federal Credit Union", "credit-union", "capital_finance", "Business banking and commercial lending", "Business accounts, business loans, and SBA-related services offered by 1st Advantage Federal Credit Union.", "Hampton Roads, Virginia", "1st Advantage Business Banking", "https://www.1stadvantage.org/business-banking/", "curated"],
  ["hrva-chartway-credit-union", "Chartway Credit Union", "credit-union", "capital_finance", "Business banking and commercial services", "Business accounts and business services offered by Chartway Credit Union.", "Hampton Roads, Virginia", "Chartway Business Accounts & Services", "https://www.chartway.com/business/business-accounts-services.html", "curated"],
  ["hrva-abnb-federal-credit-union", "ABNB Federal Credit Union", "credit-union", "capital_finance", "Business banking and commercial services", "Business-banking and business-service offerings from ABNB Federal Credit Union.", "Hampton Roads, Virginia", "ABNB Business Services", "https://www.abnbfcu.org/business-banking/business-services", "curated"],
  ["hrva-atlantic-union-bank", "Atlantic Union Bank", "bank", "capital_finance", "Business banking and commercial finance", "Business-banking and commercial-finance services available through Atlantic Union Bank in Hampton Roads.", "Hampton Roads, Virginia", "Atlantic Union Bank Business", "https://www.atlanticunionbank.com/business", "curated"],
  ["hrva-gather-workspaces", "Gather Workspaces", "coworking-space", "workspace_business_facilities", "Coworking, meeting, and office space", "Commercial coworking, meeting, and office-space locations in Newport News, Norfolk, and Virginia Beach.", "Hampton Roads, Virginia", "Gather Workspaces Locations", "https://gatherworkspaces.com/locations/", "curated"],
];

export const resourceProviderPreviewSeed: ResourceProviderExchangeRecord[] = hamptonRoadsProviderPreviewCandidates.map((candidate) => {
  const [
    seedKey,
    organization,
    providerType,
    resourceCategory,
    serviceName,
    serviceSummary,
    serviceArea,
    sourceName,
    sourceUrl,
    authority,
  ] = candidate;
  const classification = classifyResourceProvider({ providerType });
  if (!classification) throw new Error(`Unknown Hampton Roads Resource Provider type: ${providerType}`);

  const categoryLabel = categoryLabels[resourceCategory] ?? resourceCategory;
  const classLabel = classification.providerClass === "community_institutional"
    ? "Community / Institutional"
    : "Commercial";

  return {
    id: `res-seed-preview-${seedKey}`,
    type: "resource",
    title: serviceName,
    organization,
    summary: serviceSummary,
    geography: serviceArea,
    metadata: [categoryLabel, classLabel, "Unclaimed listing", "Source-backed seed"],
    card: {
      eyebrow: classification.providerClass === "community_institutional"
        ? "Community Resource Provider"
        : "Commercial Resource Provider",
      classifications: [categoryLabel, classLabel],
      status: { label: "Unclaimed", tone: "neutral" },
    },
    resource: {
      category: categoryLabel,
      availability: "unknown",
      availabilityLabel: "Provider confirmation required",
      serviceArea,
      visibility: "service-area",
      status: "active",
    },
    resourceProvider: {
      providerType,
      providerClass: classification.providerClass,
      participationPolicy: classification.participationPolicy,
      claimState: "unclaimed",
      classificationBasis: classification.basis,
      marketKey: "hampton-roads-va",
      source: {
        sourceKey: seedKey,
        sourceName,
        sourceUrl,
        authority,
        lastCheckedAt: "2026-08-22T00:00:00.000Z",
      },
    },
  };
});
