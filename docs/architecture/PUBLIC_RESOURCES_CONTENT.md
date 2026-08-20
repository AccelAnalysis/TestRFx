# Public Resources / Content

## Purpose

Public Resources / Content is the RFxchange public knowledge, education, and preparation layer inside the **Public / Acquisition Shell**. It is not a public clone of the authenticated **Resources** lens.

The source architecture keeps operational Resource actions inside the Exchange: own-organization Offer / Edit / Share / Save-Archive, other-organization Request / View Detail / Share / Save-Follow, mapped/off-map/sponsored result treatment, and the cross-lens Referral workflow. Public Resources may explain and prepare for those behaviors, but it does not execute them.

## Public-to-authenticated boundary

```text
PUBLIC RESOURCES / CONTENT
Learn
Research
Prepare
Download worksheets
Understand terminology
        |
        v
LOGIN / REGISTER
(returnTo preserved)
        |
        v
IDENTITY & ONBOARDING
        |
        v
AUTHENTICATED EXCHANGE
RFx | Resources | Intelligence | Capabilities
```

`PublicContentItem` and an Exchange `resource` record remain separate domain objects.

## True hierarchy

The first build exposed the hierarchy as visual cards but only implemented `/resources` and flat `/resources/[slug]` detail routes. The deeper navigation is now canonical URL state.

```text
/resources
├── learn
│   ├── rfx-procurement
│   ├── finding-opportunities
│   ├── responding-to-rfx
│   ├── teaming-collaboration
│   ├── referrals
│   ├── capabilities
│   │   └── amacs
│   ├── resource-exchange
│   ├── market-intelligence
│   └── rfxchange-how-to
├── templates
│   ├── rfx-readiness
│   ├── capability-statement
│   ├── capability-discovery
│   ├── teaming-partner
│   ├── referral-preparation
│   ├── resource-offer-request
│   └── downloads
├── insights
│   ├── market-briefs
│   ├── regional-briefs
│   ├── industry-briefs
│   ├── procurement-insights
│   ├── capability-supply-demand
│   ├── rfx-trends
│   └── selected-public-intelligence
├── stories
│   ├── business-success
│   ├── buyer-use-cases
│   ├── resource-provider-use-cases
│   ├── teaming-examples
│   └── referral-connection-examples
├── reference
│   ├── rfxchange-glossary
│   ├── rfx-terminology
│   ├── amacs-overview
│   ├── capability-terminology
│   ├── resource-categories
│   └── faq-help
├── events
│   ├── webinars
│   ├── workshops
│   ├── recorded-sessions
│   ├── community-education
│   └── detail-registration
└── audiences
    ├── businesses
    ├── buyers
    └── resource-providers
```

The audience branch is source-supported by the Marketing flow, which explicitly names Businesses, Buyers, and Resource Providers.

Each node has a concrete URL, breadcrumb lineage, recursive active-branch navigation, and child cards. Browser Back/Forward therefore restores nested navigation depth without a separate client-only navigation stack.

## Published-content service

`lib/public-content/service.ts` is the read application service for committed published public content. It provides:

- published-content listing
- featured-content selection
- validated server query behavior
- facets derived from actual published items
- collection membership
- related-content ranking
- identity handoff URLs with `returnTo`

The server API `/api/public-content` delegates to the same service instead of reimplementing catalog filtering. The current source-controlled catalog is valid storage for a small read-only public library; a CMS can later replace that storage adapter without changing the page or API contracts.

The browser library explorer projects the same committed published catalog and stores filters in the URL. This keeps the public search shareable and Back/Forward-restorable while also remaining compatible with the static GitHub Pages preview, where runtime API routes do not execute.

## Search and nested state

Public search uses ordinary URL query parameters:

```text
/resources?q=capability&topic=Capabilities&audience=Buyers&type=guide
```

That gives search a concrete, shareable, browser-restorable state. It remains separate from Universal Exchange Search.

## Real downloadable tools

The original structure included downloadable worksheets/templates. The implementation now ships real source-controlled files for:

- RFx readiness
- capability statement preparation
- capability discovery
- teaming / partner preparation
- referral preparation
- Resource offer / request preparation

The aggregate `/resources/templates/downloads` route exposes all of those files. These assets prepare work only; they do not fake authenticated saves, submissions, referrals, or Resource mutations.

## Empty collections are truthful

Some source-defined collections do not yet have a real RFxchange publication, customer story, event, or governed dataset. Those routes remain valid but show an explicit empty published-content state.

The implementation does **not** invent:

- customer success stories
- buyer/provider case studies
- webinars or workshops
- event registrations
- industry briefs
- RFx trend claims
- popularity metrics

When a real item is published, it can be added to the catalog and assigned to the existing node without redesigning navigation.

## Source-specific Resource workflow boundary

The authenticated Resources source defines:

```text
OWN VIEW
Offer Resource -> Offer Resource modal
Edit Resource -> Manage / Edit Resource
Share -> Share menu / send resource
Save / Archive -> Save or Archive action

OTHERS VIEW
Request Resource -> Request Resource modal
View Resource Detail -> Resource detail view
Share -> Share menu / send to another organization
Save -> Save / follow action

CROSS-LENS REFERRAL
Refer from result/detail
-> Referral modal
-> recipient referral policy / fee
-> Menu -> Referrals Management
```

Public Resources does not duplicate these workflows. Its Resource-exchange guide and Resource offer/request worksheet terminate in Login/Register handoffs that preserve `/exchange/resources` as the intended destination.

## Identity handoff

Public Exchange CTAs no longer jump directly into an unauthenticated reference Exchange. They use:

```text
/login?returnTo=/exchange/{lens}
/register?source=resources&returnTo=/exchange/{lens}
```

The merged Identity flow accepts and sanitizes internal `returnTo` destinations. This keeps Public Resources inside the three-shell operating model.

## GitHub Pages preview

Production source keeps `/api/public-content`, while the GitHub Pages preview removes runtime API routes in its temporary build projection. Public Resources remains previewable because its pages render from the same source-controlled read service at build time and its search projection operates in the browser against that same published catalog.

## Rule for future work

Public content may educate, explain, publish research, provide downloadable preparation tools, and preserve intent into Identity/Onboarding. If an action changes organization state, creates or updates an Exchange record, saves/follows/watches a record, responds, offers, requests, refers, connects, or otherwise performs authenticated Exchange work, it belongs to the authenticated chassis or shared workflow services rather than Public Resources / Content.
