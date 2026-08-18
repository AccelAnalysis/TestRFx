# Identity & Onboarding Shell — Account Verification

## Review result

The first Account Verification build established the correct trust boundary, but it flattened the source flow into one component and still depended on two reference behaviors:

1. a stateless HMAC token that could not enforce one-time consumption, revocation, supersession, or resend policy; and
2. a development-only “reference verification link” rendered in the UI instead of an actual email-delivery service.

The source material defines a deeper but deliberately small hierarchy. This revision implements that hierarchy exactly and does not add speculative menu destinations.

## Source-derived hierarchy

```text
Account Verification
└── Verify Email / Access
    ├── Send Verification Email
    ├── Verification Link
    ├── Resend Verification
    └── Change Email Address
```

These nodes come directly from the Registration and Onboarding source flow: verification email is sent, the participant opens the verification link, an Email Verified? decision is made, and a failed/not-complete path allows resend or email change before returning to verification.

The source also identifies Email Communications, Security & Privacy, and Duplicate Detection. Those are supporting services, not navigation nodes, so this implementation keeps them behind the workflow rather than inventing additional submenu items.

## Addressable nested state

The hierarchy has real routes:

```text
/onboarding/account-verification
/onboarding/account-verification/verify-email-access
/onboarding/account-verification/verify-email-access/send
/onboarding/account-verification/verify-email-access/verification-link
/onboarding/account-verification/verify-email-access/resend
/onboarding/account-verification/verify-email-access/change-email
```

`lib/identity/account-verification-navigation.ts` is the canonical recursive tree. The UI renders breadcrumbs and the nested tree from that contract, so browser Back/Forward and deep links preserve workflow depth instead of hiding it in one transient component state.

## Trust boundary

Account Verification answers one question:

> Does the participant control the email address attached to this RFxchange account?

It does **not** establish organization ownership or membership, geography, map placement, capabilities, AMACS mappings, commercial membership/payment status, or Exchange readiness.

The governed progression remains:

```text
Registration
    ↓
Persisted pending account + HttpOnly onboarding session
    ↓
Account Verification
    ↓
Verified account identity
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

Successful verification now hands directly to `/onboarding/organization`, the existing Organization Selection / Creation workflow, rather than a generic onboarding placeholder.

## Real runtime services

The server-capable TestRFx runtime no longer returns a local verification link or simulates delivery success.

### Pending-account repository

Registration creates or resumes one persisted pending account per normalized email through `lib/identity/account-verification-store.ts`.

The runtime repository stores:

- pending account identity and registration ID;
- verified/account lifecycle state;
- bounded acquisition/invitation/referral context;
- verification challenges;
- HttpOnly onboarding-session hashes;
- verification/security events.

`RFXCHANGE_DATA_DIR` selects the writable data location. Development defaults to `.data`; production refuses to claim durable identity persistence unless `RFXCHANGE_DATA_DIR` is explicitly configured.

The runtime store writes atomically through a temporary file + rename and serializes in-process mutations. It is appropriate for the current server-capable single-runtime TestRFx deployment model. `db/identity-verification.sql` remains the normalized PostgreSQL target for multi-instance production deployment.

### Duplicate detection

The account repository enforces the source business rule **one account per user email** using normalized email identity:

```text
email submitted
    ├── no account → create pending account
    ├── pending account → resume the same registration
    ├── verified/onboarding account → sign-in response
    └── restricted account → safe denial
```

Changing a pending email performs the same duplicate check before updating the account.

### Onboarding session

Registration issues an opaque onboarding-session token in an HttpOnly, SameSite=Lax cookie. Only a SHA-256 hash is persisted.

The session is required for:

- reading the pending account state;
- first-send verification;
- changing the account email.

A valid email verification token can establish/rotate the onboarding session on another device, which supports the common registration-on-one-device / email-opened-on-another-device case.

### One-time verification challenge

Verification challenges use opaque random tokens. The raw token exists only in the outgoing email URL; persistence stores only its SHA-256 hash.

The lifecycle is:

```text
issued
  ├── consumed
  ├── expired
  ├── revoked
  └── superseded
