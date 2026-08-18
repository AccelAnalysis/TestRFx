# RFx lens

## Purpose

`Authenticated Exchange Shell → Bottom navigation → RFx` is the demand-and-transaction lens of the RFxchange operating chassis. It does not create a second application shell. RFx continues to use the persistent Exchange map, universal search, floating controls, three-state results drawer, four-slot action rail, shared cards, shared detail controller, bottom navigation, deep-link state, identity/organization context, and progressive-availability rules.

## Chassis boundary

The chassis owns composition and interaction mechanics. The RFx domain supplies:

- normalized RFx `ExchangeRecord` projections;
- RFx search terms and filters;
- map locations where a useful location exists;
- RFx-specific detail data;
- own-organization vs. other-organization action definitions;
- RFx lifecycle, pursuit, response, teaming, watch, Q&A/addenda, evaluation, and outcome services as those services become operational.

RFx records without useful coordinates remain valid results in the drawer and do not need map markers.

## Current reference experience

The branch adds a typed RFx catalog behind the existing chassis seed records. The shared detail controller now renders RFx-specific content including:

- RFx/request type;
- lifecycle status;
- solicitation/reference number;
- source (`external` or `rfxchange`);
- close date and estimated value where available;
- scope and performance geography;
- capability-match context;
- structured requirements;
- deliverables;
- response requirements;
- evaluation context;
- explicit external-submission boundary.

Capability matching is presented as discovery context only. It must not be described as qualification, eligibility, endorsement, or probability of award.

## Four governed action positions

For another organization's RFx:

1. **View RFx** — operational; opens the shared detail surface.
2. **Respond** — reserved for go/no-go and structured response workflow.
3. **Team** — reserved for capability-gap teaming workflow.
4. **Watch** — operational in the reference client; toggles session-local watch state.

For an organization-owned RFx:

1. **Create RFx** — reserved for guided issuer RFx creation.
2. **Manage RFx** — reserved for issuer lifecycle, response review, Q&A/addenda, evaluation, and outcome management.
3. **Invite Team** — reserved for issuer collaborators/invitations.
4. **Track** — operational in the reference client; uses the same watch-state seam.

The action position is a shell primitive. Business truth belongs to RFx services. Disabled actions must remain disabled until a real governed runtime exists.

## Watch semantics

The reference client keeps RFx Watch/Track state in mounted React state so the action rail and card star behave coherently without claiming durable persistence. Production should replace this with authenticated organization/user persistence through `rfx_watches` or the final relationship service and should emit activity/notification events.

## Search

The universal Exchange search remains the only search control. While the RFx lens is active, the reference filter also indexes RFx-domain terms such as solicitation number, RFx type, status, scope, performance geography, deliverables, response requirements, and requirement labels.

Production search should preserve the same normalized shell contract while replacing deterministic filtering with the Exchange Search service.

## RFx object and lifecycle

The intended RFx object covers a family of market requests such as RFI, RFQ, RFP, Sources Sought, supplier requests, and service requests. Templates can change required sections and governance without creating separate applications.

A canonical lifecycle is:

`Need → Build RFx → Publish → Discover/Match → Qualify/Assess Fit → Respond → Evaluate → Select/Award/Connect → Execute/Relationship → Outcome → Intelligence`

Responder pursuit state is separate from RFx lifecycle state because many organizations can have different relationships to the same RFx simultaneously.

## Own vs. other context

`ownedByViewer` is currently a chassis reference flag. Production must derive ownership and permissions from authenticated user → organization membership → role/permissions → RFx authority on the server. Client visibility or disabled buttons are not authorization controls.

## External RFx boundary

For external opportunities, RFxchange may support discovery, match explanation, go/no-go, teaming, response readiness, Q&A context, and tracking. It must not claim formal submission or award authority when those actions occur in an external issuer system.

For RFxchange-hosted RFx, future issuer and response services may support controlled publication, addenda, submission receipts, evaluation, clarification, and outcome tracking.

## Persistence target

`db/rfx-domain.sql` extends the existing normalized `exchange_records` / `rfx_records` model with RFx lifecycle data and reference tables for:

- watches;
- pursuit state;
- requirements;
- addenda;
- responses.

Future additions can include issuer collaborators, invitations, Q&A, evaluator assignments, scoring, clarifications, selections, and outcomes without changing the Exchange shell contracts.

## Cross-lens integrations

RFx should connect to the other platform domains rather than duplicate them:

- **Capabilities / AMACS:** requirement matching, gap identification, teammate discovery, capability/evidence context.
- **Resources:** readiness gaps such as certifications, financing, workforce, technical assistance, or proposal support.
- **Intelligence:** demand signals, participation, declines, teaming gaps, outcomes, and market activity.
- **Referrals:** cross-lens introductions launched from RFx context and managed through Menu.
- **Organization Profile:** canonical issuer, responder, teammate, and referral participant identity.

## Production integrations still required

- authenticated viewer and active-organization resolution;
- server-side RFx authorization and action resolution;
- durable Watch/Track persistence;
- production Exchange search/facets;
- RFx repository/API replacing reference catalog data;
- response/go-no-go workspace;
- teaming and cross-lens capability-gap workflow;
- issuer create/manage/publish lifecycle;
- Q&A and addenda;
- response submission/receipts for hosted RFx;
- evaluation/clarification/selection;
- notification and deadline service;
- activity/audit events;
- object storage for solicitation/response attachments;
- external issuer/source connectors where permitted.
