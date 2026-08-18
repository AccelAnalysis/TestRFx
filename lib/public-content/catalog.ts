export type PublicContentType = "guide" | "template" | "insight" | "case-study" | "reference" | "event";

export type PublicContentTopic =
  | "RFx"
  | "Capabilities"
  | "Resources"
  | "Intelligence"
  | "Teaming & Referrals";

export type PublicAudience = "Businesses" | "Buyers" | "Resource Providers";

export type PublicContentItem = {
  slug: string;
  title: string;
  summary: string;
  type: PublicContentType;
  topic: PublicContentTopic;
  audiences: PublicAudience[];
  readingTime: string;
  publishedOn: string;
  featured?: boolean;
  body: string[];
  takeaways?: string[];
  exchangeCta: {
    label: string;
    href: `/exchange/${"rfx" | "resources" | "intelligence" | "capabilities"}`;
  };
};

export const publicContentTypes: PublicContentType[] = [
  "guide",
  "template",
  "insight",
  "case-study",
  "reference",
  "event",
];

export const publicContentTopics: PublicContentTopic[] = [
  "RFx",
  "Capabilities",
  "Resources",
  "Intelligence",
  "Teaming & Referrals",
];

export const publicAudiences: PublicAudience[] = ["Businesses", "Buyers", "Resource Providers"];

