export const PUBLIC_DESTINATIONS = {
  howItWorks: {
    slug: "how-it-works",
    label: "How It Works",
    href: "/how-it-works",
    owner: "marketing",
    kind: "acquisition-integration",
    summary: "Public explanation of the RFxchange journey and Exchange model.",
  },
  businesses: {
    slug: "businesses",
    label: "Businesses",
    href: "/businesses",
    owner: "marketing",
    kind: "acquisition-integration",
    summary: "Audience destination for businesses participating in the Exchange.",
  },
  buyers: {
    slug: "buyers",
    label: "Buyers",
    href: "/buyers",
    owner: "marketing",
    kind: "acquisition-integration",
    summary: "Audience destination for buyers and opportunity issuers.",
  },
  resourceProviders: {
    slug: "resource-providers",
    label: "Resource Providers",
    href: "/resource-providers",
    owner: "marketing",
    kind: "acquisition-integration",
    summary: "Audience destination for organizations offering resources through RFxchange.",
  },
  founding: {
    slug: "founding",
    label: "Founding Membership",
    href: "/founding",
    owner: "pricing-membership",
    kind: "acquisition-integration",
    summary: "Public membership destination for the founding offer.",
  },
  about: {
    slug: "about",
    label: "About",
    href: "/about",
    owner: "about-legal-footer",
    kind: "information",
    summary: "What RFxchange is, how the three shells fit together, and how the Exchange is organized.",
  },
  join: {
    slug: "join",
    label: "Join Free",
    href: "/join",
    owner: "identity",
    kind: "identity-entry",
    targetHref: "/register",
    summary: "Canonical public handoff into RFxchange registration.",
  },
  signIn: {
    slug: "signin",
    label: "Sign In",
    href: "/signin",
    owner: "identity",
    kind: "identity-entry",
    targetHref: "/login",
    summary: "Canonical public handoff into RFxchange login.",
  },
  imageCredits: {
    slug: "image-credits",
    label: "Image Credits",
    href: "/image-credits",
    owner: "about-legal-footer",
    kind: "information",
    summary: "Attribution registry for public imagery and other media that require credit.",
  },
  terms: {
    slug: "terms",
    label: "Terms",
    href: "/terms",
    owner: "about-legal-footer",
    kind: "information",
    summary: "Reference structure for the RFxchange Terms destination and versioned policy lifecycle.",
  },
  privacy: {
    slug: "privacy",
    label: "Privacy",
    href: "/privacy",
    owner: "about-legal-footer",
    kind: "information",
    summary: "Reference structure for the RFxchange Privacy destination and data-governance disclosures.",
  },
  platformRules: {
    slug: "platform-rules",
    label: "Platform Rules",
    href: "/platform-rules",
    owner: "about-legal-footer",
    kind: "information",
    summary: "Participation and conduct rules for trustworthy use of the Exchange.",
  },
  accessibility: {
    slug: "accessibility",
    label: "Accessibility",
    href: "/accessibility",
    owner: "about-legal-footer",
    kind: "information",
    summary: "Accessibility commitments and product interaction requirements for RFxchange.",
  },
} as const;

export type PublicDestinationId = keyof typeof PUBLIC_DESTINATIONS;
export type PublicDestination = (typeof PUBLIC_DESTINATIONS)[PublicDestinationId];
export type PublicDestinationOwner = PublicDestination["owner"];

export const PUBLIC_HEADER_DESTINATIONS = [
  "howItWorks",
  "businesses",
  "buyers",
  "resourceProviders",
  "founding",
  "about",
] as const satisfies readonly PublicDestinationId[];

export const PUBLIC_FOOTER_GROUPS = [
  {
    label: "Explore",
    destinationIds: ["howItWorks", "businesses", "buyers", "resourceProviders", "founding"],
  },
  {
    label: "Organization",
    destinationIds: ["about", "join", "signIn", "imageCredits"],
  },
  {
    label: "Bottom Matter",
    destinationIds: ["terms", "privacy", "platformRules", "accessibility"],
  },
] as const satisfies readonly {
  label: string;
  destinationIds: readonly PublicDestinationId[];
}[];

export function getPublicDestinationBySlug(slug: string): PublicDestination | undefined {
  return Object.values(PUBLIC_DESTINATIONS).find((destination) => destination.slug === slug);
}
