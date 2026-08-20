# RFx workspace trust boundary

The RFx workflow is usable today without pretending the repository has a production participant identity service.

## Current client behavior

The RFx workflow client first attempts the shared workspace API. If the server does not have both the database and trusted-service configuration, or if the request does not carry trusted server authority, the client persists the same complete workspace to `localStorage` and labels it **Local device workspace**.

This local persistence is functional and survives page reloads on the same browser/device. It does not claim multi-user delivery, organization authority, or a remote database write.

## Shared Postgres service

The repository contains a real Postgres repository using `@neondatabase/serverless`. Shared workspace persistence requires:

- `DATABASE_URL`
- `RFX_WORKSPACE_SERVICE_TOKEN`
- a trusted server/BFF or production Identity layer that validates the participant session and active organization before calling the RFx workspace service

`/api/rfx/workspaces` rejects anonymous browser writes even when a database is configured. The current Identity gateway on `main` explicitly does not establish a production session, so RFx must not infer authority from client state, record ownership flags, or the shared reference actor.

## Production integration

When the production Identity/BFF layer exists, it should resolve:

`verified session → user → active organization → organization membership → role/permissions → RFx ownership/participant authority`

The trusted server can then call the workspace repository/service under that resolved actor. The RFx workflow contracts and UI do not need to change.

The service token is an internal trust seam, not an end-user credential and must never be exposed in browser JavaScript or `NEXT_PUBLIC_*` environment variables.

## External authority boundaries

The same rule applies to legal/procurement authority:

- an RFx match is not qualification or endorsement;
- a teaming invitation is not a legal teaming agreement;
- RFxchange-hosted response submission may create a locked workspace receipt only for RFxchange-hosted requests;
- externally hosted submissions require an external confirmation/reference and RFxchange must not claim it submitted to the issuer's authoritative portal;
- selection/award records must not imply RFxchange has legal award authority where the issuer's external system remains authoritative.
