export type PublicContentType = "guide" | "template" | "insight" | "example" | "case-study" | "reference" | "event";

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
  collections: string[];
  readingTime: string;
  publishedOn: string;
  publicationStatus: "published";
  featured?: boolean;
  body: string[];
  takeaways?: string[];
  exchangeCta: {
    label: string;
    href: `/exchange/${"rfx" | "resources" | "intelligence" | "capabilities"}`;
  };
};

export const publicContentCatalog: PublicContentItem[] = [
  {
    slug: "rfx-pursuit-readiness",
    title: "RFx pursuit readiness: decide before you respond",
    summary: "A practical guide for deciding whether an RFx deserves time, teaming, and response effort.",
    type: "guide",
    topic: "RFx",
    audiences: ["Businesses", "Resource Providers"],
    collections: ["learn-rfx-procurement", "learn-finding-opportunities", "learn-responding-to-rfx", "insights-procurement-insights"],
    readingTime: "6 min",
    publishedOn: "2026-08-17",
    publicationStatus: "published",
    featured: true,
    body: [
      "A strong pursuit process begins before proposal writing. Start by checking requirement fit, geography, timing, delivery capacity, and whether the opportunity aligns with capabilities your organization can credibly support.",
      "Then identify the gaps. Some gaps should stop the pursuit; others may be resolved through a partner, supplier, facility, or specialist resource. Treat that distinction as an operating decision rather than a last-minute proposal task.",
      "RFxchange connects that preparation step to opportunity, capability, resource, and intelligence lenses so that a pursuit decision can lead into governed authenticated discovery and action.",
    ],
    takeaways: [
      "Confirm capability and delivery fit before committing response effort.",
      "Separate disqualifying gaps from gaps that may be solved through teaming or resources.",
      "Use geography and timing as pursuit criteria, not afterthoughts.",
    ],
    exchangeCta: { label: "Continue to RFx opportunities", href: "/exchange/rfx" },
  },
  {
    slug: "rfx-readiness-checklist",
    title: "RFx readiness checklist",
    summary: "A reusable checklist for opportunity fit, requirements, capacity, partners, timing, and response ownership.",
    type: "template",
    topic: "RFx",
    audiences: ["Businesses"],
    collections: ["templates-rfx-readiness", "templates-downloads"],
    readingTime: "4 min",
    publishedOn: "2026-08-17",
    publicationStatus: "published",
    body: [
      "Use this checklist as a short pursuit gate. Confirm the buyer, due date, geography, mandatory requirements, known evaluation factors, internal owner, delivery capacity, likely partners, and open questions.",
      "The purpose is not to predict the award. It is to create a consistent decision record so that teams can explain why they pursued, passed, teamed, or requested more information.",
    ],
    takeaways: [
      "Name one accountable pursuit owner.",
      "Record mandatory requirements and unresolved questions separately.",
      "Identify partner or resource needs before response production begins.",
    ],
    exchangeCta: { label: "Continue to the RFx lens", href: "/exchange/rfx" },
  },
  {
    slug: "capability-profiles-buyers-can-use",
    title: "Capability profiles buyers can actually use",
    summary: "Structure capability information around what an organization can deliver, where, and with what supporting evidence.",
    type: "guide",
    topic: "Capabilities",
    audiences: ["Businesses", "Buyers"],
    collections: ["learn-capabilities", "templates-capability-statement", "templates-capability-discovery", "reference-capability-terminology"],
    readingTime: "7 min",
    publishedOn: "2026-08-17",
    publicationStatus: "published",
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
    exchangeCta: { label: "Continue to Capabilities", href: "/exchange/capabilities" },
  },
  {
    slug: "amacs-practical-introduction",
    title: "AMACS in RFxchange: a practical introduction",
    summary: "An introduction to how governed capability language can support discovery and matching across RFxchange.",
    type: "reference",
    topic: "Capabilities",
    audiences: ["Businesses", "Buyers", "Resource Providers"],
    collections: ["learn-capabilities", "learn-capabilities-amacs", "reference-amacs-overview", "reference-capability-terminology"],
    readingTime: "5 min",
    publishedOn: "2026-08-17",
    publicationStatus: "published",
    body: [
      "RFxchange uses AMACS as the governed capability projection behind the Capabilities lens. The public content layer explains that model without turning the public site into the operational capability-management application.",
      "Inside the authenticated Exchange, capability records can connect organization identity, taxonomy nodes, evidence, publishing state, matching, and referral workflows. Public content teaches that vocabulary and then hands the user into the appropriate Exchange experience.",
    ],
    takeaways: [
      "Public AMACS content is educational; capability management remains authenticated.",
      "Standardized capability language supports reuse across search, matching, and intelligence.",
    ],
    exchangeCta: { label: "Continue to Capabilities", href: "/exchange/capabilities" },
  },
  {
    slug: "offer-request-business-resources",
    title: "Offering and requesting business resources",
    summary: "Prepare a useful resource offer or request by defining the need, availability, geography, and organization context.",
    type: "guide",
    topic: "Resources",
    audiences: ["Businesses", "Resource Providers"],
    collections: ["learn-resource-exchange", "templates-resource-offer-request", "reference-resource-categories"],
    readingTime: "6 min",
    publishedOn: "2026-08-17",
    publicationStatus: "published",
    body: [
      "Public Resources content helps a visitor prepare. The authenticated Resources lens is where operational Exchange records belong: offers, requests, providers, availability, saved/follow state, resource detail, sharing, and referral handoffs.",
      "Before posting or searching, define what the resource is, whether it is being offered or requested, when it is available, where it can be used, and what organization context a counterpart needs to evaluate fit.",
      "Keeping those concepts separate from articles and guides prevents the public publishing system from becoming a second resource marketplace.",
    ],
    takeaways: [
      "Describe the resource and its operating constraints clearly.",
      "Treat availability and geography as first-class fields.",
      "Use the Resources lens for authenticated actions; use public content for preparation and education.",
    ],
    exchangeCta: { label: "Continue to Exchange Resources", href: "/exchange/resources" },
  },
  {
    slug: "capability-supply-demand-geography",
    title: "Reading capability supply and demand by geography",
    summary: "A primer on connecting organizations, capability concentration, opportunity demand, and geography into a market view.",
    type: "insight",
    topic: "Intelligence",
    audiences: ["Businesses", "Buyers"],
    collections: ["learn-market-intelligence", "insights-regional-briefs", "insights-capability-supply-demand", "insights-selected-public-intelligence"],
    readingTime: "8 min",
    publishedOn: "2026-08-17",
    publicationStatus: "published",
    body: [
      "RFxchange Intelligence is intended to use the same Exchange graph used by the other lenses, supplemented by governed external data where appropriate. That makes geographic intelligence more useful than a disconnected chart library.",
      "A capability concentration view can help a buyer understand visible local supply, help a business identify potential partners, and help an ecosystem operator see where demand appears to be growing faster than visible capacity.",
      "Public briefs can explain method and selected findings. Dynamic maps, saved tracking, organization context, and interactive comparison belong in the authenticated Intelligence lens.",
    ],
    takeaways: [
      "Interpret supply and demand in geographic context.",
      "Use the same organization and capability identity across intelligence and discovery.",
      "Keep live interactive analysis in the authenticated Intelligence lens.",
    ],
    exchangeCta: { label: "Continue to Intelligence", href: "/exchange/intelligence" },
  },
  {
    slug: "public-brief-to-live-intelligence",
    title: "From public market brief to live Exchange intelligence",
    summary: "How RFxchange public research can explain a market while the Intelligence lens provides the interactive operating view.",
    type: "insight",
    topic: "Intelligence",
    audiences: ["Buyers", "Businesses"],
    collections: ["learn-market-intelligence", "insights-market-briefs", "insights-selected-public-intelligence"],
    readingTime: "5 min",
    publishedOn: "2026-08-17",
    publicationStatus: "published",
    body: [
      "The public content layer can publish market briefs, regional explainers, procurement commentary, and selected charts when RFxchange has governed material to release. Those artifacts create useful entry points for search, campaigns, partners, and education.",
      "The authenticated Intelligence lens remains the place where users inspect interactive records, geographic layers, comparisons, tracked signals, and source provenance. The public brief and the live lens are connected but not duplicated.",
    ],
    exchangeCta: { label: "Continue to Intelligence", href: "/exchange/intelligence" },
  },
  {
    slug: "teaming-from-capability-gap",
    title: "Example: from capability gap to teaming search",
    summary: "An illustrative path showing how one uncovered requirement can become a structured partner search instead of a late-stage scramble.",
    type: "example",
    topic: "Teaming & Referrals",
    audiences: ["Businesses", "Resource Providers"],
    collections: ["learn-teaming-collaboration", "learn-referrals", "templates-teaming-partner", "templates-referral-preparation", "stories-teaming-examples", "stories-referral-connection-examples"],
    readingTime: "6 min",
    publishedOn: "2026-08-17",
    publicationStatus: "published",
    body: [
      "This is an illustrative example, not a claimed customer outcome. Consider an organization that fits most of an RFx but lacks one required capability. Instead of treating that gap as a proposal-writing problem, the team can translate it into a capability search and evaluate potential organizations before response production begins.",
      "That same interaction can hand off to a governed teaming or referral workflow without making Referrals a separate Exchange lens. Referrals remain cross-lens because they can originate from RFx, capabilities, resources, organizations, or intelligence context.",
    ],
    takeaways: [
      "Turn known gaps into explicit discovery criteria.",
      "Keep referrals and teaming cross-lens rather than creating another navigation silo.",
    ],
    exchangeCta: { label: "Continue to Capabilities", href: "/exchange/capabilities" },
  },
  {
    slug: "rfxchange-glossary",
    title: "RFxchange glossary",
    summary: "Reference terms for lenses, Exchange records, capabilities, resources, intelligence, referrals, and operating-chassis behavior.",
    type: "reference",
    topic: "RFx",
    audiences: ["Businesses", "Buyers", "Resource Providers"],
    collections: ["learn-rfxchange-how-to", "reference-rfxchange-glossary", "reference-rfx-terminology", "reference-faq-help"],
    readingTime: "8 min",
    publishedOn: "2026-08-17",
    publicationStatus: "published",
    body: [
      "Lens: one governed projection of the authenticated Exchange. RFx, Resources, Intelligence, and Capabilities are lenses; Menu is not.",
      "Exchange record: the normalized shell projection used by shared map, card, selection, and detail primitives. Public content items are a separate publishing model.",
      "Referral: a cross-lens relationship workflow that can originate from multiple Exchange contexts and is managed through shared utility surfaces rather than permanent bottom navigation.",
    ],
    exchangeCta: { label: "Continue to the RFx lens", href: "/exchange/rfx" },
  },
];
