# Identity & Onboarding Shell — Login

Login is the bounded returning-participant gateway between acquisition and the authenticated RFxchange Exchange. It now uses the approved production boundaries rather than the previous reference gateway: Firebase Authentication for identity, Firestore for RFxchange identity/session state, and Microsoft Graph for transactional email delivery.

## Source-derived hierarchy

The Login source defines this navigation/workflow tree. `lib/identity/login-navigation.ts` encodes the same parent/child relationships so UI states and recovery paths do not drift into a flat collection of pages.

```text
Login
├── Enter email
│   ├── Email found
│   │   └── Send sign-in link
│   │       └── Check email
│   │           └── Open magic link
│   │               ├── Link valid
│   │               │   └── Authenticate
│   │               │       ├── Additional verification required
│   │               │       │   └── MFA / 2FA
│   │               │       │       └── Verify code
│   │               │       │           └── Successful login
│   │               │       └── Successful login
│   │               │           └── Enter RFxchange
│   │               ├── Link expired
│   │               │   └── Request new link → Check email
│   │               └── Invalid / tampered link → Resend or Support
│   └── Email not found
│       └── Choose whether to register
│           ├── Create account → Registration
│           └── Return to Marketing
├── Session states
│   ├── Active session → Exchange
│   ├── Remembered device → longer active session
│   ├── Session timeout → Login
│   └── Manual logout → Login
└── Contact support
```

The source also names failed outcomes for MFA failure, rate limiting, restricted accounts, and network/server errors. MFA failures stay inside the Verify Code workflow so the enrolled factor can be retried; rate-limited and restricted conditions have concrete routes; network/provider failures stay on the current task with retry and Support rather than inventing a separate product area.

## Concrete routes

- `/login` — email entry and remembered-device choice.
- `/login/not-found` — Register or return to Marketing.
- `/login/check-email` — resend or change email.
- `/login/complete` — Firebase email-link completion, optional MFA, session establishment.
- `/login/link-expired` — request a replacement link.
- `/login/link-invalid` — invalid/already-used/tampered recovery.
- `/login/rate-limited` — abuse-control state.
- `/login/restricted` — deactivated/suspended state.
- `/login/session-expired` — inactivity/expiry/revocation recovery.
- `/login/support` — configured support contact.
- `/logout` — manual sign-out.
- `/api/auth/login` — real challenge issuance and Microsoft email delivery.
- `/api/auth/session` — create, verify/touch, and end the server session.

## Production services

### Firebase Authentication

`FirebaseIdentityGateway` looks up the account, rejects disabled identities, generates the Firebase email sign-in action link, and records an RFxchange challenge. The browser completes the link with Firebase Authentication. No password or Firebase credential secret is written into RFxchange domain data.

The RFxchange challenge adds a 15-minute application validity window and is consumed transactionally before a session is created. Firebase also validates its own email action code.

### Microsoft transactional email

`MicrosoftGraphMailProvider` obtains an application token with the OAuth client-credentials flow and calls Microsoft Graph `users/{sender}/sendMail`. Missing/invalid Microsoft configuration fails the Login request; it never returns a fake delivery success.

### MFA / 2FA

The completion client handles Firebase's `auth/multi-factor-auth-required` state and resolves enrolled TOTP (authenticator-app) or phone/SMS factors. The source image also lists email as a possible MFA-code channel. Firebase Authentication with Identity Platform exposes TOTP and phone factors, not email as a Firebase second-factor ID, so RFxchange does not fabricate an email-MFA implementation.

### Firestore identity and session state

Login resolves `userIdentities/{firebaseUid}` to one RFxchange `userId`, loads `users/{userId}`, and resolves active `organizationMemberships`. Permissions and organization context are therefore server-derived rather than client-supplied.

Server sessions are Firebase session cookies plus server-only `authSessions` records keyed by a digest of the cookie. Every Exchange page load verifies the Firebase session cookie with revocation checking, re-resolves RFxchange identity/membership state, checks account restriction/readiness, and routes incomplete participants into the existing onboarding nodes.

`SessionActivityGuard` checks the active session and only touches activity when the browser has recent interaction. Expired, revoked, or idle sessions route to `/login/session-expired`. `/api/auth/session` DELETE performs manual logout.

## Journey preservation

Login consumes the shared acquisition context (`returnTo`, source, campaign, referral, invitation, organization, membership, geography, record). Session creation sanitizes `returnTo` to internal Exchange/onboarding destinations before redirecting. This preserves notification/deep-link intent without introducing open redirects.

## Security and deployment configuration

The server requires Firebase Admin Application Default Credentials, Firebase Auth web configuration, Microsoft Graph application credentials, the approved sender mailbox, and an application origin. `.env.example` lists the exact settings without including secrets.

Rate limiting is enforced in Firestore. Device/network monitoring records user agent, an optional salted IP hash, and an available country header. Session length, remembered-device duration, idle timeout, and login rate window are deployment policy settings rather than UI constants.

The GitHub Pages build remains a static visual projection. It intentionally does not submit auth requests; real authentication only runs on the server-hosted application.
