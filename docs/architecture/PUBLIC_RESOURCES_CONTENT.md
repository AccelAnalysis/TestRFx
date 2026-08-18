# Public Resources / Content

## Purpose

Public Resources / Content is the RFxchange public knowledge, education, and discovery layer. It belongs to the **Public / Acquisition Shell** and must not become a public clone of the authenticated **Resources** lens.

The public surface helps visitors learn, research, prepare, and understand RFxchange. Operational Exchange records and actions remain in the authenticated operating chassis.

## Governing boundary

```text
PUBLIC RESOURCES / CONTENT
Learn
Research
Prepare
Understand terminology
Preview Exchange value
        |
        v
LOGIN / REGISTER
        |
        v
AUTHENTICATED EXCHANGE
Discover live records
Save / watch
Offer / request
Respond / team
Refer / connect
Manage organization state
```

Two different domain concepts intentionally exist:

- `PublicContentItem` — article, guide, template, insight, case study, reference, or learning event.
- `ExchangeRecord` of type `resource` — operational resource offer/request/provider record rendered through the Exchange chassis.

They should not share one generic `Resource` model.

## Routes

```text
/resources
/resources/[slug]
/api/public-content
```

`/resources` is the public library hub. `/resources/[slug]` is the shared public content detail surface. `/api/public-content` is a normalized application boundary for future CMS/search persistence and currently serves the deterministic reference catalog.

The authenticated Resources lens remains:

```text
/exchange/resources
```

## Information architecture

The public library is organized by two parallel dimensions.

### Exchange concepts

- RFx
- Capabilities
- Resources
- Intelligence
- Teaming & Referrals

The first four mirror the Exchange mental model. Teaming & Referrals remains cross-lens, consistent with the operating chassis.

### Audiences

- Businesses
- Buyers
- Resource Providers

A content item can target multiple audiences without creating separate copies of the same material.

## Content types

The reference implementation supports:

- guide
- template
- insight
- case study
- reference
- event

The data contract also contains summary, topic, audiences, reading time, publication date, body content, practical takeaways, featured state, and a contextual Exchange CTA.

## Search boundary

Public library search only searches public publishing content. It does not masquerade as Universal Exchange Search.

The reference explorer supports:

- keyword search
- topic filtering
- audience filtering
- content-type filtering

A production implementation can replace the deterministic catalog with CMS and/or search infrastructure behind `/api/public-content` without changing the page composition.

## Public-to-Exchange handoff

Every content detail can point to the appropriate existing lens route:

```text
RFx content            -> /exchange/rfx
Resource content       -> /exchange/resources
Intelligence content   -> /exchange/intelligence
Capability / AMACS     -> /exchange/capabilities
Teaming / referral     -> originating relevant lens
```

The current chassis does not yet accept an initial public search query as part of that handoff, so this implementation does not pretend to preserve unsupported search state. When the Exchange search contract gains an initial-query/deep-link input, contextual public CTAs can carry intent through authentication and onboarding.

## Shell integration

The public module reuses the existing Public / Acquisition visual primitives and design tokens:

- RFxchange public navigation
- Warm Ivory, Exchange Black, RF Gold, Signal Blue, and Growth Green
- existing button treatments
- public-shell responsive behavior
- Login and Register entry points

It does **not** import or recreate:

- persistent Exchange map
- bottom lens navigation
- sliding results drawer
- four-slot lens action rail
- Exchange record cards
- Exchange detail controller

Those remain exclusive to the authenticated operating chassis.

## Current implementation versus production target

### Implemented

- public library hub
- topic and audience learning paths
- featured content
- client-side public content search/filtering
- shared public content cards
- shared public content detail route
- related-content recommendations
- contextual Exchange lens CTAs
- public/API publishing contract
- responsive mobile/desktop composition
- deterministic reference catalog

### Future integration points

- CMS/editorial workflow
- publication states and versioning
- author and organization attribution
- SEO/structured-data enhancements
- asset/media storage
- campaign attribution
- public analytics
- server-backed search/indexing
- event registration
- downloadable file assets
- authentication-aware return-to-intent
- initial Exchange search/filter deep links

## Rule for future work

Public content should make RFxchange easier to understand and enter. It should not duplicate the transactional Exchange. If a feature changes live organization state, creates an Exchange record, saves/watches an Exchange record, responds, offers, requests, refers, connects, or otherwise performs authenticated Exchange work, it belongs behind the operating chassis rather than in Public Resources / Content.
