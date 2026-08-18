# Identity & Onboarding Shell — Registration

Registration is the bounded RFxchange identity-creation module. It establishes a person-level account identity and preserves acquisition context, then hands the participant to Account Verification. It does **not** create the organization, geography, organization profile, capabilities, membership, or Exchange authorization context.

## Chassis boundary

```text
Public / Acquisition Shell
        │
        ▼
Login / Register Entry
        │
        ▼
Registration
  ├── capture entry context
  ├── capture first name / last name / email
  ├── acknowledge terms/privacy
  ├── resolve identity (production adapter)
  ├── create pending registration (production adapter)
  └── initiate verification handoff
        │
        ▼
Account Verification
        │
        ▼
Organization selection / creation
        ▼
Geography
        ▼
Organization profile
        ▼
Capability enrichment
        ▼
Exchange-ready completion
```

The module deliberately does not mount the authenticated Exchange map, result drawer, action rail, record cards, or bottom navigation.

## Routes

- `GET /register` — registration surface.
- `POST /api/identity/register` — normalized registration application boundary.
- successful reference submissions hand off to `/onboarding?step=account-verification&registration=...`.

## Entry attribution

`/register` preserves bounded acquisition context from query parameters:

- `source`
- `campaign`
- `referral`
- `invite`
- `returnTo` (relative RFxchange paths only)

Invitation wins over referral, which wins over campaign when deriving the canonical registration entry source. Arbitrary `returnTo` hosts are rejected to avoid creating an open-redirect contract.

## Registration payload

```ts
{
  firstName: string;
  lastName: string;
  email: string;
  acceptedTerms: boolean;
  marketingConsent: boolean;
  context: {
    source: "direct" | "marketing" | "campaign" | "referral" |
      "partner_invitation" | "event_qr" | "login_recovery";
    sourceDetail?: string;
    campaign?: string;
    referralCode?: string;
    invitationCode?: string;
    returnTo?: string;
  };
}
```

The server normalizes names and email, validates required identity fields and terms acknowledgement, sanitizes entry context, and returns a `verification_required` result.

## Reference versus production behavior

The current TestRFx adapter is intentionally stateless. It creates a transient registration ID and proves the registration-to-verification contract without claiming that an account, verification challenge, or email has actually been persisted or delivered.

Production identity infrastructure replaces the adapter behind the existing API boundary and should implement:

1. normalized-email identity lookup;
2. existing verified account → Login resolution;
3. existing pending account → resume Account Verification;
4. invitation lookup and binding;
5. duplicate / abuse / blocked-account policy;
6. durable pending user and registration transaction persistence;
7. terms/privacy version recording and optional marketing consent;
8. single-use expiring verification challenge creation;
9. transactional verification email delivery and resend controls;
10. audit/security events and rate limiting.

The UI should not need to change when that adapter is introduced.

## Identity data model target

The production persistence boundary should distinguish permanent identity from transient registration state. Conceptual tables/services include:

```text
users
user_emails
identities
sessions
registration_transactions
registration_attributions
email_verification_challenges
invitations
invitation_acceptances
consents
terms_acceptances
security_events
audit_events
```

Organization membership is intentionally downstream of registration.

## Passwordless alignment

Registration does not request a password. The intended identity architecture uses email verification / passwordless authentication as the common primitive between first registration and Login. Passkeys, MFA, or other factors can be added later behind the identity service without changing this registration contract.

## Accessibility and recovery

The reference surface includes:

- semantic form submission;
- browser autocomplete hints;
- field-level `aria-invalid` and error descriptions;
- non-marketing terms acknowledgement separated from optional marketing consent;
- keyboard-operable controls;
- explicit existing-account path to Login;
- server-side validation in addition to client input types.

Production adapters should add enumeration-safe existing-account messaging, resend verification, change-email recovery, expired challenge handling, and bot/rate-limit controls.
