export const marketingNavigation = [
  { label: "How It Works", href: "/how-it-works" },
  { label: "Businesses", href: "/businesses" },
  { label: "Buyers", href: "/buyers" },
  { label: "Resource Providers", href: "/resource-providers" },
  { label: "Founding", href: "/founding" },
  { label: "About", href: "/about" },
] as const;

export const marketingFooterGroups = [
  {
    label: "Explore",
    links: [
      { label: "How It Works", href: "/how-it-works" },
      { label: "Businesses", href: "/businesses" },
      { label: "Buyers", href: "/buyers" },
      { label: "Resource Providers", href: "/resource-providers" },
      { label: "Founding Membership", href: "/founding" },
    ],
  },
  {
    label: "Organization",
    links: [
      { label: "About", href: "/about" },
      { label: "Join Free", href: "/join", conversion: true },
      { label: "Sign In", href: "/signin", conversion: true },
      { label: "Image Credits", href: "/image-credits" },
    ],
  },
  {
    label: "Bottom Matter",
    links: [
      { label: "Terms", href: "/terms" },
      { label: "Privacy", href: "/privacy" },
      { label: "Platform Rules", href: "/platform-rules" },
      { label: "Accessibility", href: "/accessibility" },
    ],
  },
] as const;

export interface MarketingPageDefinition {
  eyebrow: string;
  title: string;
  lead: string;
  sections: ReadonlyArray<{
    title: string;
    body: string;
    points?: ReadonlyArray<string>;
  }>;
  cta?: {
    title: string;
    body: string;
    primaryLabel: string;
    primaryHref: string;
  };
}

