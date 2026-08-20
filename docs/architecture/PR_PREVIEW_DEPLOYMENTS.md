# PR Preview Deployments

## Purpose

RFxchange uses PR previews as a visual acceptance layer for UI work. Every same-repository pull request to `main` builds the existing static RFxchange Pages projection and, after the build succeeds, publishes it to a PR-specific URL without changing the operating-chassis architecture or the production deployment path.

Typical preview URL:

```text
https://accelanalysis.github.io/TestRFx/pr-59/exchange/rfx/
```

The preview is intended for inspection on iPhone, iPad, desktop browsers, and other target form factors before a UI PR is merged.

## Why this exists

Typecheck and production builds can verify code correctness while still missing visual defects such as:

- MapLibre/WebGL rendering failures;
- marker visibility or z-order problems;
- animation regressions;
- mobile safe-area issues;
- drawer positioning problems;
- responsive layout drift;
- map style or layer interactions;
- desktop/mobile composition differences.

A passing CI build is therefore not sufficient evidence for map, animation, responsive, or other visual work. The PR preview provides the rendered artifact that can be inspected before merge.

## Architecture

The preview system is deliberately outside the RFxchange operating chassis.

```text
Pull request
     │
     ▼
read-only preview build
     │
     ▼
static Pages artifact
     │
     ▼
trusted publisher on default branch
     │
     ├── updates gh-pages/pr-<number>/
     ├── republishes the combined Pages site
     └── posts/updates the preview URL on the PR
```

The authenticated Exchange shell, lenses, map contracts, cards, drawer, action rail, detail surfaces, APIs, database contracts, and production deployment remain unchanged.

## Security model

PR code never receives the token that can publish Pages or write repository contents.

`pages-preview.yml` runs the PR source with `contents: read`, prepares the existing static review projection, builds it, and uploads an artifact.

`pages-preview-publish.yml` is the trusted publisher. It runs only from the default-branch workflow definition after the preview build completes. It downloads the already-built static artifact, places it under the PR directory on `gh-pages`, and deploys the combined Pages tree.

Automatic publication is restricted to same-repository pull requests. This prevents arbitrary fork content from being promoted into the repository's shared Pages origin by the trusted publisher.

## Stable PR URLs

A PR uses one stable directory for its lifetime:

```text
/TestRFx/pr-<number>/
```

Each `synchronize` event rebuilds the PR and replaces that directory. The PR comment is updated in place instead of adding a new preview comment for every commit.

When the PR closes or merges, the preview directory is removed and the same PR comment is changed to show that the preview was removed.

## Main Pages preview

A successful `main` Pages build updates the root of the Pages publication while preserving active `pr-*` preview directories.

The publication branch is an implementation detail used to preserve multiple previews at once. GitHub Pages continues to deploy through Actions; this change does not convert the RFxchange production runtime to GitHub Pages.

## Static preview boundary

The preview keeps the existing RFxchange static projection rules. It is suitable for visual review of the real client composition, including map and responsive behavior, but it does not invent successful server-side behavior.

The following remain production/server-capable concerns and should fail closed or display their explicit preview boundary when unavailable:

- authentication and session establishment;
- PostgreSQL/PostGIS persistence;
- Stripe checkout and membership mutation;
- transactional email;
- object storage;
- server-authorized workflows;
- other runtime-only integrations.

A PR preview validates presentation and client interaction. It does not certify production backend readiness.

## Visual acceptance expectation

For map, animation, responsive, navigation, card, drawer, or other visual PRs, review should include the PR preview before merge. At minimum, inspect the affected flow at phone and desktop sizes. Tablet inspection should be included when the change affects responsive transitions, map controls, overlays, drawers, or safe-area behavior.

For map changes, verify the rendered map rather than relying only on screenshots from local development or passing unit/build checks.

## Workflow files

- `.github/workflows/pages-preview.yml` — read-only build of the static preview artifact.
- `.github/workflows/pages-preview-publish.yml` — trusted publication, PR comment management, and cleanup.

The existing static projection scripts remain the source for preview-only substitutions. Production source is typechecked before those substitutions are applied.
