import type { AuthEntryContext } from "@/lib/acquisition/auth-entry";
import { buildPublicAuthHref } from "@/lib/acquisition/auth-entry";
import type { ExchangeLens } from "@/lib/exchange/contracts";
import {
  PUBLIC_DESTINATIONS,
  type PublicDestinationId,
} from "@/lib/public/destinations";

export type CampaignFamily =
  | "membership"
  | "audience"
  | "geography"
  | "use-case"
  | "capability-industry"
  | "partner";

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
  membership?: string;
  intendedLens: ExchangeLens;
  primaryCta: string;
  secondaryCta: string;
  sourceDestinationId?: PublicDestinationId;
  problemTitle: string;
  problemCopy: string;
  proofPoints: string[];
  benefits: string[];
  steps: CampaignStep[];
  faqs: CampaignFaq[];
}

export interface CampaignFamilyDefinition {
  id: CampaignFamily;
  label: string;
  summary: string;
}

export interface CampaignWorkflowLink {
  id: "overview" | "how-it-works" | "source" | "join" | "sign-in";
  label: string;
  description: string;
  href: string;
  kind: "section" | "public" | "identity";
}

export interface CampaignNavigationNode {
  id: string;
  label: string;
  href: string;
  kind: "root" | "family" | "campaign" | "workflow";
  children?: CampaignNavigationNode[];
}

const familyDefinitions: Record<CampaignFamily, CampaignFamilyDefinition> = {
  membership: {
    id: "membership",
    label: "Membership / Conversion",
    summary: "Campaigns that explain an RFxchange membership path and hand conversion into the canonical Identity and Membership workflows.",
  },
  audience: {
    id: "audience",
    label: "Audience",
    summary: "Campaigns tailored to an audience already represented by the Public / Acquisition Shell.",
  },
  geography: {
    id: "geography",
    label: "Geographic Launch",
    summary: "Campaigns that acquire participants around a launch geography while leaving canonical geography confirmation to onboarding.",
  },
  "use-case": {
    id: "use-case",
    label: "Exchange Use Case",
    summary: "Campaigns that start from a concrete Exchange job and preserve the intended first lens through readiness.",
  },
  "capability-industry": {
    id: "capability-industry",
    label: "Capability / Industry",
    summary: "Campaigns centered on organization capability discovery and the governed Capabilities workflow.",
  },
  partner: {
    id: "partner",
    label: "Partner / Referral",
    summary: "Campaigns entered through a partner, referral, or shared campaign channel without creating a separate identity or Exchange.",
  },
};