export const publicContentCatalog: PublicContentItem[] = [
  {
    slug: "rfx-pursuit-readiness",
    title: "RFx pursuit readiness: decide before you respond",
    summary: "A practical guide for deciding whether an RFx deserves time, teaming, and response effort.",
    type: "guide",
    topic: "RFx",
    audiences: ["Businesses", "Resource Providers"],
    readingTime: "6 min",
    publishedOn: "2026-08-17",
    featured: true,
    body: [
      "A strong pursuit process begins before proposal writing. Start by checking requirement fit, geography, timing, delivery capacity, and whether the opportunity aligns with capabilities your organization can credibly support.",
      "Then identify the gaps. Some gaps should stop the pursuit; others may be resolved through a partner, supplier, facility, or specialist resource. Treat that distinction as an operating decision rather than a last-minute proposal task.",
      "RFxchange is designed to connect that preparation step to live opportunity, capability, resource, and intelligence lenses so that a pursuit decision can lead directly into discovery and action.",
    ],
    takeaways: [
      "Confirm capability and delivery fit before committing response effort.",
      "Separate disqualifying gaps from gaps that can be solved through teaming or resources.",
      "Use geography and timing as pursuit criteria, not afterthoughts.",
    ],
    exchangeCta: { label: "Explore RFx opportunities", href: "/exchange/rfx" },
  },
  {
    slug: "rfx-readiness-checklist",
    title: "RFx readiness checklist",
    summary: "A reusable checklist for opportunity fit, requirements, capacity, partners, timing, and response ownership.",
    type: "template",
    topic: "RFx",
    audiences: ["Businesses"],
    readingTime: "4 min",
    publishedOn: "2026-08-17",
    body: [
      "Use this checklist as a short pursuit gate. Confirm the buyer, due date, geography, mandatory requirements, known evaluation factors, internal owner, delivery capacity, likely partners, and open questions.",
      "The purpose is not to predict the award. It is to create a consistent decision record so that teams can explain why they pursued, passed, teamed, or requested more information.",
    ],
    takeaways: [
      "Name one accountable pursuit owner.",
      "Record mandatory requirements and unresolved questions separately.",
      "Identify partner or resource needs before response production begins.",
    ],
    exchangeCta: { label: "Open the RFx lens", href: "/exchange/rfx" },
  },
  {
    slug: "capability-profiles-buyers-can-use",
    title: "Capability profiles buyers can actually use",
    summary: "Structure capability information around what an organization can deliver, where, and with what supporting evidence.",
    type: "guide",
    topic: "Capabilities",
    audiences: ["Businesses", "Buyers"],
    readingTime: "7 min",
    publishedOn: "2026-08-17",
    body: [
      "A useful capability profile is more than a marketing paragraph. It should describe the work an organization can perform in a way that supports discovery, comparison, matching, and evidence review.",
      "RFxchange treats capability data as shared Exchange infrastructure. That allows the same organization identity to support opportunity discovery, resource relationships, intelligence, and referrals instead of repeating disconnected profile data in each product area.",
      "Start with clear capability statements, relevant geography, supporting evidence, and enough specificity for another organization to understand where the capability is strong and where a partner may still be required.",
    ],
    takeaways: [
      "Describe deliverable capability, not only industry identity.",
      "Attach geography and evidence where they materially change fit.",
      "Keep capability data reusable across the Exchange.",
    ],
    exchangeCta: { label: "Explore capabilities", href: "/exchange/capabilities" },
  },
  {
    slug: "amacs-practical-introduction",
    title: "AMACS in RFxchange: a practical introduction",
    summary: "An introduction to how standardized capability language can support discovery and matching across RFxchange.",
    type: "reference",
    topic: "Capabilities",
    audiences: ["Businesses", "Buyers", "Resource Providers"],
    readingTime: "5 min",
    publishedOn: "2026-08-17",
    body: [
      "RFxchange is designed to use AMACS as the governed capability projection behind the Capabilities lens. The public content layer explains that model without turning the public site into the operational capability-management application.",
      "Inside the authenticated Exchange, capability records can ultimately connect organization identity, taxonomy nodes, evidence, publishing state, matching, and referral workflows. Public content should teach that vocabulary and then hand the user into the appropriate Exchange experience.",
    ],
    takeaways: [
      "Public AMACS content is educational; capability management remains authenticated.",
      "Standardized capability language supports reuse across search, matching, and intelligence.",
    ],
    exchangeCta: { label: "See the Capabilities lens", href: "/exchange/capabilities" },
  },
  {
    slug: "offer-request-business-resources",
    title: "Offering and requesting business resources",
    summary: "Prepare a useful resource offer or request by defining the need, availability, geography, and organization context.",
    type: "guide",
    topic: "Resources",
    audiences: ["Businesses", "Resource Providers"],
    readingTime: "6 min",
    publishedOn: "2026-08-17",
    body: [
      "Public Resources content helps a visitor prepare. The authenticated Resources lens is where operational Exchange records belong: offers, requests, providers, availability, saved state, connection workflows, and later fulfillment behavior.",
      "Before posting or searching, define what the resource is, whether it is being offered or requested, when it is available, where it can be used, and what organization context a counterpart needs to evaluate fit.",
      "Keeping those concepts separate from articles and guides prevents the public publishing system from becoming a second resource marketplace.",
    ],
    takeaways: [
      "Describe the resource and its operating constraints clearly.",
      "Treat availability and geography as first-class fields.",
      "Use the Resources lens for transactions; use public content for preparation and education.",
    ],
    exchangeCta: { label: "Open Exchange Resources", href: "/exchange/resources" },
  },
  {
    slug: "capability-supply-demand-geography",
    title: "Reading capability supply and demand by geography",
    summary: "A primer on connecting organizations, capability concentration, opportunity demand, and geography into a market view.",
    type: "insight",
    topic: "Intelligence",
    audiences: ["Businesses", "Buyers"],
    readingTime: "8 min",
    publishedOn: "2026-08-17",
    body: [
      "RFxchange Intelligence should be built from the same Exchange graph used by the other lenses, supplemented by governed external data where appropriate. That makes geographic intelligence more useful than a disconnected chart library.",
      "A capability concentration view can help a buyer understand local supply, help a business identify potential partners, and help an ecosystem operator see where demand appears to be growing faster than visible capacity.",
      "Public briefs can explain the method and show selected findings. Dynamic maps, saved tracking, organization context, and live comparison belong in the authenticated Intelligence lens.",
    ],
    takeaways: [
      "Interpret supply and demand in geographic context.",
      "Use the same organization and capability identity across intelligence and discovery.",
      "Keep live interactive analysis in the authenticated Intelligence lens.",
    ],
    exchangeCta: { label: "Explore Intelligence", href: "/exchange/intelligence" },
  },
  {
    slug: "public-brief-to-live-intelligence",
    title: "From public market brief to live Exchange intelligence",
    summary: "How RFxchange public research can explain a market while the Intelligence lens provides the interactive operating view.",
    type: "insight",
    topic: "Intelligence",
    audiences: ["Buyers", "Businesses"],
    readingTime: "5 min",
    publishedOn: "2026-08-17",
    body: [
      "The public content layer can publish market briefs, regional explainers, procurement commentary, and selected charts. Those artifacts create useful entry points for search, campaigns, partners, and education.",
      "The authenticated Intelligence lens should remain the place where users inspect live records, geographic layers, comparisons, tracked signals, and source provenance. The public brief and the live lens should therefore be connected but not duplicated.",
    ],
    exchangeCta: { label: "Open live Intelligence", href: "/exchange/intelligence" },
  },
  {
    slug: "teaming-from-capability-gap",
    title: "A teaming path from capability gap to partner",
    summary: "A scenario showing how one uncovered requirement can become a structured partner search instead of a late-stage scramble.",
    type: "case-study",
    topic: "Teaming & Referrals",
    audiences: ["Businesses", "Resource Providers"],
    readingTime: "6 min",
    publishedOn: "2026-08-17",
    body: [
      "Consider an organization that fits most of an RFx but lacks one required capability. Instead of treating that gap as a proposal-writing problem, the team can translate it into a capability search and evaluate potential organizations before response production begins.",
      "That same interaction can later launch a governed teaming or referral workflow without making Referrals a separate Exchange lens. Referrals remain cross-lens because they can originate from RFx, capabilities, resources, organizations, or intelligence context.",
    ],
    takeaways: [
      "Turn known gaps into explicit discovery criteria.",
      "Keep referrals and teaming cross-lens rather than creating another navigation silo.",
    ],
    exchangeCta: { label: "Find capability partners", href: "/exchange/capabilities" },
  },
  {
    slug: "exchange-orientation",
    title: "RFxchange orientation: from profile to first connection",
    summary: "A public learning session covering the path from organization readiness into the four Exchange lenses.",
    type: "event",
    topic: "Resources",
    audiences: ["Businesses", "Buyers", "Resource Providers"],
    readingTime: "30 min session",
    publishedOn: "2026-08-17",
    body: [
      "This reference event format introduces the public-to-authenticated journey: create an account, establish organization and geography context, enrich capabilities, enter the Exchange, and use RFx, Resources, Intelligence, and Capabilities as lenses over one operating environment.",
      "The event content is intentionally public. Saved records, organization actions, referrals, offers, requests, responses, and other transactional workflows remain authenticated Exchange behaviors.",
    ],
    exchangeCta: { label: "Open the reference Exchange", href: "/exchange/resources" },
  },
  {
    slug: "rfxchange-glossary",
    title: "RFxchange glossary",
    summary: "Reference terms for lenses, Exchange records, capabilities, resources, intelligence, referrals, and operating-chassis behavior.",
    type: "reference",
    topic: "RFx",
    audiences: ["Businesses", "Buyers", "Resource Providers"],
    readingTime: "8 min",
    publishedOn: "2026-08-17",
    body: [
      "Lens: one governed projection of the authenticated Exchange. RFx, Resources, Intelligence, and Capabilities are lenses; Menu is not.",
      "Exchange record: the normalized shell projection used by shared map, card, selection, and detail primitives. Public content items are a separate publishing model.",
      "Referral: a cross-lens relationship workflow that can originate from multiple Exchange contexts and is managed through shared utility surfaces rather than permanent bottom navigation.",
    ],
    exchangeCta: { label: "See the Exchange chassis", href: "/exchange/rfx" },
  },
];

export function findPublicContent(slug: string) {
  return publicContentCatalog.find((item) => item.slug === slug);
}

export function relatedPublicContent(item: PublicContentItem, limit = 3) {
  return publicContentCatalog
    .filter((candidate) => candidate.slug !== item.slug)
    .sort((a, b) => {
      const aScore = Number(a.topic === item.topic) + Number(a.audiences.some((audience) => item.audiences.includes(audience)));
      const bScore = Number(b.topic === item.topic) + Number(b.audiences.some((audience) => item.audiences.includes(audience)));
      return bScore - aScore;
    })
    .slice(0, limit);
}
