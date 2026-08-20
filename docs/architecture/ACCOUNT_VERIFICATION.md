# Identity & Onboarding Shell — Account Verification

## Purpose

Account Verification is the trust gate between RFxchange Registration and organization onboarding. It proves control of the account email address and consumes a server-side, single-use verification challenge.

It does **not** establish organization ownership or membership, geography, map placement, capabilities, AMACS mappings, commercial membership/payment status, or Exchange readiness.

```text
Registration
    ↓
Durable pending user + registration
    ↓
Account Verification
    ↓
Verified account email
    ↓
Organization Selection / Creation
    ↓
Geography
    ↓
Organization Profile
    ↓
Capability Enrichment
    ↓
Exchange-ready Completion
```

## Route contract

The account-verification surface lives at:

```text
/onboarding/account-verification
```

Registration supplies a durable `registration` identifier and preserves bounded downstream context. The concrete workflow modes are:

```text
?registration={id}
?registration={id}&mode=resend
?registration={id}&mode=change-email
?token={single-use-token}&registration={id}
```

A participant cannot start an arbitrary standalone verification by entering an email address. A durable Registration transaction must exist first.

## UI states

```text
registration status load
        ↓
     pending
     /     \
 resend   change email
    │          │
    └────┬─────┘
         ↓
 delivered email
         ↓
 verification link
         ↓
      verifying
      /   |    \
verified expired invalid
   │        │      │
   ▼        └── resend replacement
organization
onboarding
```

The surface also distinguishes `rate_limited`, `delivery_error`, and `configuration_error`. It never displays a development-only verification URL or reports an email as sent merely because a token was generated.

## API boundary

```text
POST /api/identity/account-verification
```

Actions:

- `request` — issue a challenge for an existing pending Registration transaction.
- `resend` — apply cooldown policy, supersede the prior live challenge, and deliver a new link.
- `change_email` — re-run normalized-email uniqueness, update the pending identity, supersede prior challenges, and deliver a new link.
- `verify` — hash the presented token, resolve the issued database challenge, enforce expiry/state, consume it transactionally, and mark the account email verified.

Registration also exposes:

```text
GET /api/identity/registration/{registrationId}
```

so the Account Verification surface can resolve the durable pending state without putting the raw email in the browser URL.

## Token and challenge contract

The previous signed reference-token adapter and development fallback secret have been removed.

The runtime now generates a cryptographically random 32-byte token using Node's `crypto.randomBytes()`. Only `SHA-256(token)` is stored in `email_verification_challenges`. The raw token exists only long enough to construct the delivered verification URL.

Challenge state remains:

## No reference-token fallback

The server:

1. marks stale issued challenges expired;
2. enforces a resend cooldown;
3. supersedes prior live challenges before issuing a replacement;
4. stores the challenge hash, expiry, registration/user association, request metadata, and bounded onboarding context;
5. revokes the newly issued challenge if transactional email delivery fails;
6. consumes a valid issued challenge under a database transaction;
7. rejects consumed, superseded, revoked, expired, missing, or unknown tokens.

## Email delivery

Verification delivery uses the configured transactional identity-email transport:

- `IDENTITY_EMAIL_DELIVERY_URL`
- `IDENTITY_EMAIL_FROM`
- optional `IDENTITY_EMAIL_DELIVERY_TOKEN`
- `RFXCHANGE_APP_URL` for the public verification-link origin

RFxchange POSTs `{ messageType, from, to, subject, text, html }` to that transport. Delivery is recorded as `sent` only when the transport returns a successful HTTP response. Failed transport attempts are recorded and the corresponding challenge is revoked.

This keeps email infrastructure replaceable without retaining a mocked “reference delivery” path.

## Persistence

Apply:

```text
db/schema.sql
db/identity-verification.sql
db/registration-runtime.sql
```

The combined model provides:

```text
users.email_verified_at
users.account_status
normalized unique email index
registration_transactions
email_verification_challenges
identity_email_deliveries
activity_events
```

Verification completion updates both the canonical user account and the Registration transaction in the same server-side flow.

## Duplicate-account and change-email boundary

Registration enforces one normalized email identity. Account Verification repeats that protection when a participant changes the pending email:

```text
new email
   ↓
normalized lookup
   ├── belongs to another identity → reject
   └── available → update pending identity → issue replacement challenge
```

Organization invitation or referral context never bypasses this identity rule.

## Invitation, referral, campaign, and downstream context

Verification preserves:

```text
source
campaign
invitation
referral
organization intent
membership intent
geography intent
requested record
returnTo
```

These remain hints/continuity state. Controlling an email is not sufficient to grant an organization role, establish geography, activate a paid membership, or authorize a record.

On successful verification the server builds the canonical handoff to `/onboarding/organization`, where Organization Selection / Creation validates its own authority and membership inputs.

## Security and operational behavior

- raw verification tokens are never persisted;
- tokens are single-use and time bounded;
- resend requests are rate limited;
- prior live tokens are superseded on replacement;
- failed email sends revoke the generated challenge;
- normalized email uniqueness is enforced server-side;
- request IP/user-agent may be recorded for security/audit use;
- verification state is never trusted from client-side UI;
- external auth-entry return URLs are not accepted;
- sensitive token values must never be written to analytics or activity payloads.

Production deployments should additionally apply network-layer abuse controls, monitoring, database backups, email-provider telemetry, secret management, and authenticated session establishment after verification. Those are infrastructure concerns, not reasons to reintroduce a simulated verification path.

## Events

The connected implementation emits registration/identity activity events including:

```text
RegistrationCreated
RegistrationResumed
RegistrationExistingIdentityDetected
RegistrationVerificationSent
RegistrationEmailVerified
```

Additional provider-level delivery/bounce events can be joined through the transactional email transport without changing the Registration or Account Verification UI contracts.

## Chassis rule

Account Verification remains part of the **Identity & Onboarding Shell**. It never mounts the persistent Exchange map, drawer, action rail, cards, or bottom lens navigation. Its output is a verified person identity that later onboarding modules can attach to organization and participation context.
