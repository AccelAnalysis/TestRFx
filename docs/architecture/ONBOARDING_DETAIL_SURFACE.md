# Identity & Onboarding Detail Surface

## Purpose

The Identity & Onboarding Detail Surface is the reusable review/edit/resolve workspace for information established before a participant enters the authenticated Exchange. It is **not** the authenticated Exchange record-detail controller: it does not mount the persistent map, Exchange result drawer, lens action rail, or bottom lens navigation.

Its job is to answer one question consistently across onboarding:

> What does RFxchange currently know about this onboarding subject, what is missing or uncertain, what can the participant change here, and where should the flow return afterward?

## Chassis boundary

The surface owns:

- focused Identity/Onboarding chrome and responsive composition;
- subject/mode/status vocabulary;
- required vs. optional semantics;
- completion/issue summary presentation;
- contextual education (what, why, visibility, next);
- reusable field rendering for reference implementations;
- Back / Save & exit / Continue action positions;
- safe internal `returnTo` and `next` continuity;
- a browser-session reference draft used only to demonstrate leave/resume behavior;
- a normalized `GET /api/onboarding/detail` reference contract.

The surface does **not** own:

- identity/session persistence or verification challenges;
- canonical organization/entity resolution;
- organization claim/authority decisions;
- geocoding, geography rollout policy, or PostGIS persistence;
- Organization Profile persistence;
- AMACS taxonomy inference or confirmation repositories;
- evidence/object storage or substantive verification;
- Stripe checkout, billing, Founding capacity, or entitlements;
- final Exchange-readiness policy/activation;
- authenticated Exchange map/detail state.

Those remain domain/service responsibilities. The Detail Surface consumes a normalized definition and lets those modules keep their canonical truth.

## Supported subjects

The reference registry exposes ten reusable subject shapes:

1. `account` — person-level identity and required acknowledgements;
2. `organization` — canonical organization resolution and duplicate avoidance;
3. `authority` — organization membership/administrative authority;
4. `geography` — primary locality, base location, public precision, and service geography;
5. `profile` — Exchange-facing organization identity and visibility;
6. `capability` — plain-language capability claim plus AMACS/evidence state;
7. `evidence` — optional evidence/credential provenance without overstating verification;
8. `role-goals` — multi-role participation and first-value goals;
9. `membership` — optional commercial participation separated from credibility/readiness;
10. `readiness` — final blocking vs. progressive-enrichment review.

These are presentation contracts, not ten new canonical data models.

## Status vocabulary

The governed surface status vocabulary is:

- `complete`
- `needs-action`
- `needs-confirmation`
- `pending`
- `optional`
- `blocked`
- `not-applicable`

This intentionally avoids a single vague percentage as the governing readiness signal. Domain modules should communicate which items are blocking and which are progressive enrichment.

## Modes

The same surface supports `view`, `edit`, `review`, `resolve`, `confirm`, and `verify` modes. The current reference definitions use those modes as semantic metadata; production domain adapters can use them to control available fields/actions without changing the shell.

## Continuity contract

The detail route is:

```text
/onboarding/detail/[subject]?returnTo=/onboarding/...&next=/onboarding/...
```

Only internal paths are accepted. Protocol-relative/external values fall back to the subject's governed defaults.

Opening a detail from organization resolution, geography, profile, capability enrichment, invitation/authority, membership, or completion should return to the exact caller rather than resetting onboarding. A production onboarding-state repository should additionally preserve stage, scroll/focus, selected organization/geography/capability, acquisition/invitation context, and intended post-onboarding destination.

## Persistence rule

The reference client writes edited values to `sessionStorage` solely to demonstrate Save & exit / resume continuity. That state is disposable and must never be interpreted as canonical persistence, authorization, verification, payment, or readiness truth.

Production modules should persist through their own server-side repositories and supply a fresh normalized detail definition after save/validation.

## Integration with parallel onboarding modules

This slice is deliberately additive so the current parallel branches can converge without route ownership conflicts:

- Organization Selection / Creation can open `organization` and `authority` detail.
- Geography can open `geography` detail.
- Organization Profile can render or deep-link to `profile` detail.
- Capability Enrichment can reuse `capability` and `evidence` detail.
- Pricing/Membership can reuse `membership` detail.
- Exchange-ready Completion can open any blocking subject and `readiness` detail.

Those modules should not copy the surface mechanics. They should provide canonical values, validation results, actions, and return/next context.

## Handoff to the authenticated Exchange

The onboarding surface populates the same canonical organization truth later used by the authenticated Exchange. It must not create a temporary second organization/profile/capability identity. Once readiness policy activates the organization, the participant enters the existing Exchange shell; ongoing organization management later occurs through Menu/Capabilities using the same underlying records.

## Production extension points

A production adapter should replace the deterministic reference registry with a server-composed read model based on authenticated user, active organization, authority, readiness, validation issues, and domain data. Save/resolve commands should remain server-authorized and auditable. The UI contract can stay stable while identity, organization, PostGIS, AMACS, evidence storage, billing, and readiness services mature behind it.
