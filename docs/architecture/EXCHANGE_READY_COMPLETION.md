# Exchange-ready Completion

## Purpose

Exchange-ready Completion is the controlled Step 9 → Step 10 handoff from Identity & Onboarding into the existing authenticated Exchange. It does not create a second Exchange shell and it does not maintain a parallel onboarding truth store.

## Canonical readiness sources

Readiness is re-derived server-side from the same persisted records owned by the current onboarding domains:

- account verification: `users.email_verified_at`
- organization and affiliation: `organizations` + `organization_memberships`
- geography and map presence: `organization_geographies`, `geographies`, and `locations`
- organization profile and visibility: `organization_profiles`
- capability minimum, AMACS mapping, evidence, and discoverability enrichment: `organization_capability_claims`, `organization_capability_evidence`, and `organization_capability_profiles`
- participation entitlement: `organization_plan_memberships` + `membership_plans`

There is deliberately no cookie-backed or client-owned readiness source of truth.

## Required vs progressive

Account verification, canonical organization/affiliation, primary geography, completed organization profile, at least one capability claim, explicit visibility, and an active participation entitlement block activation when incomplete.

AMACS depth, evidence/certifications, keywords, tags, and specialties are progressive enrichment. They affect profile-completeness reporting but do not become artificial Exchange-entry gates.

## Geography and map presence

A primary Exchange geography is required. A public point coordinate is not. An organization with a valid primary geography but no publishable point remains a truthful `off_map` Exchange presence rather than receiving a fabricated coordinate.

## Activation

`POST /api/onboarding/readiness/activate` re-evaluates readiness from canonical records. Only a fully ready active organization can activate. The transaction stores an audit snapshot in `onboarding_exchange_activations` and emits `OnboardingCompleted` into the shared activity stream.

The activation table records the handoff; it does not replace the canonical domain records used to derive readiness.

## Route hierarchy

1. `/onboarding/completion` — authoritative readiness review with direct remediation links.
2. `/onboarding/completion/activate` — explicit activation review and confirmation.
3. `/onboarding/completion/success` — Step 10 confirmation backed by a persisted activation record.
4. `/exchange/...` — handoff into the existing map-first Exchange shell.

A safe `returnTo` may restore `/exchange` or one of the four existing Exchange lenses. Unsupported or external destinations fall back to `/exchange`.

## Membership / entitlement rule

Membership payment never substitutes for identity, organization authority, profile truth, or capability truth. Completion asks only whether the active organization currently has a valid RFxchange participation entitlement according to the canonical membership service.

## Boundaries

Readiness is not authorization. Every Exchange page and durable mutation must continue to enforce the authenticated user, active organization, role/membership, and service-specific authorization boundary independently of onboarding completion.

Static preview builds may render the route structure, but they must not fabricate authenticated readiness or activation success when runtime database/session services are unavailable.
