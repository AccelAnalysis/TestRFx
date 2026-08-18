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

A Registration or invitation implementation should hand off to this route after a real pending account exists. The verification module must not create an organization or grant an invited role itself.

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

The page also has an explicit `configuration_error` state. A missing production provider is shown as unavailable; the application does not create a local verification success path.

## API boundary

The application boundary is:

```text
POST /api/identity/account-verification
```

Request actions:

- `request` — request a verification challenge for a pending account email.
- `resend` — request a replacement challenge.
- `change_email` — request against a corrected/replacement account email.
- `verify` — validate the provider token and return the next onboarding path.

The route delegates challenge creation, delivery, validation, expiration, and consumption to the configured Identity verification provider.

Environment contract:

```text
RFXCHANGE_IDENTITY_VERIFICATION_ENDPOINT
RFXCHANGE_IDENTITY_VERIFICATION_TOKEN        optional provider credential
```

Provider endpoints must use HTTPS in production.

## No reference-token fallback

The former non-production HMAC reference token and exposed reference verification URL have been removed.

TestRFx therefore does not claim:

- that an email was delivered when no provider accepted the request;
- that a challenge was consumed when no provider validated it;
- that a locally generated token is equivalent to production verification persistence.

If the verification provider is not configured, the API returns `configuration_error` and the UI keeps the participant outside the verified state.

## Provider expectations

The provider behind `RFXCHANGE_IDENTITY_VERIFICATION_ENDPOINT` is expected to enforce the security properties represented by the chassis contract:

- single-purpose verification challenges;
- bounded expiration;
- one-time consumption;
- resend throttling;
- supersession/revocation when email changes;
- secure token storage/validation;
- account-state checks;
- audit/security events;
- no sensitive token logging.

`db/identity-verification.sql` remains the canonical relational model if RFxchange owns that persistence directly; an external Identity provider may instead own equivalent durable state. The API contract is intentionally provider-neutral.

## Duplicate-account boundary

The Registration source establishes one account per user email. Account Verification reinforces that contract but does not decide account-merge behavior.

Expected upstream behavior remains:

```text
email submitted
    ↓
normalized account lookup
    ├── none → create pending account → verification
    ├── pending → resume verification
    ├── verified → sign in
    └── restricted → safe account-state response
```

The registration provider, not this UI, is responsible for durable duplicate-account enforcement.

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

The supplied Onboarding source explicitly defines `Validate Invitation → Accept / Join Organization → Set Role / Confirm Access`. Those states are represented in the public Login/Register hierarchy, but no dedicated invitation service exists in TestRFx yet; the application does not simulate successful invitation acceptance.

## On success

Account Verification is complete only when the configured verification provider returns a verified state and the onboarding router can continue safely.

The default continuation in the current platform structure is **Organization selection / creation**. A returning participant should resume the actual incomplete onboarding stage rather than repeat completed work.

## Security and operational integration points

The verification provider/API boundary owns or integrates:

- pending account / identity repository;
- challenge persistence and transactional consumption;
- email delivery provider and templates;
- resend rate limiting and abuse protection;
- account status;
- security/audit events;
- onboarding-state service;
- delivery telemetry.

Invitation/referral validation remains downstream. MFA remains a separate Login authentication concern. Email verification answers “does this participant control this account email?”; MFA answers “can this authenticated participant satisfy an additional factor?”

## Chassis rule

Account Verification is part of the **Identity & Onboarding Shell**, not an Exchange lens. It must not render the persistent map, result drawer, lens action rail, record cards, or bottom lens navigation. Its output is a verified identity state that later onboarding stages can safely attach to organization context before the user reaches the authenticated RFxchange Exchange.
