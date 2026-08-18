# Identity & Onboarding Shell — Account Verification

## Purpose

Account Verification is the trust gate between creating RFxchange credentials and assigning those credentials organizational meaning. It proves that the person controlling an onboarding session also controls the account email address.

It does **not** establish organization ownership or membership, geography, map placement, capabilities, AMACS mappings, membership/payment status, or Exchange readiness.

The governing flow is:

```text
Registration
    ↓
Pending account
    ↓
Account Verification
    ↓
Verified account identity
    ↓
Onboarding router
    ↓
Organization selection / creation
    ↓
Geography
    ↓
Organization profile
    ↓
Capability enrichment
    ↓
Exchange-ready completion
```

This preserves the RFxchange operating-chassis dependency direction: Identity & Onboarding establishes the authenticated participant and organization context; the Authenticated Exchange consumes that context later.

## Route contract

The account-verification surface lives at:

```text
/onboarding/account-verification
```

Supported context query parameters are intentionally bounded hints, not authorization truth:

```text
email
source=registration|email_change|resend|invitation|referral|campaign
invitation
referral
campaign
returnTo
```

`returnTo` is accepted only for internal onboarding/Exchange paths and is preserved for later onboarding. Verification itself still routes a newly verified participant to the organization stage.

A registration or invitation implementation should hand off to this route after creating a pending account. The verification module must not create an organization or grant an invited role itself.

## UI states

The shared Identity & Onboarding shell renders these governed states:

```text
idle
  ↓
requesting
  ↓
pending ── resend / change email ──┐
  │                                │
  └──── verification link ─────────┘
             ↓
         verifying
        /    |     \
   verified expired invalid
       │        │      │
       ▼        └── request replacement
organization
onboarding
```

The page also has an explicit `configuration_error` state so production cannot silently fall back to a development token secret.

## API boundary

The reference application boundary is:

```text
POST /api/identity/account-verification
```

Request actions:

- `request` — issue a new verification challenge for a pending account email.
- `resend` — issue a replacement challenge after resend policy is satisfied.
- `change_email` — issue against the replacement email; production persistence must revoke/supersede outstanding challenges for the previous email.
- `verify` — validate a verification token and return the next onboarding path.

The current repository supplies a signed reference-token adapter so the UI/API contract can be exercised without coupling the chassis to an email vendor or authentication product. Outside production, the API returns a reference verification link instead of claiming that an email was actually delivered.

Production must replace the reference delivery path with a real delivery service and durable challenge repository.

## Token contract

Reference tokens are:

- single-purpose (`rfxchange-account-email-verification`),
- time bounded,
- HMAC signed,
- opaque to UI business logic,
- validated server-side,
- rejected when malformed, tampered with, expired, or not configured.

`ACCOUNT_VERIFICATION_SECRET` is required in production. The development fallback is deliberately unavailable when `NODE_ENV=production`.

The stateless reference adapter cannot guarantee one-time consumption by itself. One-time use, resend throttling, supersession, and revocation are persistence concerns and are represented by `db/identity-verification.sql`.

## Production persistence

`db/identity-verification.sql` extends the chassis data foundation with:

```text
users.email_verified_at
users.account_status
normalized unique email index
email_verification_challenges
```

Challenge state is explicitly modeled as:

```text
issued
consumed
expired
revoked
superseded
```

Production token handling should store only a cryptographic token hash, never the raw token. Consuming a token must be transactional: lock/resolve the issued challenge, verify it is unexpired and unsuperseded, set `consumed_at`, mark the account email verified, emit the audit event, and resolve the next onboarding step.

## Duplicate-account boundary

The registration source establishes one account per user email. Account Verification reinforces that contract through a normalized unique email index but does not decide account-merge behavior.

Expected upstream behavior:

```text
email submitted
    ↓
normalized account lookup
    ├── none → create pending account → verification
    ├── pending → resume verification
    ├── verified → sign in
    └── restricted → safe account-state response
```

## Invitation, referral, and campaign context

Verification preserves acquisition/onboarding context but treats it as untrusted until the responsible downstream service validates it again.

For example:

```text
Partner invitation
    ↓
Register
    ↓
Verify email
    ↓
Restore invitation identifier
    ↓
Organization onboarding validates invitation
    ↓
Role/membership may be established
```

Controlling an email address is never sufficient to grant an organization role.

## On success

Account Verification is complete when:

- the canonical user account exists,
- the primary account email is verified,
- the durable verification challenge is consumed in production,
- the account is not blocked from proceeding,
- authenticated onboarding context can be established,
- the onboarding router can resolve the next required step.

The default continuation in the current platform structure is **Organization selection / creation**. A returning participant should resume the actual incomplete onboarding stage rather than repeat completed work.

## Security and operational integration points

Production integrations belong behind the verification API contract:

- account repository / identity provider,
- challenge persistence and transaction handling,
- email delivery provider and templates,
- resend rate limiting and abuse protection,
- session establishment / rotation,
- security and audit events,
- onboarding-state service,
- invitation/referral validation,
- observability and delivery telemetry.

MFA remains a separate authentication concern. Email verification answers “does this participant control this account email?”; MFA answers “can this authenticated participant satisfy an additional factor?”

## Events

The eventual event vocabulary should include:

```text
AccountCreated
VerificationRequested
VerificationDeliveryQueued
VerificationResent
VerificationEmailChanged
VerificationFailed
VerificationExpired
EmailVerified
InvitationContextRestored
OnboardingResumed
```

Sensitive token values must never be written to analytics, audit logs, or observability payloads.

## Chassis rule

Account Verification is part of the **Identity & Onboarding Shell**, not an Exchange lens. It must not render the persistent map, result drawer, lens action rail, record cards, or bottom lens navigation. Its output is a verified identity state that later onboarding stages can safely attach to organization context before the user reaches the authenticated RFxchange Exchange.
