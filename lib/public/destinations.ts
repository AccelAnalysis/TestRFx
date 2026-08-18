export const PUBLIC_DESTINATIONS = {
  howItWorks: {
    slug: "how-it-works",
    label: "How It Works",
    href: "/how-it-works",
    owner: "marketing",
    kind: "marketing",
    summary: "Public explanation of how RFxchange works.",
  },
  businesses: {
    slug: "businesses",
    label: "Businesses",
    href: "/businesses",
    owner: "marketing",
    kind: "marketing",
    summary: "Public destination for businesses participating in the Exchange.",
  },
  buyers: {
    slug: "buyers",
    label: "Buyers",
    href: "/buyers",
    owner: "marketing",
    kind: "marketing",
    summary: "Public destination for buyers and opportunity issuers.",
  },
  resourceProviders: {
    slug: "resource-providers",
    label: "Resource Providers",
    href: "/resource-providers",
    owner: "marketing",
    kind: "marketing",
    summary: "Public destination for organizations offering resources through RFxchange.",
  },
  founding: {
    slug: "founding",
    label: "Founding Membership",
    headerLabel: "Founding",
    href: "/founding",
    owner: "pricing-membership",
    kind: "membership",
    summary: "Public Founding Membership destination.",
  },
  about: {
    slug: "about",
    label: "About",
    href: "/about",
    owner: "about-legal-footer",
    kind: "information",
    summary: "How RFxchange connects existing business assets through a shared Exchange.",
  },
  join: {
    slug: "join",
    label: "Join Free",
    href: "/join",
    owner: "identity",
    kind: "identity-entry",
    summary: "Public registration gateway that preserves acquisition context before Identity and Onboarding.",
  },
  signIn: {
    slug: "signin",
    label: "Sign In",
    href: "/signin",
    owner: "identity",
    kind: "identity-entry",
    summary: "Public sign-in gateway that preserves acquisition context before Identity and Onboarding.",
  },
  imageCredits: {
    slug: "image-credits",
    label: "Image Credits",
    href: "/image-credits",
    owner: "about-legal-footer",
    kind: "information",
    summary: "Public photography provenance and evidence-use rules for RFxchange.",
  },
  terms: {
    slug: "terms",
    label: "Terms",
    href: "/terms",
    owner: "about-legal-footer",
    kind: "policy",
    summary: "Current RFxchange Terms of Service.",
  },
  privacy: {
    slug: "privacy",
    label: "Privacy",
    href: "/privacy",
    owner: "about-legal-footer",
    kind: "policy",
    summary: "Current RFxchange Privacy Policy.",
  },
  platformRules: {
    slug: "platform-rules",
    label: "Platform Rules",
    href: "/platform-rules",
    owner: "about-legal-footer",
    kind: "policy",
    summary: "Current RFxchange Platform Rules.",
  },
  accessibility: {
    slug: "accessibility",
    label: "Accessibility",
    href: "/accessibility",
    owner: "about-legal-footer",
    kind: "information",
    summary: "Accessibility principles and production commitments for RFxchange public and account surfaces.",
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
    id: "explore",
    label: "Explore",
    destinationIds: ["howItWorks", "businesses", "buyers", "resourceProviders", "founding"],
  },
  {
    id: "organization",
    label: "Organization",
    destinationIds: ["about", "join", "signIn", "imageCredits"],
  },
  {
    id: "bottom-matter",
    label: "Bottom Matter",
    destinationIds: ["terms", "privacy", "platformRules", "accessibility"],
  },
] as const satisfies readonly {
  id: string;
  label: string;
  destinationIds: readonly PublicDestinationId[];
}[];

export function getPublicDestinationBySlug(slug: string): PublicDestination | undefined {
  return Object.values(PUBLIC_DESTINATIONS).find((destination) => destination.slug === slug);
}
