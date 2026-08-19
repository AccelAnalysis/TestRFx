# Identity & Onboarding Shell — Registration

Registration is the bounded RFxchange person-identity workflow. It preserves how a participant arrived, captures and resolves the account identity, records policy acceptance, creates or resumes the durable pending registration, initiates Account Verification, and then hands the verified participant to the next onboarding owner.

Registration does **not** create organization authority, canonical geography, Organization Profile content, capabilities, commercial membership, or Exchange authorization. Those remain separate sibling modules in the RFxchange Operating Chassis.

## Source-derived hierarchy

The Registration and Onboarding source diagrams support the following Registration-owned child and grandchild tree:

```text
Registration
├── Entry context
│   ├── Website / landing page
│   ├── Campaign / referral link
│   ├── Partner / invitation
│   └── QR code / event / promo
│
├── Create account
│   ├── Name
│   ├── Email address
│   ├── Authentication method
│   ├── Security & privacy
│   └── Review & create
│
├── Identity resolution
│   ├── New account
│   ├── Existing account → Login
│   └── Pending verification → Resume verification
│
└── Verify email / access
    ├── Send verification
    ├── Verification link → Account Verification
    ├── Resend verification → Account Verification
    └── Change email address → Account Verification
```

The remainder of the original Registration flow belongs to later modules and is therefore represented by handoff, not duplicated submenu branches:

```text
Account Verification
  ↓
Organization Selection / Creation
  ↓
Geography
  ↓
Organization Profile
  ↓
Capability Enrichment
  ↓
conditional Membership / Payment
  ↓
Exchange-ready Completion
```

## Password / authentication-source reconciliation

The Registration diagram includes **Create password**. The Login source defines secure passwordless magic-link authentication, while the Onboarding source allows **Email / Password or Auth Method**. The platform already selected the Login architecture as the governed authentication contract. Registration therefore retains the source position as **Authentication method** and concretely uses passwordless email verification; it does not introduce a second password credential store.

## Routes and nested navigation state

The hierarchy has real, deep-linkable routes rather than presentation-only headings:

```text
/register
/register/entry-context
/register/entry-context/campaign-referral
/register/create-account/name
/register/create-account/email
/register/create-account/auth-method
/register/create-account/security-privacy
/register/create-account/review
/register/identity-resolution/new-account
/register/identity-resolution/existing-account
/register/identity-resolution/pending-verification
/register/verify-email/send
/register/verify-email/verification-link
/register/verify-email/resend
/register/verify-email/change-email
```

The Registration UI maintains the nested path in browser history, supports Back/Forward, provides breadcrumbs, and preserves supported acquisition context on every internal workflow transition.

## Public-entry context

Registration accepts and preserves the Public Login/Register entry vocabulary:

- `returnTo`
- `source`
- `campaign`
- `referral`
- `invitation` (`invite` remains an accepted compatibility alias)
- `organization`
- `membership`
- `geography`
- `record`

It also derives an internal `entryKind` of `direct`, `marketing`, `campaign`, `referral`, `partner_invitation`, `event_qr`, or `login_recovery`.

These values are attribution and onboarding intent only. They do not grant organization membership, geography authority, membership entitlement, record access, or any Exchange permission. External/protocol-relative `returnTo` values and auth-entry loops are rejected.

## Real runtime service path

The former stateless Registration adapter has been removed. `POST /api/identity/register` now requires configured runtime services and performs the real transaction:

1. validate and normalize submitted identity data;
2. load the normalized email under a database transaction;
3. route a verified existing identity to Login instead of creating a duplicate;
4. create a new pending user or reuse the existing pending user;
5. create or resume one active `registration_transactions` record;
6. persist acquisition / referral / invitation / deep-link attribution;
7. persist versioned Terms and Privacy acceptance;
8. persist optional marketing consent separately;
9. create a cryptographically random, single-use email verification challenge;
10. persist only the SHA-256 token hash;
11. supersede prior live challenges and apply resend cooldown policy;
12. send the verification link through the configured transactional identity-email transport;
13. record delivery success or failure and activity events;
14. hand the participant to `/onboarding/account-verification`.

There is no in-memory success path, transient fake account, browser-only registration truth, development token secret, or fake delivered-email state. If the database, policy versions, or email transport are not configured, the runtime returns a configuration/service error rather than manufacturing success.

## Duplicate-account behavior

The source requires one account per user email. The server enforces that behavior through normalized email resolution and the database unique index:

```text
email submitted
  ├── no identity
  │    └── create pending user + registration → verification
  ├── pending identity
  │    └── reuse pending user + registration → resume verification
  └── verified identity
       └── do not duplicate → Login
```

Changing the email during Account Verification re-runs the uniqueness check before the pending identity is changed.

## Persistence

Apply these schemas in order:

```text
db/schema.sql
db/identity-verification.sql
db/registration-runtime.sql
```

Registration runtime persistence includes:

```text
users.first_name / last_name / email_verified_at / account_status
registration_transactions
registration_attributions
identity_policy_acceptances
identity_marketing_consents
email_verification_challenges
identity_email_deliveries
activity_events
```

The `registration_transactions` record owns transient account-creation state. The `users` row is the canonical person identity. Organization membership remains downstream.

## Runtime configuration

`.env.example` documents the required values:

- `DATABASE_URL`
- optional `DATABASE_POOL_MAX`
- `RFX_TERMS_VERSION`
- `RFX_PRIVACY_VERSION`
- `RFXCHANGE_APP_URL`
- `IDENTITY_EMAIL_DELIVERY_URL`
- `IDENTITY_EMAIL_FROM`
- optional `IDENTITY_EMAIL_DELIVERY_TOKEN`

The email transport is a real outbound HTTP integration. It receives a transactional identity-email payload and must return a successful HTTP response before RFxchange records the delivery as sent.

## Account Verification handoff

Registration initiates verification, but Account Verification owns the challenge lifecycle. Concrete handoffs are:

```text
/register/verify-email/verification-link
  → /onboarding/account-verification?registration=...

/register/verify-email/resend
  → /onboarding/account-verification?registration=...&mode=resend

/register/verify-email/change-email
  → /onboarding/account-verification?registration=...&mode=change-email
```

A successful token consumption marks the user email verified, marks the registration completed, emits the verification activity event, and continues to `/onboarding/organization` with preserved downstream context.

## Source children intentionally not owned here

The source also names Geography, Organization Setup, Organization Details, Location / Map Placement, Membership Selection, Stripe Payment, and Registration Complete. Those are represented by the corresponding already-defined Identity & Onboarding modules rather than being recreated inside Registration. This preserves one owner for canonical organization, geography, profile, capability, commercial membership, and readiness truth.

## GitHub Pages preview boundary

GitHub Pages is a static review surface and cannot execute the runtime API or PostgreSQL/email services. The Pages build may project the Registration hierarchy visually, but it must not manufacture account creation, verification delivery, or persistence. The normal production-capable Next.js build retains all runtime routes and services.
