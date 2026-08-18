import {
  PUBLIC_DESTINATIONS,
  PUBLIC_HEADER_DESTINATIONS,
} from "@/lib/public/destinations";

export const marketingNavigation = PUBLIC_HEADER_DESTINATIONS.map((destinationId) => {
  const destination = PUBLIC_DESTINATIONS[destinationId];
  return {
    label: "headerLabel" in destination ? destination.headerLabel : destination.label,
    href: destination.href,
  };
});

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
} satisfies Record<string, MarketingPageDefinition>;