export const campaigns: CampaignDefinition[] = [
  {
    slug: "founding-membership",
    status: "live",
    family: "membership",
    eyebrow: "Founding membership",
    headline: "Join the first organizations building the RFxchange network.",
    summary: "Establish your organization, map what you can do, and enter one shared Exchange for RFx, resources, intelligence, and capability discovery.",
    audience: "Early RFxchange organizations",
    membership: "founding",
    intendedLens: "capabilities",
    primaryCta: "Join the founding cohort",
    secondaryCta: "See Founding Membership",
    sourceDestinationId: "founding",
    problemTitle: "A network is only useful when participants can be found and understood.",
    problemCopy: "Founding organizations help establish the organization and capability density that makes local discovery, matching, referrals, and opportunity routing useful from the beginning.",
    proofPoints: ["One organization identity", "One capability profile", "Four Exchange lenses", "Campaign context preserved through Identity and Onboarding"],
    benefits: ["Establish an Exchange-ready organization profile", "Represent capabilities through a governed structure", "Discover RFx, resources, intelligence, and organizations from the same operating environment"],
    steps: [
      { title: "Create your account", description: "Start through the canonical Join Free entry." },
      { title: "Establish your organization", description: "Select or create the organization you represent." },
      { title: "Add geography and capabilities", description: "Build the context the Exchange uses for discovery." },
      { title: "Enter the Exchange", description: "Continue to the Capabilities lens after Exchange-ready completion." },
    ],
    faqs: [
      { question: "Does joining create a separate founding-member app?", answer: "No. The campaign hands into the same RFxchange identity, onboarding, Membership, and authenticated Exchange services." },
      { question: "Does the campaign decide my capabilities?", answer: "No. Campaign context can guide onboarding, but organization and capability truth must still be selected or verified in the owning workflows." },
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
    intendedLens: "capabilities",
    primaryCta: "Join the local Exchange",
    secondaryCta: "See how RFxchange works",
    sourceDestinationId: "howItWorks",
    problemTitle: "Local market knowledge is often fragmented across directories, inboxes, spreadsheets, and personal networks.",
    problemCopy: "A locality campaign concentrates acquisition around one geography while still creating canonical RFxchange organizations that can participate across the wider platform as the network expands.",
    proofPoints: ["Geography carried as onboarding context", "Canonical organization identity", "Capability-first discovery", "No campaign-specific fork of the Exchange"],
    benefits: ["Make local organizations easier to discover", "Surface capability and supply concentration", "Create a base for local RFx, resource, and referral activity"],
    steps: [
      { title: "Join", description: "Create an RFxchange account from the local campaign." },
      { title: "Confirm geography", description: "Use the campaign geography as context; Geography onboarding remains authoritative." },
      { title: "Build capability context", description: "Describe what the organization can provide." },
      { title: "Enter locally", description: "Continue to the Capabilities lens after Exchange-ready completion." },
    ],
    faqs: [
      { question: "Am I locked to one county forever?", answer: "No. The campaign is an acquisition and launch context. Canonical geography and availability remain governed by onboarding and platform rules." },
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
    secondaryCta: "See how RFxchange works",
    sourceDestinationId: "howItWorks",
    problemTitle: "Finding an opportunity is not the same as knowing whether it fits.",
    problemCopy: "RFxchange is structured so opportunity discovery can use the same organization, geography, and capability context that powers the rest of the Exchange.",
    proofPoints: ["RFx is a lens, not a separate app", "Capability-aware context", "Shared search and records", "Post-onboarding RFx destination"],
    benefits: ["Discover RFx records in the common Exchange", "Preserve organization context while evaluating opportunities", "Use governed RFx actions inside the same operating chassis"],
    steps: [
      { title: "Create an account", description: "Begin through the canonical RFxchange identity entry." },
      { title: "Establish the organization", description: "Connect the user to the organization pursuing work." },
      { title: "Enrich capabilities", description: "Build the context matching and discovery depend on." },
      { title: "Open RFx", description: "Continue into the authenticated RFx lens after readiness checks." },
    ],
    faqs: [
      { question: "Does the landing page itself perform matching?", answer: "No. The landing page acquires and routes users. Matching belongs to authenticated RFx and Capability services behind the operating chassis." },
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
    secondaryCta: "For businesses",
    sourceDestinationId: "businesses",
    problemTitle: "Company names and industry labels rarely explain what an organization can actually do.",
    problemCopy: "RFxchange treats capabilities as reusable organizational context rather than a one-off marketing description, creating a foundation for AMACS projection and evidence workflows.",
    proofPoints: ["Shared organization identity", "AMACS integration boundary", "Own-vs-other action model", "Capability context reusable across lenses"],
    benefits: ["Describe organizational capability once", "Use capability context in opportunity and partner discovery", "Connect evidence and publishing workflows without redesigning the shell"],
    steps: [
      { title: "Join RFxchange", description: "Create the user identity that will represent an organization." },
      { title: "Claim or create", description: "Establish the canonical organization record." },
      { title: "Enrich", description: "Add capability and evidence context through the owning onboarding workflows." },
      { title: "Discover", description: "Continue into the Capabilities lens after Exchange-ready completion." },
    ],
    faqs: [
      { question: "Is AMACS implemented by the campaign page?", answer: "No. The campaign introduces the value proposition. AMACS projection and evidence belong behind the Capabilities boundary." },
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
    secondaryCta: "For resource providers",
    sourceDestinationId: "resourceProviders",
    problemTitle: "Resource availability is often disconnected from the organizations and opportunities that need it.",
    problemCopy: "RFxchange keeps resource discovery inside the common Exchange so providers remain connected to organization identity, capabilities, geography, and cross-lens workflows.",
    proofPoints: ["Shared Resource records", "On-map and off-map results", "Common card/detail system", "Resources lens destination after onboarding"],
    benefits: ["Represent resource supply in the common Exchange", "Remain discoverable alongside organizational context", "Connect offer, request, availability, and fulfillment workflows to one chassis"],
    steps: [
      { title: "Create the account", description: "Start with the canonical RFxchange identity flow." },
      { title: "Establish the provider", description: "Connect to a canonical organization." },
      { title: "Add operating context", description: "Confirm geography, profile, and capabilities." },
      { title: "Open Resources", description: "Continue to the Resources lens after Exchange-ready completion." },
    ],
    faqs: [
      { question: "Is Resources a separate marketplace?", answer: "No. Resources is a lens over the same persistent Exchange." },
      { question: "Do all resources require a map marker?", answer: "No. The chassis supports valid off-map records in the authoritative result drawer." },
    ],
  },
  {
    slug: "partner-network",
    status: "live",
    family: "partner",
    eyebrow: "Partner / referral campaign",
    headline: "Bring a partner network into RFxchange without creating another silo.",
    summary: "Partner and referral campaigns can carry acquisition context into Identity while every participant still becomes a canonical RFxchange user and organization.",
    audience: "Associations, chambers, ecosystem partners, and referral channels",
    intendedLens: "capabilities",
    primaryCta: "Join through this campaign",
    secondaryCta: "See how RFxchange works",
    sourceDestinationId: "howItWorks",
    problemTitle: "Partner programs lose value when every campaign creates its own list, directory, or isolated application.",
    problemCopy: "Partner landing pages should change acquisition context and presentation—not fork identity, data, permissions, or the authenticated Exchange.",
    proofPoints: ["Partner/referral attribution retained by the acquisition path", "Canonical identity and organization records", "Shared Exchange destination", "No URL-derived permissions"],
    benefits: ["Run partner acquisition without cloning the application", "Measure partner-sourced activation", "Keep referral and membership rights governed outside campaign URLs"],
    steps: [
      { title: "Arrive through the partner or referral", description: "Preserve the campaign and available referral context." },
      { title: "Register normally", description: "Create a canonical RFxchange identity." },
      { title: "Complete onboarding", description: "Confirm organization truth independently of campaign claims." },
      { title: "Enter the Exchange", description: "Use the same authenticated product as every other RFxchange participant." },
    ],
    faqs: [
      { question: "Can a referral code grant permissions by itself?", answer: "No. Campaign and referral metadata are attribution inputs. Membership, credits, financial rights, and authorization must be validated by their owning services." },
      { question: "Can partner traffic retain its source?", answer: "Yes. The public acquisition context carries campaign, partner, referral, and UTM context into the canonical Identity entry boundary." },
    ],
  },
];

export const campaignFamilyOrder: CampaignFamily[] = [
  "membership",
  "audience",
  "geography",
  "use-case",
  "capability-industry",
  "partner",
];

export function getCampaign(slug: string) {
  return campaigns.find((campaign) => campaign.slug === slug && campaign.status === "live");
}

export function getCampaignFamily(family: string) {
  if (!campaignFamilyOrder.includes(family as CampaignFamily)) return undefined;
  const id = family as CampaignFamily;
  return campaigns.some((campaign) => campaign.family === id && campaign.status === "live")
    ? familyDefinitions[id]
    : undefined;
}

export function campaignsForFamily(family: CampaignFamily) {
  return campaigns.filter((campaign) => campaign.family === family && campaign.status === "live");
}

export function liveCampaignFamilies() {
  return campaignFamilyOrder
    .filter((family) => campaignsForFamily(family).length > 0)
    .map((family) => familyDefinitions[family]);
}

export function campaignFamilyPath(family: CampaignFamily) {
  return `/campaign/families/${family}`;
}

export function campaignCanonicalPath(campaign: CampaignDefinition) {
  return `${campaignFamilyPath(campaign.family)}/${campaign.slug}`;
}

export function campaignAuthContext(campaign: CampaignDefinition): AuthEntryContext {
  return {
    returnTo: `/exchange/${campaign.intendedLens}`,
    source: "campaign",
    campaign: campaign.slug,
    membership: campaign.membership,
    geography: campaign.geography,
  };
}

export function campaignJoinHref(campaign: CampaignDefinition) {
  return buildPublicAuthHref("register", campaignAuthContext(campaign));
}

export function campaignSignInHref(campaign: CampaignDefinition) {
  return buildPublicAuthHref("signin", campaignAuthContext(campaign));
}

export function campaignWorkflowLinks(campaign: CampaignDefinition): CampaignWorkflowLink[] {
  const path = campaignCanonicalPath(campaign);
  const links: CampaignWorkflowLink[] = [
    {
      id: "overview",
      label: "Campaign overview",
      description: "Return to the campaign promise and conversion context.",
      href: `${path}#overview`,
      kind: "section",
    },
    {
      id: "how-it-works",
      label: "How It Works",
      description: "Follow the campaign-specific path through Identity, Onboarding, and the Exchange.",
      href: `${path}#how-it-works`,
      kind: "section",
    },
  ];

  if (campaign.sourceDestinationId) {
    const destination = PUBLIC_DESTINATIONS[campaign.sourceDestinationId];
    links.push({
      id: "source",
      label: destination.label,
      description: destination.summary,
      href: destination.href,
      kind: "public",
    });
  }

  links.push(
    {
      id: "join",
      label: campaign.primaryCta,
      description: `Join through the canonical Identity entry and continue to ${campaign.intendedLens} after readiness.`,
      href: campaignJoinHref(campaign),
      kind: "identity",
    },
    {
      id: "sign-in",
      label: "Sign In",
      description: `Sign in with the same protected return destination: /exchange/${campaign.intendedLens}.`,
      href: campaignSignInHref(campaign),
      kind: "identity",
    },
  );

  return links;
}

export function buildCampaignNavigationTree(): CampaignNavigationNode {
  return {
    id: "campaigns",
    label: "Campaign Landing Pages",
    href: "/campaign",
    kind: "root",
    children: liveCampaignFamilies().map((family) => ({
      id: family.id,
      label: family.label,
      href: campaignFamilyPath(family.id),
      kind: "family",
      children: campaignsForFamily(family.id).map((campaign) => ({
        id: campaign.slug,
        label: campaign.eyebrow,
        href: campaignCanonicalPath(campaign),
        kind: "campaign",
        children: campaignWorkflowLinks(campaign).map((workflow) => ({
          id: `${campaign.slug}:${workflow.id}`,
          label: workflow.label,
          href: workflow.href,
          kind: "workflow",
        })),
      })),
    })),
  };
}
