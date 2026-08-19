# Public / Acquisition Shell — Campaign Landing Pages

## Architectural rule

Campaign landing pages are acquisition-specific presentations of RFxchange. They are **not** independent applications, alternate identity systems, alternate Exchanges, or authorization boundaries.

A campaign can change the message, audience, launch geography, membership path, partner/referral context, and intended first Exchange lens. It must not silently create canonical organization, geography, capability, membership, financial, or authorization truth.

The Marketing source also names Direct / Organic Search, LinkedIn / Social, Email / Outreach, and Partner / Referral / Campaign as inbound acquisition pathways. Those are attribution channels, not submenu destinations, so this module does not invent navigation nodes for them.

## Source-aligned public destinations

Campaign pages reuse the canonical Public header and footer. This preserves the source-defined destinations rather than maintaining a smaller campaign-only footer:

- How It Works
- Businesses
- Buyers
- Resource Providers
- Founding Membership
- About
- Join Free
- Sign In
- Image Credits
- Terms
- Privacy
- Platform Rules
- Accessibility

`#how-it-works` remains the in-page campaign workflow anchor where relevant.

## True navigation hierarchy

The prior campaign directory was flat. Campaign navigation is now recursive and URL-addressable:

```text
Campaign Landing Pages                       /campaign
│
├── Membership / Conversion                  /campaign/families/membership
│   └── Founding Membership                  /campaign/families/membership/founding-membership
│       ├── Campaign overview                #overview
│       ├── How It Works                     #how-it-works
│       ├── Founding Membership              /founding
│       ├── Join                             /join → /register
│       └── Sign In                          /signin → /login
│
├── Audience                                 /campaign/families/audience
│   └── Resource Providers                   /campaign/families/audience/resource-providers
│       ├── Campaign overview
│       ├── How It Works
│       ├── Resource Providers               /resource-providers
│       ├── Join
│       └── Sign In
│
├── Geographic Launch                        /campaign/families/geography
│   └── Isle of Wight Founders               /campaign/families/geography/isle-of-wight-founders
│       ├── Campaign overview
│       ├── How It Works
│       ├── How RFxchange Works              /how-it-works
│       ├── Join
│       └── Sign In
│
├── Exchange Use Case                        /campaign/families/use-case
│   └── Find RFx Opportunities               /campaign/families/use-case/find-rfx-opportunities
│       ├── Campaign overview
│       ├── How It Works
│       ├── How RFxchange Works              /how-it-works
│       ├── Join
│       └── Sign In
│
├── Capability / Industry                    /campaign/families/capability-industry
│   └── Capability Discovery                 /campaign/families/capability-industry/capability-discovery
│       ├── Campaign overview
│       ├── How It Works
│       ├── Businesses                       /businesses
│       ├── Join
│       └── Sign In
│
└── Partner / Referral                       /campaign/families/partner
    └── Partner Network                      /campaign/families/partner/partner-network
        ├── Campaign overview
        ├── How It Works
        ├── How RFxchange Works              /how-it-works
        ├── Join
        └── Sign In
```

The earlier contract named Content / Education and Time-Bounded as possible campaign families but had no concrete child campaigns. They are therefore not rendered as empty or fabricated branches. They can be added only when a real campaign definition and destination exist.

Legacy `/campaign/{slug}` URLs redirect to the canonical nested campaign route in the production runtime.

## Nested navigation state

`buildCampaignNavigationTree()` is the canonical recursive tree. It supplies root, family, campaign, and workflow nodes. The active family and campaign are encoded in the URL and reflected in breadcrumbs plus the recursive tree, so deep links, browser Back/Forward, and static preview routes share the same hierarchy.

The hierarchy is navigation only. It does not duplicate downstream business logic.

## Campaign workflow leaves

Every live campaign has concrete leaf destinations:

1. **Campaign overview** — the campaign's own `#overview` section.
2. **How It Works** — the campaign-specific `#how-it-works` sequence.
3. **Relevant Public destination** — for example `/founding`, `/businesses`, or `/resource-providers`.
4. **Join** — canonical `/join` Public gateway, then Registration and the existing onboarding chain.
5. **Sign In** — canonical `/signin` Public gateway, then Login/readiness routing.