export const publicPageDefinitions = {
  howItWorks: {
    eyebrow: "How RFxchange works",
    title: "One Exchange. Four lenses. One organization identity.",
    lead: "RFxchange establishes an organization once, then lets participants discover and act through RFx, Resources, Intelligence, and Capabilities without leaving the shared Exchange environment.",
    sections: [
      {
        title: "1. Establish your organization",
        body: "Create an account, select or create the organization you represent, establish geography, and complete the organization profile needed to enter the Exchange.",
        points: ["Account and organization context", "Geography and operating area", "Organization profile and capability enrichment"],
      },
      {
        title: "2. Describe capability in a common language",
        body: "Capability enrichment connects the organization profile to AMACS so businesses can be discovered by what they can do, not only by a broad industry label.",
        points: ["Structured capability data", "AMACS-aligned categories", "Evidence-ready capability records"],
      },
      {
        title: "3. Change lenses, not applications",
        body: "The authenticated Exchange keeps the same map, search, results drawer, cards, and detail behavior while the active lens changes what the participant is looking for.",
        points: ["RFx opportunities", "Resources and providers", "Market intelligence", "Organization capabilities"],
      },
      {
        title: "4. Act from context",
        body: "Governed action positions surface the next appropriate step for the selected record. Workflows become available progressively without changing the operating chassis.",
        points: ["Watch, share, save, and follow", "Respond and team where available", "Refer across lenses", "Return to the exact prior Exchange state"],
      },
    ],
    cta: {
      title: "Build your place in the Exchange",
      body: "Start free, establish your organization, and enter the Exchange when the onboarding requirements are complete.",
      primaryLabel: "Join Free",
      primaryHref: "/join",
    },
  },
  businesses: {
    eyebrow: "For businesses",
    title: "Make capability discoverable and find demand in context.",
    lead: "RFxchange is designed to help organizations establish what they can do, discover relevant demand, identify potential partners, and find business resources in one connected environment.",
    sections: [
      {
        title: "Be found for what you can do",
        body: "A shared organization identity and capability profile gives the Exchange a structured basis for discovery across opportunities, resources, and relationships.",
        points: ["Organization profile", "Capability enrichment", "Geographic context", "AMACS-aligned discovery"],
      },
      {
        title: "Discover opportunity",
        body: "Use the RFx lens to find relevant opportunity records while preserving the same map-first search and result experience used across the rest of RFxchange.",
        points: ["RFx search", "Watch and share", "Capability context", "Progressively available response and teaming workflows"],
      },
      {
        title: "Find support around the work",
        body: "Resources and cross-lens referrals connect business needs to providers and other organizations without forcing participants into a separate directory application.",
      },
    ],
    cta: {
      title: "Establish your organization",
      body: "Free participation is the entry point. Founding Membership is an optional organization-level enhancement, not a requirement to be ranked or verified.",
      primaryLabel: "Join Free",
      primaryHref: "/join",
    },
  },
  buyers: {
    eyebrow: "For buyers and issuers",
    title: "Find capable organizations and express demand clearly.",
    lead: "RFxchange gives buyers a shared environment for discovering organizations, understanding capability and geography, and connecting structured demand to the businesses that may be relevant.",
    sections: [
      {
        title: "Discover capability before outreach",
        body: "Capabilities and organization records give buyers a structured discovery surface rather than relying only on business names or broad industry categories.",
        points: ["Capability-led discovery", "Organization geography", "Shared detail surfaces", "Common Exchange search"],
      },
      {
        title: "Publish and manage RFx context",
        body: "RFx records occupy the same Exchange as capabilities and resources so an opportunity can be understood alongside the organizations and support ecosystem around it.",
      },
      {
        title: "Keep decision authority human",
        body: "RFxchange can organize, surface, and compare relevant information. Buyers remain responsible for qualification, procurement, selection, and award decisions.",
      },
    ],
    cta: {
      title: "Enter the Exchange as an organization",
      body: "Create an account and establish the organization you represent before using authenticated Exchange workflows.",
      primaryLabel: "Join Free",
      primaryHref: "/join",
    },
  },
  resourceProviders: {
    eyebrow: "For resource providers",
    title: "Connect business needs to useful services, assets, and support.",
    lead: "The Resources lens gives providers a place inside the same Exchange used for RFx, Intelligence, and Capabilities, keeping business support connected to the context that created the need.",
    sections: [
      {
        title: "Show what you provide",
        body: "Resource records can represent offers, provider services, assets, and availability while remaining tied to one organization identity.",
        points: ["Provider organization", "Resource category", "Availability context", "Geographic or service-area context"],
      },
      {
        title: "Meet needs in context",
        body: "Resource discovery can sit beside opportunity and capability discovery instead of sending participants to an unrelated provider directory.",
      },
      {
        title: "Grow into fulfillment workflows",
        body: "The chassis reserves governed action positions for connection and fulfillment workflows as those services become operational.",
      },
    ],
    cta: {
      title: "Create your provider presence",
      body: "Start with an organization profile, then enrich the records that make your services discoverable inside the Exchange.",
      primaryLabel: "Join Free",
      primaryHref: "/join",
    },
  },
  founding: {
    eyebrow: "Founding Membership",
    title: "$49 per month for the first 250 Founding Organizations.",
    lead: "Founding Membership is an organization-level enhancement for early participants. It sits on top of free Exchange participation rather than acting as a paywall for basic discovery or credibility.",
    sections: [
      {
        title: "Founder position",
        body: "The program is designed for the first 250 organizations that choose to support and shape the Exchange during its founding period.",
        points: ["Organization-level membership", "$49 monthly founding price", "250-organization founding capacity"],
      },
      {
        title: "Free participation remains meaningful",
        body: "Organizations can establish a presence and participate in substantive Exchange discovery without buying Founding Membership.",
      },
      {
        title: "No pay-to-rank or pay-to-verify",
        body: "Commercial status should not determine capability truth, verification, or search credibility. Membership benefits and platform trust remain separate concerns.",
      },
    ],
    cta: {
      title: "Start with your organization",
      body: "Create the organization account first. Membership can be attached at the organization level as that commercial workflow becomes operational.",
      primaryLabel: "Join Free",
      primaryHref: "/join",
    },
  },
  about: {
    eyebrow: "About RFxchange",
    title: "A business-to-business Exchange built around shared context.",
    lead: "RFxchange is being structured as one platform where organizations, demand, resources, intelligence, and capabilities can be discovered through a common operating chassis.",
    sections: [
      {
        title: "The platform model",
        body: "Public acquisition brings organizations into Identity and Onboarding. Once ready, participants enter one persistent authenticated Exchange rather than a collection of disconnected product applications.",
      },
      {
        title: "The Exchange model",
        body: "RFx, Resources, Intelligence, and Capabilities are lenses over the same environment. Menu holds utilities and cross-lens workflows such as Referrals.",
      },
      {
        title: "The operating principle",
        body: "The map, search, results drawer, cards, detail behavior, organization identity, and governed actions should remain stable as more domain workflows become operational.",
      },
    ],
    cta: {
      title: "See the Exchange from the inside",
      body: "Create an account to move from the public acquisition shell into organization onboarding.",
      primaryLabel: "Join Free",
      primaryHref: "/join",
    },
  },
  imageCredits: {
    eyebrow: "Image credits",
    title: "Visual-source transparency for the public marketing surface.",
    lead: "This TestRFx marketing implementation uses CSS-generated visual surfaces and interface geometry rather than third-party marketing photography or illustration.",
    sections: [
      {
        title: "Current reference implementation",
        body: "The public page uses RFxchange design tokens, layout, typography, gradients, borders, and generated network/map motifs. No third-party image asset is asserted as part of this implementation.",
      },
      {
        title: "Production boundary",
        body: "If licensed photography, illustration, partner marks, or other credited media are introduced later, their source and license information belongs on this route.",
      },
    ],
  },
  terms: {
    eyebrow: "Terms",
    title: "Terms route established for the Public / Acquisition Shell.",
    lead: "The marketing architecture requires a public Terms destination. This TestRFx route proves the navigation and shell boundary; it does not invent production legal terms that have not been supplied.",
    sections: [
      {
        title: "Reference implementation status",
        body: "Production terms of service, commercial terms, dispute provisions, and jurisdiction-specific language remain a legal-content integration boundary.",
      },
      {
        title: "What this prototype establishes",
        body: "The Terms route is reachable from the shared Marketing Footer and remains outside the authenticated Exchange shell.",
      },
    ],
  },
  privacy: {
    eyebrow: "Privacy",
    title: "Privacy route established for the Public / Acquisition Shell.",
    lead: "The source architecture requires a public Privacy destination. This reference implementation establishes that destination without asserting a production privacy policy that has not been supplied.",
    sections: [
      {
        title: "Acquisition context in this prototype",
        body: "The marketing surface retains campaign and referral context in browser session storage so it can survive the public journey and be carried into Join or Sign In links. It does not send that context to an analytics service in this prototype.",
      },
      {
        title: "Production boundary",
        body: "A production privacy notice should describe actual data collection, processors, retention, rights, cookies, analytics, and jurisdiction-specific requirements once those services are connected.",
      },
    ],
  },
  platformRules: {
    eyebrow: "Platform rules",
    title: "Trust rules belong in the public acquisition story.",
    lead: "RFxchange needs public rules that distinguish commercial participation from capability truth, credibility, and decision authority.",
    sections: [
      {
        title: "Neutral discovery",
        body: "Founding or paid status should not silently become a substitute for relevance, capability evidence, verification, or ranking credibility.",
      },
      {
        title: "Human authority",
        body: "RFxchange can assist with discovery, organization, matching context, and workflow. Participants remain responsible for their own business, procurement, qualification, and award decisions.",
      },
      {
        title: "Production rulebook boundary",
        body: "Enforcement procedures, prohibited conduct, moderation, appeals, and formal platform terms require a governed production rulebook beyond this chassis reference implementation.",
      },
    ],
  },
  accessibility: {
    eyebrow: "Accessibility",
    title: "The public shell should remain usable across input methods and screen sizes.",
    lead: "Accessibility is part of the RFxchange operating chassis rather than a lens-specific feature.",
    sections: [
      {
        title: "Implemented reference behaviors",
        body: "The marketing surface uses semantic landmarks, labeled navigation, visible focus behavior, reduced-motion support, responsive layouts, and native link and details controls.",
      },
      {
        title: "Production boundary",
        body: "Formal accessibility conformance testing, assistive-technology acceptance, documented support targets, and an accessibility feedback process remain production acceptance work.",
      },
    ],
  },
} satisfies Record<string, MarketingPageDefinition>;
