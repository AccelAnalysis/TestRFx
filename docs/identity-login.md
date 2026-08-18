# Identity & Onboarding Shell — Login

Login is the bounded identity gateway between RFxchange acquisition surfaces and authenticated Exchange activity. It authenticates a returning participant, preserves the requested internal destination, establishes the provider/session boundary, and hands authenticated context to the onboarding-readiness resolver.

## Chassis contract

The Login subsystem owns:

- login entry and safe `returnTo` intent preservation;
- email normalization and passwordless challenge request UX;
- magic-link provider boundary and approximately 15-minute challenge lifetime;
- resend/change-email/error states;
- MFA/device/session integration points;
- authenticated-readiness routing into Account Verification, Organization, Geography, Organization Profile, Capability enrichment, Membership access, or the Exchange.

It does **not** own organization creation, geography editing, capability enrichment, membership checkout, or Exchange business logic.

## Flow

```text
Public / protected entry
        ↓
/login?returnTo=/exchange/...
        ↓
Email challenge request
        ↓
Identity provider sends one-time magic link
        ↓
Provider verifies link + optional MFA/device policy
        ↓
Session + active organization context
        ↓
resolvePostLoginDestination(...)
        ↓
Remaining onboarding step OR preserved Exchange destination
```

## Reference implementation boundary

`lib/identity/gateway.ts` currently uses a `ReferenceIdentityGateway`. It deliberately **does not send email, verify a magic-link token, or create an authenticated session**. The UI labels this condition rather than pretending authentication succeeded.

Before production access is enabled, replace that adapter with the selected identity provider and ensure the provider callback:

1. verifies a single-use, expiring challenge server-side;
2. performs MFA/device policy where required;
3. establishes a secure server-side session;
4. loads user, organization membership, role, and permissions;
5. builds an `IdentityReadinessSnapshot`;
6. calls `resolvePostLoginDestination` with the preserved safe `returnTo` value.

Do not authorize Exchange access from client-visible flags alone.

## Security invariants

- `returnTo` only accepts internal `/exchange` and `/onboarding` destinations; external/open redirects fall back to `/exchange`.
- Login responses must not disclose whether an email belongs to an account.
- Magic-link tokens must be hashed at rest, short-lived, and single-use.
- Sessions must be revocable and carry active-organization context separately from the participant identity.
- Authentication proves identity; authorization and Exchange readiness are separate server-side decisions.

## Persistence target

The reference PostgreSQL schema includes `auth_identities`, `auth_challenges`, and `auth_sessions` alongside `users` and `organization_memberships`. These are persistence contracts, not a claim that the current reference gateway writes to them yet.
