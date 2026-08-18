# Public / Acquisition — About, Legal, and Footer Destinations

## Architectural rule

This module is the public information and trust subsystem inside the RFxchange Public / Acquisition shell. It does not create another application shell and it does not take ownership from Marketing, Pricing / Membership, or Identity & Onboarding.

The Marketing source defines the public footer hierarchy exactly as:

```text
Public / Acquisition
├── Explore
│   ├── How It Works          /how-it-works
│   ├── Businesses            /businesses
│   ├── Buyers                /buyers
│   ├── Resource Providers    /resource-providers
│   └── Founding Membership   /founding
├── Organization
│   ├── About                 /about
│   ├── Join Free             /join
│   ├── Sign In               /signin
│   └── Image Credits         /image-credits
└── Bottom Matter
    ├── Terms                 /terms
    ├── Privacy               /privacy
    ├── Platform Rules        /platform-rules
    └── Accessibility         /accessibility
```

`lib/public/destinations.ts` is the single route/ownership registry used by both Public-information chrome and the Marketing footer.

## True nested navigation

`lib/public/navigation.ts` builds a recursive navigation tree from the source-defined footer groups. A source-backed information page contributes its actual content sections as grandchildren beneath its destination. The hierarchy therefore becomes:

```text
Public / Acquisition
  -> Footer group
    -> Destination
      -> Source-defined section anchor
```

The browser pathname + hash are the navigation truth. `PublicHierarchyNav` derives the active path, auto-expands active ancestors, supports explicit expand/collapse state, and links every leaf to a concrete route or route fragment. This gives Back/Forward and deep links a deterministic nested state without creating a parallel router.

No child nodes are added for destinations whose internal hierarchy belongs to another module. In particular, How It Works, Businesses, Buyers, Resource Providers, Founding Membership, Join Free, and Sign In remain real leaf handoffs in this tree.

## Owned information destinations

This module owns:

- `/about`
- `/image-credits`
- `/terms`
- `/privacy`
- `/platform-rules`
- `/accessibility`

Each exact route is a normal Next.js page and renders the shared public-information surface. There is no generic “reserved route” or integration-placeholder page.

## Real sibling routes

The footer's other destinations already have owning implementations on the shared chassis:

```text
/how-it-works         -> Marketing
/businesses           -> Marketing
/buyers               -> Marketing
/resource-providers   -> Marketing
/founding             -> Pricing / Membership
/join                 -> Public auth-entry gateway -> Identity / Registration
/signin               -> Public auth-entry gateway -> Identity / Login
```

The shared public header/footer use the existing acquisition-context `ConversionLink` for Join and Sign In so campaign, referral, invitation, opportunity, and geography context can survive the handoff. Public information pages also mount the existing acquisition-context capture service.

## About source hierarchy

The About page preserves the current source sections:

- Connective economic infrastructure.
  - Visible
  - Connected
  - Actionable
- What it does not replace.

The bullets are page content, not additional navigation destinations.

## Current policy content

TestRFx now carries the current policy content from the canonical RFxchange source instead of reference placeholder copy.

Current publication metadata:

```text
Version:   2026.07.31
Effective: July 31, 2026
```

The nested policy hierarchy is the actual published document structure:

### Terms of Service

1. Acceptance and organizational use
2. Account eligibility and security
3. Organization information and authority
4. Opportunities, RFx activity, referrals, and teaming
5. Platform Rules
6. Content and platform license
7. Privacy and data handling
8. Fees and third-party services
9. Availability, changes, and platform authority
10. Suspension and termination
11. Disclaimers
12. Governing terms and contact

### Privacy Policy

1. Information we collect
2. How we use information
3. Public, participant-visible, and private information
4. How information may be shared
5. Data quality, controls, and account administration
6. Retention
7. Security
8. Children
9. Policy changes and questions

### Platform Rules

1. Represent organizations and authority accurately
2. Keep business information truthful
3. Protect process integrity
4. Respect participants and the network
5. Protect confidential and restricted information
6. Comply with law and applicable procurement rules
7. Enforcement

Terms and Platform Rules require acceptance in the canonical legal model; Privacy requires acknowledgement. Accessibility remains a public commitment/information page rather than being mislabeled as a required legal document.

## Image Credits and media provenance

The Image Credits destination is backed by `lib/public/assets.ts`, which contains the current governed seven-image public register from the RFxchange source:

- RONNAKORN TRIRAGANON · Unsplash — construction
- EqualStock · Unsplash — manufacturing
- Zhen Yao · Unsplash — workshop
- Vitaly Gariev · Unsplash — professional
- Vitaly Gariev · Unsplash — collaboration
- Phillip Flores · Unsplash — warehouse
- McGill Productions · Unsplash — region

Every asset is marked `atmosphere-only`. Stock photography is not product evidence, and the register explicitly prohibits fabricated screens, organizations, statistics, or testimonials from being presented as evidence. Final commercial rights/licensing review remains required.

## Accessibility source hierarchy

The Accessibility page preserves the source's two explicit children:

- Design intent
- Production commitments

The production commitments include keyboard-accessible navigation/workflows, visible focus, meaningful labels/errors, text alternatives, color-independent states, responsive/zoom support, and ongoing accessibility testing of authenticated workflows.

## Governance persistence

`db/public-governance.sql` models the durable policy/media layer:

- versioned Terms, Privacy, and Platform Rules documents;
- one current version per policy kind;
- exact user/document acknowledgement records with accepted/acknowledged status;
- optional organization context for an acknowledgement;
- a governed media-attribution register with evidence-use and commercial-license-review fields.

Policy content shown by the Public shell is canonical application content. A deployed database adapter can persist the same published versions and acknowledgement evidence without changing route or navigation contracts.

## Removed reference/mock behavior

This follow-on removes the obsolete patterns left by the first build:

- no `PublicIntegrationPage` that tells users a real route is “reserved”;
- no duplicate Marketing footer registry;
- no unused mock About/legal page definitions inside Marketing;
- no claim that Image Credits has zero third-party assets;
- no placeholder Terms/Privacy/Rules language when current published content exists;
- no direct `/join -> /register` or `/signin -> /login` shortcut that bypasses the real public auth-entry context gateway.

The module now uses real merged sibling routes and real source content while keeping ownership boundaries intact.