The Join and Sign In leaves carry a protected internal `returnTo` for one of the existing Exchange lenses. No campaign links directly into an authenticated lens as a substitute for authentication/readiness.

## Runtime shape

```text
Inbound acquisition channel
  ↓
/campaign
  ↓
/campaign/families/{family}
  ↓
/campaign/families/{family}/{slug}
  ↓
Governed CampaignDefinition + recursive navigation
  ↓
/join or /signin
  ↓
Identity & Onboarding owning workflows
  ↓
Exchange-ready completion / readiness policy
  ↓
/exchange/{rfx|resources|intelligence|capabilities}
```

The authenticated destination is always one of the existing RFxchange lenses. Campaigns do not add bottom-navigation items or alter Exchange composition.

## Real services and removed mock behavior

The original campaign build contained a CSS-only simulated Exchange map/search/drawer preview. That mock has been removed.

Campaign pages now integrate with actual repository services and routes:

- `GET /api/public/campaigns` exposes the live governed campaign catalog and navigation tree.
- `PublicHeader` / `PublicFooter` provide the canonical Public destination system.
- `/join` and `/signin` are the canonical Public-to-Identity gateways.
- Registration owns account creation and carries bounded acquisition context onward.
- Account Verification owns email/access verification.
- Organization Selection / Creation owns canonical organization resolution.
- Geography owns canonical location confirmation.
- Organization Profile and Capability Enrichment own organization/capability truth.
- Pricing / Membership owns the Founding Membership commercial path where applicable.
- Exchange-ready Completion/readiness owns authenticated entry.
- RFx, Resources, Intelligence, and Capabilities remain the only Exchange lenses.

The campaign renderer does not simulate those services and does not report a fake success state for them.

## Attribution and handoff

The canonical acquisition/registration context now retains:

- `returnTo`
- `source`
- `medium`
- `campaign`
- `content`
- `partner`
- `referral`
- `invitation`
- `organization`
- `membership`
- `geography`
- `record`

UTM aliases are normalized at the Public/Identity boundary:

- `utm_source` → `source`
- `utm_medium` → `medium`
- `utm_campaign` → `campaign` when no explicit RFxchange campaign slug is present
- `utm_content` → `content`
- `ref` → `referral`
- `opportunity` → `record`

When both the RFxchange campaign wrapper and an inbound UTM source exist, the inbound UTM source is preserved as the acquisition source while the RFxchange campaign slug remains the campaign identifier.

`returnTo` remains constrained to a safe internal path. Campaign definitions type their intended destination as `ExchangeLens`, so the campaign layer cannot manufacture another lens.

## Security and truth boundary

Campaign and referral values are **inputs**, not authority. They must not independently:

- grant permissions or roles;
- establish membership rights;
- award credits or financial benefits;
- assert organization ownership;
- assert geography as verified organization truth;
- write capability claims;
- bypass account verification or onboarding requirements.

Those decisions belong to Identity, Membership, Referrals, Capabilities, and authorization services behind the operating chassis.

## Conversion measurement

The campaign catalog is now an actual runtime application boundary rather than a display-only mock. End-to-end business measurement should still be assembled from the owning platform events rather than having campaign pages fabricate downstream completion:

```text
Landing / campaign context
  → Join or Sign In
  → Registration
  → Account Verification
  → Organization established
  → Geography established
  → Profile / capabilities enriched
  → Membership event when applicable
  → Exchange-ready completion
  → Intended lens entered
  → First campaign-relevant Exchange action
```

The campaign layer owns acquisition context. Each downstream module owns the event that proves its own milestone.

## GitHub Pages preview boundary

GitHub Pages is a static preview host. The Pages build strips runtime API routes and substitutes static Identity surfaces where a server is required. The production-capable source retains `/api/public/campaigns`, Identity APIs, readiness APIs, and the rest of the server boundaries.

Static preview behavior must never be described as durable identity, attribution, membership, authorization, or workflow persistence.

## Extension rule

A future CMS, database, experiment service, or partner-management service may replace the in-code campaign catalog as long as it emits the same governed `CampaignDefinition` and recursive hierarchy contract.

New campaign families are added only when they have a real child campaign. Empty categories are not rendered simply because an architecture brainstorm named them.
