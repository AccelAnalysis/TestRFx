import type { ExchangeLens } from "@/lib/exchange/contracts";

export type CampaignFamily =
  | "membership"
  | "audience"
  | "geography"
  | "use-case"
  | "capability-industry"
  | "partner"
  | "content"
  | "time-bounded";

export type CampaignStatus = "draft" | "scheduled" | "live" | "paused" | "completed" | "archived";

export interface CampaignStep {
  title: string;
  description: string;
}

export interface CampaignFaq {
  question: string;
  answer: string;
}

export interface CampaignDefinition {
  slug: string;
  status: CampaignStatus;
  family: CampaignFamily;
  eyebrow: string;
  headline: string;
  summary: string;
  audience: string;
  geography?: string;
  partner?: string;
  offer?: string;
  intendedLens: ExchangeLens;
  primaryCta: string;
  secondaryCta: string;
  problemTitle: string;
  problemCopy: string;
  proofPoints: string[];
  benefits: string[];
  steps: CampaignStep[];
  faqs: CampaignFaq[];
}

export type CampaignSearchParams = Record<string, string | string[] | undefined>;

const allowedLenses = new Set<ExchangeLens>(["rfx", "resources", "intelligence", "capabilities"]);
const handoffKeys = [
  "campaign",
  "source",
  "medium",
  "partner",
  "geography",
  "lens",
  "offer",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "ref",
] as const;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function setIfPresent(query: URLSearchParams, key: string, value: string | undefined) {
  if (value) query.set(key, value);
}

