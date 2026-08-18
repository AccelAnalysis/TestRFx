import type { PublicDestinationId } from "./destinations";

export type PublicPageSection = {
  heading: string;
  paragraphs?: readonly string[];
  bullets?: readonly string[];
};

export type PublicInfoPageDefinition = {
  slug: string;
  destinationId: PublicDestinationId;
  eyebrow: string;
  title: string;
  intro: string;
  statusNote?: string;
  sections: readonly PublicPageSection[];
  relatedDestinationIds: readonly PublicDestinationId[];
};

export const PUBLIC_INFO_PAGES = {
  about: {
    slug: "about",
    destinationId: "about",
    eyebrow: "About RFxchange",
    title: "One Exchange. Shared operating context.",
    intro:
      "RFxchange is structured as one platform with a public acquisition shell, an identity and onboarding shell, and one persistent authenticated Exchange environment.",
    sections: [
      {
        heading: "One platform, three shells",
        paragraphs: [
          "The Public / Acquisition shell explains the platform and routes people into membership, registration, login, and public information. Identity & Onboarding establishes the user, organization, geography, profile, and capability context required to enter the Exchange. The Authenticated Exchange is the ongoing map-first operating environment.",
        ],
      },
      {
        heading: "Four lenses over the same Exchange",
        paragraphs: [
          "RFx, Resources, Intelligence, and Capabilities are different projections of the same Exchange rather than separate applications. The map, search, result drawer, cards, detail behavior, identity, and organization context remain shared while each lens supplies its own records, map treatment, and governed actions.",
        ],
        bullets: [
          "RFx — opportunity and solicitation discovery and action.",
          "Resources — offered and requested resources, providers, and availability.",
          "Intelligence — market signals, geographic patterns, and comparative insight.",
          "Capabilities — organization discovery through governed capability data and AMACS projection.",
        ],
      },
      {
        heading: "Organization and capability context",
        paragraphs: [
          "The Exchange is organization-centered. Registration and onboarding establish who a participant represents, where that organization operates, and the capability profile used throughout discovery, matching, and future workflows. AMACS is the capability-standard integration point for governed capability enrichment.",
        ],
      },
      {
        heading: "Where public information fits",
        paragraphs: [
          "About, Terms, Privacy, Platform Rules, Accessibility, and Image Credits remain public destinations. Joining and signing in hand off to the Identity shell; they do not recreate account workflows inside the public site.",
        ],
      },
    ],
    relatedDestinationIds: ["howItWorks", "founding", "join"],
  },
  "image-credits": {
    slug: "image-credits",
    destinationId: "imageCredits",
    eyebrow: "Media provenance",
    title: "Image Credits",
    intro:
      "This destination is the canonical public attribution surface for imagery, illustrations, icons, maps, and other media that require credit.",
    statusNote:
      "The current TestRFx reference module does not ship third-party photography or licensed marketing imagery. Project source diagrams used to design this module are not published as public page assets.",
    sections: [
      {
        heading: "Attribution contract",
        bullets: [
          "Asset or media key",
          "Creator or source",
          "License and required attribution",
          "Where the asset is used",
          "Active or retired attribution state",
        ],
      },
      {
        heading: "Current registry",
        paragraphs: [
          "No third-party media attribution records are registered by this reference implementation. The persistence extension included with this module provides a media_attributions table for production use.",
        ],
      },
    ],
    relatedDestinationIds: ["about", "terms", "accessibility"],
  },
  terms: {
    slug: "terms",
    destinationId: "terms",
    eyebrow: "Legal destination",
    title: "Terms",
    intro:
      "This page establishes the RFxchange Terms route, information architecture, and versioning boundary for the Public shell.",
    statusNote:
      "Reference legal architecture only. Final binding Terms require legal review, an approved version, publication status, and an effective date before production launch.",
    sections: [
      {
        heading: "Participation and accounts",
        paragraphs: [
          "Production Terms should govern account eligibility, organization representation, authorized organization users, and the relationship between a user, organization membership, roles, and permissions.",
        ],
      },
      {
        heading: "Use of the Exchange",
        paragraphs: [
          "The Terms destination should cover participation across RFx, Resources, Intelligence, Capabilities, and shared workflows without treating those lenses as separate applications or agreements.",
        ],
      },
      {
        heading: "Content, evidence, and transactions",
        paragraphs: [
          "Production legal copy should address participant-submitted organization information, capability evidence, RFx materials, resource information, intelligence content, referrals, membership, payments, and other transaction terms where those workflows apply.",
        ],
      },
      {
        heading: "Version and acceptance",
        paragraphs: [
          "The canonical policy version should be independently stored, published, and linked to any acceptance record collected during registration, membership, or another governed workflow.",
        ],
      },
    ],
    relatedDestinationIds: ["privacy", "platformRules", "accessibility"],
  },
  privacy: {
    slug: "privacy",
    destinationId: "privacy",
    eyebrow: "Data governance destination",
    title: "Privacy",
    intro:
      "This page establishes the canonical Privacy destination for the account, organization, geographic, capability, and Exchange activity data represented in the RFxchange architecture.",
    statusNote:
      "Reference privacy architecture only. The production policy must be reviewed against the actual deployed services, providers, retention rules, and legal requirements before launch.",
    sections: [
      {
        heading: "Data represented by the platform",
        bullets: [
          "User account and organization membership information",
          "Organization profile and contact context",
          "Locations, geography, and service-area information",
          "Capabilities and supporting evidence",
          "RFx, resource, intelligence, referral, favorite, and activity records",
        ],
      },
      {
        heading: "Public and authenticated visibility",
        paragraphs: [
          "The production policy should explain which organization and Exchange records may be publicly visible, which require authentication, and how map/search visibility is controlled. Visibility rules should be enforced by the application layer rather than inferred by the client.",
        ],
      },
      {
        heading: "Lifecycle requirements",
        paragraphs: [
          "Production privacy operations should document collection purpose, retention, deletion or correction processes, security practices, analytics and communication use, and any rights or request mechanisms that apply to deployed users.",
        ],
      },
      {
        heading: "Versioned publication",
        paragraphs: [
          "The current Privacy version should be publishable independently and, when acceptance is required, linked to an auditable acceptance record rather than an unversioned page snapshot.",
        ],
      },
    ],
    relatedDestinationIds: ["terms", "platformRules", "accessibility"],
  },
  "platform-rules": {
    slug: "platform-rules",
    destinationId: "platformRules",
    eyebrow: "Exchange governance",
    title: "Platform Rules",
    intro:
      "Platform Rules define the behavioral and data-integrity expectations that support trustworthy participation across the RFxchange Exchange.",
    statusNote:
      "This is a reference governance structure. Production enforcement procedures and final rule language must be approved before they are relied on operationally.",
    sections: [
      {
        heading: "Represent organizations accurately",
        bullets: [
          "Do not impersonate an organization or user.",
          "Keep organization, location, and relationship information materially accurate.",
          "Do not claim authority, certifications, capabilities, or evidence that the organization does not possess.",
        ],
      },
      {
        heading: "Protect Exchange integrity",
        bullets: [
          "RFx and resource records should accurately represent the opportunity, request, offer, or availability being presented.",
          "Capability evidence should be associated with the organization and capability it is intended to support.",
          "Do not manipulate discovery, referrals, signals, or platform activity through deceptive or abusive behavior.",
        ],
      },
      {
        heading: "Use shared workflows responsibly",
        paragraphs: [
          "Cross-lens workflows such as referrals, responding, teaming, watching, and sharing should respect authorization, applicability, and operational-readiness rules supplied by the RFxchange action contracts.",
        ],
      },
      {
        heading: "Reporting and enforcement",
        paragraphs: [
          "Production governance should provide a reporting and review path and define how warnings, content restrictions, feature restrictions, suspensions, or account and organization actions are applied and audited.",
        ],
      },
    ],
    relatedDestinationIds: ["terms", "privacy", "accessibility"],
  },
  accessibility: {
    slug: "accessibility",
    destinationId: "accessibility",
    eyebrow: "Inclusive interaction",
    title: "Accessibility",
    intro:
      "RFxchange accessibility requirements apply across the Public shell, Identity and Onboarding, and the persistent map-first Exchange experience.",
    statusNote:
      "This reference statement describes implemented chassis patterns and integration requirements; it does not claim a formal conformance certification.",
    sections: [
      {
        heading: "Multiple ways to operate the interface",
        paragraphs: [
          "The Exchange drawer includes explicit controls in addition to drag gestures, and primary controls use semantic buttons and links. Production features should preserve keyboard, touch, and assistive-technology access rather than making a gesture the only path to an action.",
        ],
      },
      {
        heading: "Map information is not map-only",
        paragraphs: [
          "The results drawer is the authoritative record surface. Records without coordinates remain discoverable in the list, and map markers should synchronize with cards instead of becoming the only way to reach a record.",
        ],
      },
      {
        heading: "Motion and responsive behavior",
        paragraphs: [
          "The chassis includes reduced-motion handling and responsive compositions for mobile and desktop. New public and authenticated surfaces should preserve focus visibility, readable contrast, text scaling, and safe-area behavior.",
        ],
      },
      {
        heading: "Feedback path",
        paragraphs: [
          "A production accessibility feedback and support channel should be configured before launch so barriers can be reported, triaged, and tracked to resolution.",
        ],
      },
    ],
    relatedDestinationIds: ["about", "privacy", "platformRules"],
  },
} as const satisfies Record<string, PublicInfoPageDefinition>;

export function getPublicInfoPage(slug: string): PublicInfoPageDefinition | undefined {
  return PUBLIC_INFO_PAGES[slug as keyof typeof PUBLIC_INFO_PAGES];
}
