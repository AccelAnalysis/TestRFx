import type { PublicDestinationId } from "./destinations";

export const PUBLIC_POLICY_VERSION = "2026.07.31" as const;
export const PUBLIC_POLICY_EFFECTIVE_DATE = "July 31, 2026" as const;

export type PublicPageSection = {
  id: string;
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
  sections: readonly PublicPageSection[];
  relatedDestinationIds: readonly PublicDestinationId[];
  policy?: {
    version: string;
    effectiveDate: string;
  };
  assetRegistry?: "public-images";
};

export const PUBLIC_INFO_PAGES = {
  about: {
    slug: "about",
    destinationId: "about",
    eyebrow: "Visible · Connected · Actionable",
    title: "Connect the assets already present in the business ecosystem.",
    intro:
      "The RFxchange is a map-based local business growth network designed to make business capabilities, opportunities, resources, referrals and relationships easier to discover and act on.",
    sections: [
      {
        id: "connective-economic-infrastructure",
        heading: "Connective economic infrastructure.",
        paragraphs: [
          "Communities already contain businesses, buyers, opportunities, institutions, resource providers and expertise. What is often missing is a common environment through which those assets can reliably find one another.",
        ],
        bullets: [
          "Visible — Make organizations, capabilities, service territories and market needs easier to understand.",
          "Connected — Bring opportunities, referrals, teaming and resources into one business-centered operating environment.",
          "Actionable — Organize activity into journeys that can progress toward responses, relationships, services and outcomes.",
        ],
      },
      {
        id: "what-it-does-not-replace",
        heading: "What it does not replace.",
        paragraphs: [
          "RFxchange is not a substitute for public procurement systems, economic-development organizations, chambers, lenders, workforce providers, CRMs, universities or professional advisers. It is designed to improve discovery and interaction between them and the businesses they serve.",
        ],
      },
    ],
    relatedDestinationIds: ["howItWorks", "businesses", "join"],
  },
  "image-credits": {
    slug: "image-credits",
    destinationId: "imageCredits",
    eyebrow: "Public asset provenance",
    title: "Photography sources and evidence rules.",
    intro:
      "Stock photography supports atmosphere only. It is not evidence of RFxchange participants, activity, outcomes, testimonials, or adoption.",
    sections: [
      {
        id: "governed-photography-register",
        heading: "Every public image has a named source.",
        paragraphs: [
          "The public marketing source uses credited Unsplash photography. No fabricated RFxchange screens, organizations, opportunities, maps, statistics, testimonials, or outcomes are presented as evidence.",
          "Final commercial deployment requires another rights and licensing review.",
        ],
      },
    ],
    relatedDestinationIds: ["about", "terms", "accessibility"],
    assetRegistry: "public-images",
  },
  terms: {
    slug: "terms",
    destinationId: "terms",
    eyebrow: "Current published policy",
    title: "RFxchange Terms of Service",
    intro:
      "These Terms govern use of the RFxchange business network, including organization accounts, profiles, opportunities, referrals, teaming, resources, and related platform services.",
    policy: {
      version: PUBLIC_POLICY_VERSION,
      effectiveDate: PUBLIC_POLICY_EFFECTIVE_DATE,
    },
    sections: [
      {
        id: "acceptance-and-organizational-use",
        heading: "1. Acceptance and organizational use",
        paragraphs: [
          "By creating or using an RFxchange account, you agree to these Terms for your own use of the platform. If you act for an organization, you also represent that you are authorized to provide the information and take the actions you submit on that organization’s behalf.",
          "RFxchange is organization-centered. Individual user identities operate through organization memberships and permissions; a user’s title, relationship description, or profile text does not by itself grant organizational authority.",
        ],
      },
      {
        id: "account-eligibility-and-security",
        heading: "2. Account eligibility and security",
        bullets: [
          "Provide accurate account and contact information and keep it current.",
          "Protect credentials, verification links, sessions, and administrative access.",
          "Do not share accounts in a way that defeats individual attribution or organizational permissions.",
          "Notify RFxchange through the published support channel if you believe an account or organization has been compromised.",
        ],
      },
      {
        id: "organization-information-and-authority",
        heading: "3. Organization information and authority",
        paragraphs: [
          "You are responsible for the accuracy of organization identity, locations, capabilities, certifications, opportunities, responses, referrals, outcomes, and other information you submit. Claiming or creating an organization record does not automatically make the organization Verified or endorse its claims.",
          "RFxchange may require additional evidence, review, re-verification, or administrative approval before allowing sensitive organization actions or displaying trust indicators.",
        ],
      },
      {
        id: "opportunities-rfx-referrals-and-teaming",
        heading: "4. Opportunities, RFx activity, referrals, and teaming",
        paragraphs: [
          "RFxchange provides infrastructure for discovery, communication, structured requests, responses, referrals, teaming, and related business activity. Participants remain responsible for their own diligence, decisions, contracts, pricing, performance, compliance, and professional advice.",
          "Unless RFxchange expressly states otherwise for a specific transaction, RFxchange is not a party to agreements between participants and does not guarantee an award, referral conversion, contract, financing decision, provider outcome, or other business result.",
        ],
      },
      {
        id: "platform-rules",
        heading: "5. Platform Rules",
        paragraphs: [
          "The RFxchange Platform Rules are incorporated into these Terms. You must use the network legitimately, accurately, respectfully, and without manipulating platform processes, credibility, referrals, evaluations, or access controls.",
        ],
      },
      {
        id: "content-and-platform-license",
        heading: "6. Content and platform license",
        paragraphs: [
          "You retain ownership of content you submit, subject to rights you may have granted to others. You grant RFxchange the limited rights reasonably necessary to host, process, reproduce, display, transmit, index, match, analyze, and otherwise operate that content according to your visibility settings, platform workflows, and these Terms.",
          "Do not submit content you do not have the right to use or disclose, including protected confidential information, personal information, trade secrets, or copyrighted material outside the permissions that apply to you.",
        ],
      },
      {
        id: "privacy-and-data-handling",
        heading: "7. Privacy and data handling",
        paragraphs: [
          "RFxchange handles account, organization, location, activity, and related data as described in the Privacy Policy. Public, participant-visible, restricted, and private information may be treated differently based on the feature and visibility choice involved.",
        ],
      },
      {
        id: "fees-and-third-party-services",
        heading: "8. Fees and third-party services",
        paragraphs: [
          "Some current or future features may involve paid plans, transaction fees, credits, payment processors, mapping services, communications providers, or other third-party services. Applicable commercial terms will be presented before a charge or paid commitment is created. Third-party services may also be governed by their own terms.",
        ],
      },
      {
        id: "availability-changes-and-platform-authority",
        heading: "9. Availability, changes, and platform authority",
        paragraphs: [
          "RFxchange may add, modify, suspend, restrict, or retire features, workflows, integrations, eligibility rules, or geography availability. Emergency, security, legal, integrity, or operational conditions may require immediate intervention.",
          "Material changes to these Terms may require renewed acceptance before continued use of affected services. Historical acceptance records may be retained as audit evidence.",
        ],
      },
      {
        id: "suspension-and-termination",
        heading: "10. Suspension and termination",
        paragraphs: [
          "RFxchange may restrict, suspend, or terminate access when reasonably necessary to address security risk, fraud, unlawful use, material policy violations, platform manipulation, nonpayment of applicable charges, or protection of participants and platform integrity. Restrictions may apply to a user, organization, feature, action, or geography rather than the entire account where appropriate.",
        ],
      },
      {
        id: "disclaimers",
        heading: "11. Disclaimers",
        paragraphs: [
          "RFxchange is provided on an as-available basis. Business information, participant claims, opportunity details, resource information, and third-party data may contain errors or change over time. Participants should independently verify information that matters to a business, legal, financial, procurement, compliance, or contracting decision.",
        ],
      },
      {
        id: "governing-terms-and-contact",
        heading: "12. Governing terms and contact",
        paragraphs: [
          "If a separate written agreement with RFxchange expressly conflicts with these Terms, that written agreement controls for the conflicting subject matter. Otherwise these Terms constitute the governing platform-use agreement together with incorporated policies and feature-specific terms presented to you.",
          "Questions about these Terms may be submitted through the support or contact channel published by RFxchange.",
        ],
      },
    ],
    relatedDestinationIds: ["platformRules", "privacy", "join"],
  },
  privacy: {
    slug: "privacy",
    destinationId: "privacy",
    eyebrow: "Current published policy",
    title: "RFxchange Privacy Policy",
    intro:
      "This policy explains how RFxchange handles user, organization, location, activity, communications, and related information used to operate the business network.",
    policy: {
      version: PUBLIC_POLICY_VERSION,
      effectiveDate: PUBLIC_POLICY_EFFECTIVE_DATE,
    },
    sections: [
      {
        id: "information-we-collect",
        heading: "1. Information we collect",
        bullets: [
          "Account information such as name, email address, authentication identifiers, account-security status, and organization memberships.",
          "Organization information such as business identity, website, contacts, capabilities, roles, objectives, locations, service geographies, authority evidence, and profile information.",
          "Network activity such as opportunities, RFx activity, responses, referrals, teaming activity, resource interactions, workflow state, notifications, administrative actions, and outcome records as features become available.",
          "Technical and security information such as session metadata, timestamps, audit events, device or request information, error information, and security signals needed to operate and protect the platform.",
          "Commercial information when paid features are used, including platform commercial state and provider references. Payment-card details may be handled directly by the applicable payment provider rather than stored by RFxchange.",
        ],
      },
      {
        id: "how-we-use-information",
        heading: "2. How we use information",
        bullets: [
          "Authenticate users and enforce organization permissions, lifecycle gates, geography rules, and account security.",
          "Create and display organization profiles, map presence, discovery results, opportunities, referrals, resources, teaming, and related workflows according to applicable visibility settings.",
          "Operate communications, notifications, support, moderation, audit, fraud prevention, security, and administrative review.",
          "Improve matching, discovery, platform reliability, product design, analytics, and network intelligence using data appropriate to those purposes.",
          "Comply with legal obligations and enforce platform agreements and policies.",
        ],
      },
      {
        id: "public-participant-visible-and-private-information",
        heading: "3. Public, participant-visible, and private information",
        paragraphs: [
          "RFxchange distinguishes information intended for public discovery from participant-visible, organization-restricted, administrative, and private information. Location privacy controls may publish an exact location, an approximate representation, or locality-only presence while retaining the confirmed private location needed for platform integrity.",
          "A public organization profile or marker does not make all underlying account, contact, authority, evidence, or location records public.",
        ],
      },
      {
        id: "how-information-may-be-shared",
        heading: "4. How information may be shared",
        bullets: [
          "With other participants when you publish, share, respond, refer, team, communicate, or otherwise use a workflow designed to disclose that information.",
          "With service providers that process data for hosting, authentication, mapping/geocoding, communications, payments, security, analytics, support, or other platform operations subject to appropriate service relationships.",
          "When reasonably necessary to protect RFxchange, participants, the public, or platform security; investigate misuse; enforce agreements; or comply with valid legal process.",
          "As part of a business reorganization, financing, merger, acquisition, or transfer where lawful and subject to appropriate handling of the information involved.",
        ],
      },
      {
        id: "data-quality-controls-and-account-administration",
        heading: "5. Data quality, controls, and account administration",
        paragraphs: [
          "Users and organization administrators can update information made editable through the platform. Some records—including audit, security, legal-acceptance, authority, transaction, or compliance records—may be retained as immutable or controlled history rather than editable profile content.",
          "Organization administrators may manage organization memberships and permissions within the authority granted to them. Platform administrators may access limited information when authorized for support, security, claims, moderation, audit, or other governed administrative purposes.",
        ],
      },
      {
        id: "retention",
        heading: "6. Retention",
        paragraphs: [
          "RFxchange retains information for as long as reasonably necessary for the purpose for which it was collected, active platform operation, security, auditability, dispute resolution, contractual obligations, legal requirements, and legitimate record-preservation needs. Retention may differ by data class and does not mean every record is kept indefinitely.",
        ],
      },
      {
        id: "security",
        heading: "7. Security",
        paragraphs: [
          "RFxchange uses account authentication, server-side authorization, scoped permissions, session controls, audit records, provider security controls, and other safeguards appropriate to the platform architecture. No online service can guarantee absolute security, and participants are responsible for protecting their credentials and devices.",
        ],
      },
      {
        id: "children",
        heading: "8. Children",
        paragraphs: [
          "RFxchange is a business network and is not intended for use by children. Individuals creating accounts must be legally capable of entering the applicable platform agreement and acting in the represented business context.",
        ],
      },
      {
        id: "policy-changes-and-questions",
        heading: "9. Policy changes and questions",
        paragraphs: [
          "RFxchange may update this Privacy Policy as the platform, law, data uses, or service providers change. Material changes may be presented through renewed acknowledgement or additional permission requests where appropriate. Historical versions and acknowledgement evidence may be retained.",
          "Privacy questions or requests may be submitted through the support or contact channel published by RFxchange. Additional jurisdiction-specific rights or notices will be provided when applicable to the user, organization, feature, or processing activity involved.",
        ],
      },
    ],
    relatedDestinationIds: ["terms", "platformRules", "accessibility"],
  },
  "platform-rules": {
    slug: "platform-rules",
    destinationId: "platformRules",
    eyebrow: "Current published policy",
    title: "RFxchange Platform Rules",
    intro:
      "These rules protect legitimate business participation, accurate organizational representation, process integrity, and respectful use of the Exchange.",
    policy: {
      version: PUBLIC_POLICY_VERSION,
      effectiveDate: PUBLIC_POLICY_EFFECTIVE_DATE,
    },
    sections: [
      {
        id: "represent-organizations-and-authority-accurately",
        heading: "1. Represent organizations and authority accurately",
        bullets: [
          "Do not impersonate an organization, user, official, buyer, provider, partner, or administrator.",
          "Do not claim ownership, employment, authorization, certification, verification, past performance, or capabilities you cannot substantiate.",
          "Use organization memberships and permissions rather than shared or misleading user identities.",
        ],
      },
      {
        id: "keep-business-information-truthful",
        heading: "2. Keep business information truthful",
        bullets: [
          "Describe capabilities, locations, service areas, availability, qualifications, pricing, opportunities, responses, and outcomes accurately.",
          "Correct material information when you learn it is inaccurate or no longer current.",
          "Do not create duplicate or fabricated organizations, opportunities, referrals, responses, transactions, or outcomes to influence discovery or credibility.",
        ],
      },
      {
        id: "protect-process-integrity",
        heading: "3. Protect process integrity",
        bullets: [
          "Do not manipulate RFx evaluations, referrals, teaming invitations, endorsements, reviews, badges, rankings, or other trust signals.",
          "Do not coordinate false activity, self-dealing activity, reciprocal manipulation, or manufactured engagement intended to mislead other participants.",
          "Do not bypass access controls, geographic restrictions, organization permissions, administrative decisions, or protected workflows.",
        ],
      },
      {
        id: "respect-participants-and-the-network",
        heading: "4. Respect participants and the network",
        bullets: [
          "Do not harass, threaten, discriminate against, defraud, deceive, or exploit other participants.",
          "Do not send spam, deceptive solicitation, malware, credential-harvesting requests, or irrelevant mass outreach.",
          "Use contact information obtained through RFxchange for legitimate business purposes consistent with the context in which it was provided.",
        ],
      },
      {
        id: "protect-confidential-and-restricted-information",
        heading: "5. Protect confidential and restricted information",
        bullets: [
          "Do not disclose information marked confidential, private, restricted, or otherwise protected unless you have authority to do so.",
          "Do not use another participant’s nonpublic information outside the business process for which access was provided.",
          "Do not upload regulated, restricted, export-controlled, classified, or highly sensitive information unless the applicable RFxchange feature expressly supports that data class.",
        ],
      },
      {
        id: "comply-with-law-and-procurement-rules",
        heading: "6. Comply with law and applicable procurement rules",
        paragraphs: [
          "Participants are responsible for laws, regulations, procurement requirements, professional obligations, licensing requirements, sanctions, export controls, privacy duties, and contractual restrictions that apply to their activity.",
        ],
      },
      {
        id: "enforcement",
        heading: "7. Enforcement",
        paragraphs: [
          "RFxchange may investigate reported or detected misuse and may remove content, pause an action, limit a capability, require evidence, restrict an account or organization, revoke administrative authority, or suspend access where necessary to protect participants and platform integrity. Enforcement may be scoped and audited rather than applied broadly when a narrower response is appropriate.",
        ],
      },
    ],
    relatedDestinationIds: ["terms", "privacy", "accessibility"],
  },
  accessibility: {
    slug: "accessibility",
    destinationId: "accessibility",
    eyebrow: "Access for every participant",
    title: "Accessibility",
    intro:
      "RFxchange should be usable by people with different abilities, devices and ways of navigating digital services.",
    sections: [
      {
        id: "design-intent",
        heading: "Design intent",
        paragraphs: [
          "The public and account surfaces use semantic landmarks, keyboard-focusable links and controls, text alternatives for imagery, responsive layouts and contrast-aware brand colors.",
        ],
      },
      {
        id: "production-commitments",
        heading: "Production commitments",
        paragraphs: [
          "Accessibility issues should have a defined contact and remediation path before launch.",
        ],
        bullets: [
          "Keyboard-accessible navigation and workflows",
          "Visible focus treatment",
          "Meaningful labels and error messages",
          "Text alternatives for nondecorative images",
          "Color-independent states",
          "Responsive layouts and zoom support",
          "Ongoing accessibility testing of authenticated workflows",
        ],
      },
    ],
    relatedDestinationIds: ["about", "privacy", "platformRules"],
  },
} as const satisfies Record<string, PublicInfoPageDefinition>;

export function getPublicInfoPage(slug: string): PublicInfoPageDefinition | undefined {
  return PUBLIC_INFO_PAGES[slug as keyof typeof PUBLIC_INFO_PAGES];
}