export const campaigns: CampaignDefinition[] = [
  {
    slug: "founding-membership",
    status: "live",
    family: "membership",
    eyebrow: "Founding membership",
    headline: "Join the first organizations building the RFxchange network.",
    summary: "Establish your organization, map what you can do, and enter one shared Exchange for RFx, resources, intelligence, and capability discovery.",
    audience: "Early RFxchange organizations",
    offer: "Founding membership",
    intendedLens: "capabilities",
    primaryCta: "Join the founding cohort",
    secondaryCta: "See how the Exchange works",
    problemTitle: "A network is only useful when participants can be found and understood.",
    problemCopy: "Founding members help establish the organization and capability density that makes local discovery, matching, referrals, and opportunity routing useful from the beginning.",
    proofPoints: ["One organization identity", "One capability profile", "Four Exchange lenses", "Campaign context preserved through onboarding"],
    benefits: ["Establish an Exchange-ready organization profile", "Represent capabilities through a governed structure", "Discover RFx, resources, intelligence, and organizations from the same operating environment"],
    steps: [
      { title: "Create your account", description: "Start with a single RFxchange identity." },
      { title: "Establish your organization", description: "Select or create the organization you represent." },
      { title: "Add geography and capabilities", description: "Build the context the Exchange uses for discovery." },
      { title: "Enter the Exchange", description: "Land in the Capabilities lens with your campaign context intact." },
    ],
    faqs: [
      { question: "Does joining create a separate founding-member app?", answer: "No. Campaigns are acquisition paths into the same RFxchange identity, onboarding, and authenticated Exchange shells." },
      { question: "Does the campaign decide my capabilities?", answer: "No. Campaign context can guide onboarding, but organization and capability truth must still be selected or verified during onboarding." },
    ],
  },
  {
    slug: "isle-of-wight-founders",
    status: "live",
    family: "geography",
    eyebrow: "Local Exchange launch",
    headline: "Build the Isle of Wight business exchange from the ground up.",
    summary: "Bring local businesses, buyers, providers, and capability data into one discoverable operating environment designed to become more useful as local participation grows.",
    audience: "Businesses and buyers",
    geography: "Isle of Wight County, VA",
    offer: "Local founding cohort",
    intendedLens: "capabilities",
    primaryCta: "Join the local Exchange",
    secondaryCta: "Explore the platform model",
    problemTitle: "Local market knowledge is often fragmented across directories, inboxes, spreadsheets, and personal networks.",
    problemCopy: "A locality campaign concentrates acquisition around one geography while still creating canonical RFxchange organizations that can participate across the wider platform as the network expands.",
    proofPoints: ["Geography carried as onboarding context", "Canonical organization identity", "Capability-first discovery", "No campaign-specific fork of the Exchange"],
    benefits: ["Make local organizations easier to discover", "Surface capability and supply concentration", "Create a base for local RFx, resource, and referral activity"],
    steps: [
      { title: "Join", description: "Create an RFxchange account from the local campaign." },
      { title: "Confirm geography", description: "Use the campaign geography as a suggestion, not an unverified fact." },
      { title: "Build capability context", description: "Describe what the organization can provide." },
      { title: "Enter locally", description: "Open the Capabilities lens with locality context available to downstream services." },
    ],
    faqs: [
      { question: "Am I locked to one county forever?", answer: "No. The campaign is an acquisition and launch context. Canonical geography and future availability remain governed by onboarding and platform rules." },
      { question: "Is this a separate local database?", answer: "No. Local campaigns feed the same RFxchange organization and Exchange model." },
    ],
  },
  {
    slug: "find-rfx-opportunities",
    status: "live",
    family: "use-case",
    eyebrow: "RFx opportunity discovery",
    headline: "Start with the opportunities your organization is equipped to pursue.",
    summary: "Use RFxchange to connect opportunity discovery to organization capability context instead of searching in isolation.",
    audience: "Businesses pursuing RFx opportunities",
    intendedLens: "rfx",
    primaryCta: "Create your RFxchange profile",
    secondaryCta: "Open the reference Exchange",
    problemTitle: "Finding an opportunity is not the same as knowing whether it fits.",
    problemCopy: "RFxchange is structured so opportunity discovery can use the same organization, geography, and capability context that powers the rest of the Exchange.",
    proofPoints: ["RFx is a lens, not a separate app", "Capability-aware context", "Shared search and records", "Direct post-onboarding RFx destination"],
    benefits: ["Discover RFx records in the common Exchange", "Preserve organization context while evaluating opportunities", "Use governed actions for watch, response, teaming, and sharing as workflows become operational"],
    steps: [
      { title: "Create an account", description: "Begin with your RFxchange identity." },
      { title: "Establish the organization", description: "Connect the user to the organization pursuing work." },
      { title: "Enrich capabilities", description: "Build the context future matching and discovery depend on." },
      { title: "Open RFx", description: "Enter the authenticated Exchange directly in the RFx lens." },
    ],
    faqs: [
      { question: "Does the landing page itself perform matching?", answer: "No. The landing page acquires and routes users. Matching belongs to authenticated RFx and capability services behind the operating chassis." },
      { question: "Can I still use the other lenses?", answer: "Yes. RFx is one of four projections of the same Exchange." },
    ],
  },
  {
    slug: "capability-discovery",
    status: "live",
    family: "capability-industry",
    eyebrow: "Capability discovery",
    headline: "Make organizational capability discoverable, comparable, and useful across the Exchange.",
    summary: "Build a capability-rich organization profile that can support discovery, matching, referrals, intelligence, and RFx workflows through the same chassis.",
    audience: "Organizations that buy, sell, partner, or refer",
    intendedLens: "capabilities",
    primaryCta: "Build your capability profile",
    secondaryCta: "See the Exchange model",
    problemTitle: "Company names and industry labels rarely explain what an organization can actually do.",
    problemCopy: "RFxchange treats capabilities as reusable organizational context rather than a one-off marketing description, creating a foundation for AMACS projection and future evidence workflows.",
    proofPoints: ["Shared organization identity", "AMACS-ready integration boundary", "Own-vs-other action model", "Capability context reusable across lenses"],
    benefits: ["Describe organizational capability once", "Use capability context in opportunity and partner discovery", "Support evidence and publishing workflows without redesigning the shell"],
    steps: [
      { title: "Join RFxchange", description: "Create the user identity that will represent an organization." },
      { title: "Claim or create", description: "Establish the canonical organization record." },
      { title: "Enrich", description: "Add capability and evidence context through onboarding and future AMACS workflows." },
      { title: "Discover", description: "Enter directly into the Capabilities lens." },
    ],
    faqs: [
      { question: "Is AMACS implemented by the campaign page?", answer: "No. The campaign introduces the value proposition. AMACS projection and evidence belong behind the Capabilities integration boundary." },
      { question: "Can a campaign assign capability claims?", answer: "No. Campaign metadata must never become canonical capability truth without explicit onboarding or verification." },
    ],
  },
  {
    slug: "resource-providers",
    status: "live",
    family: "audience",
    eyebrow: "For resource providers",
    headline: "Put services, equipment, capacity, and support where Exchange participants can find them.",
    summary: "Acquire resource providers into the same organization graph used by RFx, capability discovery, intelligence, and referrals.",
    audience: "Resource providers",
    intendedLens: "resources",
    primaryCta: "Join as a resource provider",
    secondaryCta: "See the Resources lens",
    problemTitle: "Resource availability is often disconnected from the organizations and opportunities that need it.",
    problemCopy: "RFxchange keeps resource discovery inside the common Exchange so providers remain connected to organization identity, capabilities, geography, and future cross-lens workflows.",
    proofPoints: ["Shared Resource records", "On-map and off-map results", "Common card/detail system", "Resources lens destination after onboarding"],
    benefits: ["Represent resource supply in the common Exchange", "Remain discoverable alongside organizational context", "Connect future offer, request, availability, and fulfillment workflows to one chassis"],
    steps: [
      { title: "Create the account", description: "Start with a normal RFxchange identity." },
      { title: "Establish the provider", description: "Connect to a canonical organization." },
      { title: "Add operating context", description: "Confirm geography, profile, and capabilities." },
      { title: "Open Resources", description: "Enter the Resources lens ready for downstream provider workflows." },
    ],
    faqs: [
      { question: "Is Resources a separate marketplace?", answer: "No. Resources is a lens over the same persistent Exchange." },
      { question: "Do all resources require a map marker?", answer: "No. The chassis explicitly supports valid off-map records in the result drawer." },
    ],
  },
  {
    slug: "partner-network",
    status: "live",
    family: "partner",
    eyebrow: "Partner campaign",
    headline: "Bring your network into RFxchange without creating another silo.",
    summary: "A partner campaign can carry approved partner and referral context into registration while every participant still becomes a canonical RFxchange user and organization.",
    audience: "Associations, chambers, ecosystem partners, and referral channels",
    partner: "Partner network",
    intendedLens: "capabilities",
    primaryCta: "Join through this partner",
    secondaryCta: "Learn how RFxchange works",
    problemTitle: "Partner programs lose value when every campaign creates its own list, directory, or isolated application.",
    problemCopy: "Partner landing pages should change acquisition context and presentation—not fork identity, data, permissions, or the authenticated Exchange.",
    proofPoints: ["Partner attribution preserved", "Server-validatable referral context", "Canonical identity and organization records", "Shared Exchange destination"],
    benefits: ["Run co-branded acquisition without cloning the application", "Measure partner-sourced activation through onboarding", "Keep referral and membership rights governed outside the URL"],
    steps: [
      { title: "Arrive through the partner", description: "Capture the partner and campaign source." },
      { title: "Register normally", description: "Create a canonical RFxchange identity." },
      { title: "Complete onboarding", description: "Confirm organization truth independently of campaign claims." },
      { title: "Enter the Exchange", description: "Use the same product as every other RFxchange participant." },
    ],
    faqs: [
      { question: "Can a referral code grant permissions by itself?", answer: "No. Campaign and referral metadata are attribution inputs. Membership, credits, financial rights, and authorization must be validated by server-side services." },
      { question: "Can partners have tailored copy?", answer: "Yes. The governed campaign definition supports partner-specific presentation while preserving shared public-shell contracts." },
    ],
  },
];