```

A replacement challenge supersedes previous issued challenges. Email change also invalidates earlier links. Consuming a valid challenge marks the email verified, moves the account into onboarding state, rotates the onboarding session, and invalidates other active challenges.

### Resend throttling

Resend is enforced by the repository, not by a disabled client button. `ACCOUNT_VERIFICATION_RESEND_COOLDOWN_SECONDS` controls the server-side cooldown (default 60 seconds). The API returns HTTP 429 plus `Retry-After` when the participant must wait.

An expired verification link may request a replacement by its high-entropy registration reference even when it was opened on a different device; resend remains rate-limited and cannot change the account email without the onboarding session.

## Transactional email service

`lib/identity/account-verification-mailer.ts` is an actual HTTP delivery adapter, not a reference-success adapter.

Required configuration:

```text
RFXCHANGE_EMAIL_DELIVERY_URL
RFXCHANGE_EMAIL_FROM
RFXCHANGE_APP_ORIGIN
```

Optional bearer credential:

```text
RFXCHANGE_EMAIL_DELIVERY_TOKEN
```

The configured endpoint receives JSON shaped as:

```json
{
  "from": "RFxchange <verified-sender@example.com>",
  "to": "participant@example.com",
  "subject": "Verify your RFxchange email",
  "text": "...",
  "html": "...",
  "tags": {
    "product": "RFxchange",
    "messageType": "account_verification"
  }
}
```

The adapter requires a 2xx response after the provider accepts the message. If delivery is unconfigured or fails, the API returns a real service/configuration error and the issued challenge is revoked. The UI never displays a local token or reports a fake successful email send.

After durable verification, RFxchange attempts a confirmation email. Confirmation-delivery failure is recorded but never rolls back the already completed identity proof.

## API contract

The application boundary remains:

```text
GET  /api/identity/account-verification?registration={id}
POST /api/identity/account-verification
```

`GET` resolves the pending/verified state for the current onboarding session.

`POST` actions are:

- `send` — send the first one-time verification email for the pending account;
- `resend` — supersede the previous challenge and send a replacement subject to server throttling;
- `change_email` — validate the onboarding session, enforce duplicate detection, change the pending email, revoke previous links, and send to the replacement address;
- `verify` — consume a one-time token, verify the account email, establish/rotate onboarding session state, and resolve the Organization Selection / Creation continuation.

`request` remains accepted as a backwards-compatible alias for `send`; it is not a separate workflow node.

## Registration integration

The Registration API now uses the same runtime identity repository instead of generating a disposable `reg_*` ID with no backing account.

Registration returns a concrete handoff to:

```text
/onboarding/account-verification/verify-email-access/send
```

and carries the persisted registration ID. A repeated registration attempt for the same pending email resumes the pending account; a verified email is directed toward sign-in semantics rather than silently creating a duplicate identity.

Acquisition, invitation, referral, organization, membership, geography, record, and internal return context remain bounded routing/onboarding intent. Verification stores and carries them, but no value becomes organization authority merely because the email was verified.

## Security behavior

The verification subsystem enforces:

- normalized unique account email;
- cryptographically random opaque tokens;
- token hashes at rest;
- time-bounded challenges;
- one-time consumption;
- challenge supersession and revocation;
- email-change invalidation;
- server-side resend throttling;
- HttpOnly onboarding-session cookies;
- no-store API responses;
- internal-only downstream return paths;
- bounded request metadata;
- security/activity events without raw token values.

MFA remains separate. Email verification proves control of the account email; MFA is an additional authentication factor and must not be folded into this hierarchy.

## Persistence target

`db/identity-verification.sql` now models:

```text
users.registration_id
users.email_verified_at
users.account_status
normalized unique email
identity_onboarding_sessions
email_verification_challenges
  ├── state
  ├── reason
  ├── delivery_state
  ├── delivered_at
  ├── consumed_at
  ├── revoked_at / revoked_reason
  └── supersession
```

A production PostgreSQL adapter should perform challenge issuance/consumption and account-state updates transactionally. The runtime file repository and PostgreSQL adapter must preserve the same service contract so the UI does not change when persistence is promoted.

## Static Pages preview boundary

GitHub Pages remains a static visual preview. Its build intentionally removes `app/api`, so it cannot create accounts, send transactional email, consume tokens, or persist authenticated sessions. The nested hierarchy still renders statically because the catch-all workflow route publishes explicit static params.

The preview must not replace those unavailable server operations with mocked success.

## Chassis rule

Account Verification stays inside the **Identity & Onboarding Shell**. It never mounts the persistent Exchange map, Universal Search, sliding results drawer, lens action rail, record cards, or bottom lens navigation.

The output is a verified person-level account identity. Organization Selection / Creation is the first downstream workflow allowed to give that identity organizational meaning.
