# TestRFx — RFxchange operating chassis

Shared RFxchange platform shell and bounded product integrations. RFx, Resources, Intelligence, and Capabilities plug into one persistent authenticated Exchange rather than recreating separate applications.

## What is implemented

- Public/acquisition Marketing shell and Identity/Onboarding boundaries
- Persistent authenticated Exchange composition
- Provider-neutral full-screen shared map canvas
- Translucent Universal Search and floating controls
- Three-state result drawer with infinite-load contract
- Four governed lens action positions
- Shared Exchange record cards and marker/card synchronization
- Shared detail controller and deep-linkable lens/record routes
- RFx / Resources / Intelligence / Capabilities / Menu bottom navigation
- Cross-lens Menu and shared workflow boundaries
- PostgreSQL/PostGIS canonical schema target
- Responsive mobile/desktop and accessibility paths

### Intelligence

The Intelligence lens is service-backed rather than fixture-backed:

- complete source-defined Own/Others child and grandchild hierarchy;
- persistent nested navigation state with breadcrumbs and Back/Escape behavior;
- Add Insight, Edit Insight, Add Note, Compare, Track, and Follow workflows;
- comparison across insights, organizations, and geographies;
- canonical sources/provenance and visibility-scoped notes;
- paginated mapped + off-map Intelligence discovery;
- real Track/Follow persistence;
- source-backed RFx/Capability matching;
- real cross-lens referral creation;
- authenticated PostgreSQL API routes with no fake actor or Intelligence fixture fallback.

The former deterministic Intelligence records and fabricated heat overlay are not part of the runtime.

## Architecture

RFxchange is organized as Public / Acquisition, Identity & Onboarding, and Authenticated Exchange shells. The first four bottom-navigation items are Exchange lenses; Menu is a utility surface.

- [`docs/architecture/PLATFORM_SHELL.md`](docs/architecture/PLATFORM_SHELL.md) — authenticated operating chassis
- [`docs/architecture/INTELLIGENCE_LENS.md`](docs/architecture/INTELLIGENCE_LENS.md) — Intelligence hierarchy, services, persistence, and runtime prerequisites
- [`docs/architecture/MARKETING_SHELL.md`](docs/architecture/MARKETING_SHELL.md) — Public / Acquisition → Marketing structure and handoff contract

## Run locally

```bash
npm install
npm run dev
```

Then open `http://localhost:3000` for Marketing or a lens route such as `http://localhost:3000/exchange/intelligence`.

### Real Intelligence prerequisites

The authenticated Intelligence runtime additionally requires:

1. PostgreSQL with PostGIS;
2. `db/schema.sql`;
3. `db/intelligence.sql`;
4. `db/exchange-sessions.sql`;
5. `DATABASE_URL` (and `DATABASE_SSL` where needed);
6. a valid `rfx_session` issued by the production Identity boundary for a user with an active organization membership.

When these dependencies are absent, Intelligence returns an explicit authentication/service-unavailable state rather than substituting sample market data.

## Validation

```bash
npm run typecheck
npm run build
```

GitHub Actions runs production validation on pull requests and pushes. The GitHub Pages projection is separately validated as a static preview; it does not inject authenticated Intelligence data because Pages has no server/API runtime.

## Remaining platform boundaries

Other bounded modules in TestRFx still have their own documented production integration seams, including the shared map provider, parts of Identity, RFx response/team workflows, some Resources flows, AMACS evidence, payments, notifications, and other cross-lens services. Those should be replaced within their owning modules rather than by duplicating them inside Intelligence.