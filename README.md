# TestRFx — RFxchange operating chassis

Reference implementation of the shared RFxchange platform shell. The repository keeps the Public / Acquisition, Identity & Onboarding, and Authenticated Exchange shells distinct while allowing product domains to plug into governed chassis contracts.

## What is implemented

- Public/acquisition Marketing shell with campaign context and Login/Register handoff
- Production Login boundary using Firebase Authentication, Firestore-backed RFxchange identity/session state, and Microsoft Graph transactional email
- Passwordless email-link flow with 15-minute RFxchange challenge validity, resend/change-email, cross-device email confirmation, Firebase TOTP/SMS MFA handling, remembered-device sessions, inactivity timeout, revocation checks, and manual logout
- Source-derived hierarchical Login workflow and concrete recovery routes for not-found, expired/invalid link, rate limiting, restricted accounts, and support
- Server-side post-login readiness routing through Account Verification, Organization, Geography, Organization Profile, Capability enrichment, Membership, and Exchange-ready completion
- Registration and guided Onboarding shell boundaries
- Persistent authenticated Exchange composition with RFx / Resources / Intelligence / Capabilities / Menu
- Provider-neutral map, search, drawer, cards, detail, and action contracts
- GitHub Pages static preview projection that does not pretend to execute server authentication

## Identity configuration

Copy `.env.example` into the deployment configuration. Firebase Admin uses Application Default Credentials on Firebase App Hosting / Google Cloud. Browser Firebase configuration uses the `NEXT_PUBLIC_FIREBASE_*` variables. Microsoft Graph delivery requires the tenant/client credentials and approved RFxchange sender mailbox.

The active Login architecture is documented in [`docs/identity-login.md`](docs/identity-login.md).

## Run locally

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`. Real Login requires configured Firebase and Microsoft services; missing configuration produces an explicit service failure rather than a simulated success.

## Validation

```bash
npm run typecheck
npm run build
```

GitHub Actions runs both commands on pull requests and pushes to `main` and `agent/**` branches. The separate Pages workflow produces a static visual preview and removes runtime-only APIs from its ephemeral build workspace.

## Architecture boundary

RFx, Resources, Intelligence, and Capabilities are lenses over one Exchange; Menu is a cross-lens utility surface. Authentication proves who the participant is. RFxchange authorization and onboarding readiness are resolved server-side from the participant's RFxchange identity and organization memberships before Exchange access.

`db/schema.sql` remains historical/reference PostgreSQL/PostGIS chassis provenance. The active Login implementation follows the approved Firebase Authentication + Firestore runtime direction rather than adding new PostgreSQL authentication state.
