export const RESOURCE_CATEGORY_IDS = [
  "economic_business_development",
  "business_associations_networks",
  "entrepreneurship_startup_support",
  "workspace_business_facilities",
  "procurement_government_contracting",
  "workforce_talent",
  "capital_finance",
  "export_trade_market_expansion",
  "technical_professional_assistance",
  "manufacturing_operational_support",
  "innovation_technology_research",
  "real_estate_site_resources",
  "regulatory_licensing_compliance",
  "mentoring_advisory",
  "community_institutional_resources",
  "connectivity_infrastructure",
  "specialized_industry_resources",
  "programs_not_places",
] as const;

export type ResourceCategoryId = (typeof RESOURCE_CATEGORY_IDS)[number];
export type ResourceProviderClass = "community_institutional" | "commercial";
export type ResourceParticipationPolicy = "free_standard" | "commercial_paid";

export interface ResourceProviderTypeDefinition {
  id: string;
  label: string;
  category: ResourceCategoryId;
  defaultClass: ResourceProviderClass;
  description: string;
}

const community = (id: string, label: string, category: ResourceCategoryId, description: string): ResourceProviderTypeDefinition => ({ id, label, category, defaultClass: "community_institutional", description });
const commercial = (id: string, label: string, category: ResourceCategoryId, description: string): ResourceProviderTypeDefinition => ({ id, label, category, defaultClass: "commercial", description });

export const resourceProviderTypes: ResourceProviderTypeDefinition[] = [
  community("economic-development-office", "Economic development office", "economic_business_development", "Public or nonprofit economic-development organization."),
  community("economic-development-authority", "Economic development authority", "economic_business_development", "Public development or industrial authority."),
  community("regional-development-organization", "Regional development organization", "economic_business_development", "Regional public/nonprofit business-development organization."),
  commercial("site-selection-consultant", "Site-selection consultant", "economic_business_development", "Commercial location, incentives, or expansion adviser."),

  community("chamber-of-commerce", "Chamber of commerce", "business_associations_networks", "Recognized local or regional chamber/business-support association."),
  community("nonprofit-business-association", "Nonprofit business association", "business_associations_networks", "Mission-driven business council, supplier network, or affinity business organization."),
  commercial("commercial-business-network", "Commercial business network", "business_associations_networks", "For-profit networking, executive, or lead-generation community."),

  community("sbdc", "Small Business Development Center", "entrepreneurship_startup_support", "Publicly supported SBDC counseling and entrepreneurship program."),
  community("score", "SCORE", "entrepreneurship_startup_support", "Nonprofit small-business mentoring organization."),
  community("wbc", "Women's Business Center", "entrepreneurship_startup_support", "Publicly supported Women's Business Center."),
  community("vboc", "Veterans Business Outreach Center", "entrepreneurship_startup_support", "Publicly supported Veterans Business Outreach Center."),
  community("nonprofit-incubator", "Public / nonprofit incubator", "entrepreneurship_startup_support", "Government, university, or nonprofit incubator/accelerator."),
  commercial("commercial-incubator", "Commercial incubator / accelerator", "entrepreneurship_startup_support", "For-profit accelerator, venture studio, or founder program."),

  community("public-coworking", "Public / nonprofit coworking space", "workspace_business_facilities", "Coworking or shared workspace operated as public/nonprofit business infrastructure."),
  community("makerspace", "Public / nonprofit makerspace", "workspace_business_facilities", "Institutional makerspace, fabrication lab, or shared technical facility."),
  commercial("coworking-space", "Coworking / shared office provider", "workspace_business_facilities", "Commercial coworking, executive-suite, or meeting-space provider."),
  commercial("commercial-kitchen", "Commercial kitchen / shared facility", "workspace_business_facilities", "Commercial shared production, lab, kitchen, storage, or flex-space provider."),

  community("apex-accelerator", "APEX Accelerator", "procurement_government_contracting", "Government-contracting assistance organization."),
  community("government-procurement-office", "Government procurement assistance", "procurement_government_contracting", "Public vendor, certification, procurement, or contracting assistance."),
  commercial("govcon-consultant", "Government-contracting consultant", "procurement_government_contracting", "Commercial capture, proposal, certification, or compliance service."),

  community("workforce-board", "Workforce development board", "workforce_talent", "Public workforce board or workforce center."),
  community("community-college", "Community college", "workforce_talent", "Public community college, technical college, or workforce-training institution."),
  community("public-university", "Public university", "workforce_talent", "Public higher-education and workforce/entrepreneurship resource provider."),
  commercial("staffing-firm", "Staffing / recruiting firm", "workforce_talent", "Commercial staffing, recruiting, executive-search, or HR provider."),
  commercial("private-training-provider", "Private training provider", "workforce_talent", "Commercial training, credential, apprenticeship, or corporate-learning provider."),

  community("cdfi", "Community Development Financial Institution", "capital_finance", "Mission-driven CDFI or community capital program."),
  community("public-loan-fund", "Public loan / incentive fund", "capital_finance", "Government or nonprofit loan, grant, incentive, or revolving fund."),
  commercial("bank", "Bank", "capital_finance", "Commercial bank offering business financial products."),
  commercial("credit-union", "Credit union", "capital_finance", "Credit union offering business financial products."),
  commercial("commercial-lender", "Commercial lender / finance company", "capital_finance", "Commercial lending, equipment finance, factoring, or fintech provider."),
  commercial("investment-provider", "Investment / capital provider", "capital_finance", "Venture, private equity, angel, investment banking, or related capital provider."),

  community("export-assistance-center", "Export assistance center", "export_trade_market_expansion", "Public export, trade, or international-market assistance."),
  commercial("trade-consultant", "Export / trade consultant", "export_trade_market_expansion", "Commercial export, customs, freight, localization, or international-market service."),

  community("public-technical-assistance", "Public technical assistance", "technical_professional_assistance", "Institutional counseling, legal clinic, digital-assistance, or business-advisory program."),
  commercial("professional-services-firm", "Professional services firm", "technical_professional_assistance", "Commercial consulting, accounting, legal, marketing, IT, cybersecurity, analytics, or advisory provider."),

  community("manufacturing-extension", "Manufacturing extension / assistance center", "manufacturing_operational_support", "Public or university manufacturing-extension and supplier-development resource."),
  commercial("engineering-manufacturing-service", "Engineering / manufacturing service", "manufacturing_operational_support", "Commercial engineering, prototyping, testing, fabrication, quality, or operations service."),

  community("research-center", "Public / university research center", "innovation_technology_research", "Institutional R&D, technology-transfer, commercialization, or innovation center."),
  commercial("commercial-rd-provider", "Commercial R&D / technology provider", "innovation_technology_research", "Private research, laboratory, product-development, or technology service."),

  community("public-site-inventory", "Public site / property resource", "real_estate_site_resources", "Government or authority property inventory, site-selection, or permitting resource."),
  commercial("commercial-real-estate", "Commercial real-estate provider", "real_estate_site_resources", "Broker, landlord, property manager, developer, flex-space, warehouse, or site adviser."),

  community("government-regulatory-office", "Government regulatory / licensing assistance", "regulatory_licensing_compliance", "Public licensing, permitting, certification, environmental, or regulatory-navigation resource."),
  commercial("compliance-consultant", "Compliance / licensing consultant", "regulatory_licensing_compliance", "Commercial compliance, safety, environmental, certification, audit, or regulatory adviser."),

  community("nonprofit-mentoring", "Nonprofit / institutional mentoring", "mentoring_advisory", "Public, university, or nonprofit mentoring and advisory program."),
  commercial("business-coach", "Business / executive coach", "mentoring_advisory", "Commercial coaching, fractional executive, mastermind, or advisory service."),

  community("public-library", "Public library business services", "community_institutional_resources", "Library business center, research, meeting, or technology resource."),
  community("foundation", "Foundation / community foundation", "community_institutional_resources", "Foundation offering qualifying business/community programs."),
  community("local-government", "Local / regional government", "community_institutional_resources", "Government organization offering business-support services."),

  community("public-connectivity", "Public connectivity / technology access", "connectivity_infrastructure", "Public broadband, Wi-Fi, computer lab, or teleconference resource."),
  commercial("connectivity-provider", "Connectivity / technology infrastructure provider", "connectivity_infrastructure", "Commercial telecom, ISP, data-center, managed-network, or business technology provider."),

  community("institutional-industry-center", "Institutional industry center", "specialized_industry_resources", "Public/university/nonprofit industry-specific support center."),
  commercial("commercial-industry-service", "Commercial industry service provider", "specialized_industry_resources", "Commercial industry-specific consulting or operating service."),

  community("public-program", "Public / nonprofit program", "programs_not_places", "Grant, loan, training, procurement, mentorship, export, workforce, or accelerator program."),
  commercial("commercial-program", "Commercial program", "programs_not_places", "Paid training, accelerator, coaching, certification-preparation, networking, or advisory program."),
];

