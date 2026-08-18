# Public / Acquisition Shell — Campaign Landing Pages

## Architectural rule

Campaign landing pages are acquisition-specific presentations of RFxchange. They are **not** independent applications, alternate identity systems, or alternate Exchanges.

A campaign can change the message, audience, geography, partner context, offer, and intended first Exchange lens. It must not silently create canonical organization, geography, capability, membership, financial, or authorization truth.

## Runtime shape

```text
Traffic source
  ↓
/campaign/{slug}
  ↓
Governed CampaignDefinition
  ↓
Shared CampaignLandingPage renderer
  ↓
/register + validated campaign context
  ↓
/onboarding + campaign context
  ↓
/exchange/{rfx|resources|intelligence|capabilities}
```

The authenticated destination is always one of the existing RFxchange lenses. Campaigns do not add bottom-navigation items or alter Exchange composition.

## Campaign registry

`lib/public/campaigns.ts` owns the acquisition contract and reference campaign definitions. A campaign contains:

- lifecycle status and family;
- audience and optional geography/partner/offer context;
- hero and problem framing;
- proof points, benefits, guided steps, and FAQ content;
- primary and secondary conversion labels;
- one validated `ExchangeLens` as its intended post-onboarding destination.

The reference build includes membership, geography, RFx use-case, capability, resource-provider, and partner campaigns. New campaigns should normally be added as definitions rather than creating new one-off page architectures.

## Shared page composition

`components/public/campaign-landing-page.tsx` owns the reusable campaign composition:

1. minimal public navigation;
2. campaign-specific hero and context card;
3. problem/opportunity framing;
4. proof points;
5. How It Works;
6. operating-chassis preview;
7. benefits;
8. FAQ / trust guardrails;
9. final conversion CTA;
10. public footer.

Campaign-specific presentation is styled by `app/campaign/campaign.css` and remains responsive without importing authenticated Exchange UI components.

## Attribution and handoff

The reference implementation preserves a bounded set of acquisition parameters through registration and onboarding:

- `campaign`
- `source`
- `medium`
- `partner`
- `geography`
- `lens`
- `offer`
- `utm_source`
- `utm_medium`
- `utm_campaign`
- `utm_content`
- `ref`

The `lens` value is allow-listed to the four governed Exchange lenses before it is reused. Campaign definitions also type their intended destination as `ExchangeLens`.

In this reference chassis, context is carried in the URL so the contract can be exercised without infrastructure. Production should persist first-touch/last-touch attribution server-side and associate it with the authenticated user/organization conversion lifecycle.

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

## Conversion measurement target

Production analytics should follow the journey past the landing page:

```text
Landing view
  → CTA
  → Registration start
  → Account created
  → Verification
  → Organization established
  → Geography established
  → Profile/capabilities enriched
  → Exchange-ready completion
  → Intended lens entered
  → First campaign-relevant Exchange action
```

For RFxchange, Exchange-ready completion and first meaningful Exchange action are stronger acquisition outcomes than raw account creation alone.

## Extension contract

Future campaign systems can replace the in-code registry with a CMS, database, experiment service, partner-management service, or campaign API as long as they continue producing the same governed campaign definition and handoff behavior.

The dependency direction remains:

```text
Campaign source / CMS / partner config
            ↓
    CampaignDefinition
            ↓
 Public Acquisition renderer
            ↓
 Identity & Onboarding
            ↓
 Existing Exchange chassis
```
