# RFxchange Public / Acquisition Shell — Marketing

The Marketing surface is the public narrative and conversion layer that plugs into the RFxchange operating chassis. It does **not** reuse the authenticated Exchange map/drawer navigation; it hands qualified visitors into Identity / Onboarding while preserving acquisition context.

## Source flow implemented

```text
Inbound acquisition
  ├─ Direct / organic search
  ├─ LinkedIn / social
  ├─ Email / outreach
  └─ Partner / referral / campaign
          ↓
Public Marketing `/`
  ├─ Campaign bar
  ├─ Header / navigation
  ├─ Hero
  ├─ Value proposition
  ├─ Problem
  ├─ How It Works
  ├─ AMACS
  ├─ AI + Network
  ├─ Differentiation
  ├─ Availability + Trust
  ├─ Audience
  ├─ Founding Membership CTA
  ├─ Final CTA
  └─ Footer / bottom matter
          ↓
Destinations + conversion
  ├─ /how-it-works
  ├─ /businesses
  ├─ /buyers
  ├─ /resource-providers
  ├─ /founding
  ├─ /about
  ├─ /image-credits
  ├─ /terms
  ├─ /privacy
  ├─ /platform-rules
  ├─ /accessibility
  ├─ /join   → /register
  └─ /signin → /login
```

## Chassis boundary

The three shells retain distinct jobs:

1. **Public / Acquisition** acquires, educates, segments, builds trust, and converts.
2. **Identity & Onboarding** establishes the user, organization, geography, profile, and capability context.
3. **Authenticated Exchange** runs the persistent map-first operating environment.

Marketing therefore uses traditional scrollable public-web composition. It does not introduce Exchange lens navigation, a results drawer, or product-specific application state.

## Acquisition context

`AcquisitionContextCapture` records first-touch context in browser `sessionStorage`. `ConversionLink` carries the active query parameters and stored context into `/join` or `/signin` without adding an analytics backend to this chassis.

Supported carryover fields:

- `utm_source`
- `utm_medium`
- `utm_campaign`
- `utm_content`
- `partner`
- `referral`
- `invitation`
- `opportunity`
- `geography`

The `/join` and `/signin` routes preserve the query string when redirecting to the existing `/register` and `/login` Identity routes.

This establishes the acquisition-to-identity contract. Production analytics, consent, durable attribution, and server-side registration persistence remain downstream integrations.

## Claims discipline

The marketing surface intentionally avoids promising leads, awards, revenue, ROI, qualification, or automated procurement decisions. Founding Membership is presented as an optional organization-level enhancement rather than a pay-to-rank or pay-to-verify mechanism.

## Public legal/support destinations

The source architecture requires Terms, Privacy, Platform Rules, Accessibility, and Image Credits destinations. TestRFx establishes the routes and public-shell navigation. Where production policy/legal content has not been supplied, the pages explicitly identify that boundary rather than inventing final legal language.

## Responsive behavior

- Desktop: sticky marketing header, wide narrative sections, paired visual/content compositions.
- Tablet: mobile navigation activates and complex grids collapse.
- Mobile: single-column sections, stacked CTAs, responsive campaign bar, native `<details>` navigation.
- Reduced motion: marketing animation/transition duration is minimized.

## Relationship to the Exchange

The hero visual intentionally echoes the authenticated map + search + action rail + drawer composition, but it is a marketing illustration only. The actual authenticated Exchange implementation remains under `/exchange` and is not duplicated here.