export const resourceProviderTypeById = Object.fromEntries(resourceProviderTypes.map((type) => [type.id, type])) as Record<string, ResourceProviderTypeDefinition>;

export interface ProviderClassificationInput {
  providerType: string;
  overrideClass?: ResourceProviderClass;
  overrideBasis?: string;
}

export interface ProviderClassification {
  providerClass: ResourceProviderClass;
  participationPolicy: ResourceParticipationPolicy;
  basis: string;
  requiresReview: boolean;
}

export function participationPolicyFor(providerClass: ResourceProviderClass): ResourceParticipationPolicy {
  return providerClass === "community_institutional" ? "free_standard" : "commercial_paid";
}

export function classifyResourceProvider(input: ProviderClassificationInput): ProviderClassification | undefined {
  const definition = resourceProviderTypeById[input.providerType];
  if (!definition && !input.overrideClass) return undefined;

  if (input.overrideClass) {
    const basis = input.overrideBasis?.trim();
    if (!basis) {
      return {
        providerClass: input.overrideClass,
        participationPolicy: participationPolicyFor(input.overrideClass),
        basis: "Manual classification requires documented basis before publication.",
        requiresReview: true,
      };
    }
    return {
      providerClass: input.overrideClass,
      participationPolicy: participationPolicyFor(input.overrideClass),
      basis,
      requiresReview: false,
    };
  }

  return {
    providerClass: definition!.defaultClass,
    participationPolicy: participationPolicyFor(definition!.defaultClass),
    basis: `Default policy for provider type: ${definition!.label}`,
    requiresReview: false,
  };
}