export function getCampaign(slug: string) {
  return campaigns.find((campaign) => campaign.slug === slug && campaign.status === "live");
}

export function buildCampaignRegistrationHref(campaign: CampaignDefinition, params: CampaignSearchParams) {
  const query = new URLSearchParams();
  query.set("campaign", campaign.slug);
  query.set("lens", campaign.intendedLens);
  query.set("source", first(params.source) ?? first(params.utm_source) ?? "campaign-landing-page");
  query.set("medium", first(params.medium) ?? first(params.utm_medium) ?? "web");
  setIfPresent(query, "partner", first(params.partner) ?? campaign.partner);
  setIfPresent(query, "geography", first(params.geography) ?? campaign.geography);
  setIfPresent(query, "offer", campaign.offer);
  for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "ref"] as const) {
    setIfPresent(query, key, first(params[key]));
  }
  return `/register?${query.toString()}`;
}

export function campaignContext(params: CampaignSearchParams) {
  const context = new URLSearchParams();
  for (const key of handoffKeys) setIfPresent(context, key, first(params[key]));
  const lens = context.get("lens");
  if (lens && !allowedLenses.has(lens as ExchangeLens)) context.delete("lens");
  return context;
}

export function appendCampaignContext(path: string, params: CampaignSearchParams) {
  const context = campaignContext(params);
  const query = context.toString();
  return query ? `${path}?${query}` : path;
}

export function exchangeDestination(params: CampaignSearchParams) {
  const lens = first(params.lens);
  return allowedLenses.has(lens as ExchangeLens) ? `/exchange/${lens}` : "/exchange/rfx";
}
