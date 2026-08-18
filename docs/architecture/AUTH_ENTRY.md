# Public Login / Register Entry

The Public / Acquisition Shell owns the gateway into RFxchange identity. It does not own authentication itself.

This boundary exists so Marketing, campaign landing pages, public resources, pricing/membership, partner links, invitations, notifications, QR/event links, and protected-record deep links can all enter the same Identity & Onboarding Shell without losing why the visitor arrived.

## Governing flow

```text
Public / Acquisition Shell
        |
        +-- explicit Sign In --> /signin --> /login
        |
        +-- explicit Join -----> /join ---> /register
        |
        +-- ambiguous entry ---> /auth
                                  |-- Sign In --> /login
                                  +-- Join Free -> /register

Identity & Onboarding Shell
        |
        +-- Login
        +-- Registration
        +-- Verification (production integration)
        +-- Organization
        +-- Geography
        +-- Profile
        +-- Capabilities
        +-- Exchange-ready completion
        |
        +--> requested internal destination or /exchange
```

Explicit intent is preserved. A visitor who selects Sign In is not forced through a second "login or register" choice, and a visitor who selects Join is not forced through a chooser. `/auth` exists for entry sources that genuinely do not know the intended identity action.

## Routes

- `/signin` — public sign-in entry. Normalizes and validates incoming context, then hands off to `/login`.
- `/join` — public registration entry. Normalizes and validates incoming context, then hands off to `/register`.
- `/auth` — neutral public chooser for ambiguous entry sources.
- `/login` — Identity shell reference boundary.
- `/register` — Identity shell reference boundary.
- `/onboarding` — guided organization/context completion boundary.

The current Marketing surface routes its login and registration CTAs through `/signin` and `/join` and tags the source/campaign so the acquisition journey remains measurable.

## Context contract

`lib/acquisition/auth-entry.ts` defines the shared handoff context:

```text
returnTo       safe internal destination after identity/onboarding
source         acquisition source
campaign       campaign or placement identifier
referral       referral context
invitation     invitation token/context
organization   organization context
membership     membership intent
geography      geographic context
record         deep-linked record identifier/context
```

The same contract is preserved when the user crosses between Login and Registration and when Registration continues into Onboarding.

### Safe return destinations

`returnTo` only accepts root-relative RFxchange paths. Protocol-relative/external destinations and authentication-entry loops are rejected. Production auth should continue to enforce destination authorization after session resolution; this helper only prevents the public gateway from becoming an open redirect.

## Session-aware routing integration

The current chassis does not include production authentication, so `/signin` and `/join` cannot yet resolve a real authenticated session. When Identity is connected, the entry router should resolve session/account state before rendering authentication:

```text
authenticated?
  |
  +-- no --> requested Login / Registration flow
  |
  +-- yes
       |
       +-- Exchange ready ------> returnTo or /exchange
       +-- onboarding incomplete -> resume onboarding
       +-- invitation pending ----> invitation acceptance
       +-- account action needed -> account-resolution flow
```

This session decision belongs behind the same entry contract; product/campaign pages should not implement it themselves.

## Authentication-method boundary

The source material contains both password-oriented Registration language and a magic-link-oriented Login flow. The Public / Acquisition gateway therefore does not hard-code an authentication method. Passwords, magic links, MFA, passkeys, enterprise identity, verification, and recovery are Identity-shell integrations.

## Invitation and referral behavior

Invitations and referrals are first-class entry contexts. Their tokens/context survive the public-to-identity handoff and should eventually be validated by dedicated server-side services. The public chooser intentionally does not display raw invitation values; it only indicates that invitation context is retained.

A production invitation flow can branch after identity resolution:

```text
invitation
   |
validate token
   |
account exists?
   |-- yes --> sign in
   +-- no ---> register
                |
          accept invitation
                |
        join organization
                |
      resolve remaining onboarding
```

## Deep-link continuity

A notification or shared link may request a specific Exchange record, for example `/exchange/rfx/rfx-001`. The correct behavior is:

```text
requested record
   -> auth entry
   -> identity
   -> onboarding if required
   -> requested record
```

The user should not be dropped on a generic Exchange home screen and required to find the record again.

## Acquisition measurement

The public entry contract retains `source` and `campaign` so production analytics can connect acquisition to actual Exchange activation rather than stopping at a button click. A mature funnel can measure:

```text
source/campaign
  -> auth entry
  -> registration started
  -> verification
  -> organization linked
  -> geography/profile/capabilities
  -> Exchange ready
  -> first value event
```

## Intentional boundaries

This module does not implement:

- authentication/session persistence;
- email or magic-link delivery;
- password validation;
- MFA/passkeys;
- account lookup;
- invitation/referral server validation;
- organization authorization;
- membership checkout;
- analytics persistence;
- protected-route enforcement.

Those services plug into the stable entry/context contract. The Public / Acquisition Shell owns getting the visitor to the correct identity door without losing context; the Identity & Onboarding Shell owns establishing who they are and whether they are Exchange ready.
