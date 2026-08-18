# GitHub Pages preview deployment

RFxchange keeps its production operating chassis server-capable while exposing a static browser preview for design and interaction review.

## Purpose

The Pages site is a **preview projection**, not a production hosting decision. It exists so contributors can inspect the current UI directly from GitHub without cloning the repository or running a local development server.

The preview preserves the shared shell contracts:

- Public / Acquisition shell
- Identity & Onboarding shell surfaces
- Persistent authenticated Exchange shell
- RFx, Resources, Intelligence, and Capabilities lenses
- Menu as a cross-lens utility surface
- Universal search, floating controls, map, drawer, action rail, record cards, and detail surfaces

## Architecture boundary

Production source keeps its Next.js route handlers and runtime boundaries under `app/api`. The Pages workflow does **not** delete or replace those files in the repository.

During the Pages job only, `scripts/prepare-pages-preview.mjs` prepares an ephemeral static projection in the GitHub Actions workspace. It:

1. removes `app/api` from that temporary build workspace;
2. substitutes static preview versions of request-dependent identity/acquisition pages;
3. supplies static parameters for dynamic preview routes;
4. makes direct browser-history/share URLs aware of the GitHub Pages repository base path.

The normal `chassis-ci` workflow continues to type-check and build the unchanged production application separately.

## Deployment behavior

`.github/workflows/pages-preview.yml` builds the static projection on:

- pull requests targeting `main`;
- pushes to `main`;
- pushes to `agent/**` branches;
- manual workflow dispatch.

Only a push to `main` (or a manual dispatch from `main`) deploys the shared `github-pages` environment. Branch and pull-request runs validate that the preview can still be exported without replacing the published site.

## Expected URLs

For the default GitHub project-site configuration:

- Preview root: `https://accelanalysis.github.io/TestRFx/`
- Exchange: `https://accelanalysis.github.io/TestRFx/exchange/rfx/`

The Pages preview uses `/TestRFx` as its build-time base path. Normal local/production builds have no added base path.

## Preview limitations

GitHub Pages serves static files and does not execute the RFxchange runtime APIs. Therefore server-backed actions such as authentication submission, durable onboarding writes, production membership changes, and future database-backed workflows remain production integration points.

The Exchange reference UI remains interactive because its chassis demonstration is driven by the reference records and client-side state. Preview-only actions should never be interpreted as durable production transactions.

## One-time repository setting

GitHub Pages must use **GitHub Actions** as its publishing source. If Pages has not yet been enabled for this repository, set that once in **Settings → Pages → Build and deployment → Source → GitHub Actions**. After that, successful deployments from `main` update the shared preview automatically.
