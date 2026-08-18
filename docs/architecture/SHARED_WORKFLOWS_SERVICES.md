# Authenticated Exchange — Shared workflows/services

## Governing rule

Shared workflows/services are capabilities that may be entered from, affect, or return to more than one Exchange lens. They do **not** become another lens and they do not replace shell primitives such as Map, Search, Drawer, Cards, Detail, or the four-slot Action Rail.

RFx, Resources, Intelligence, and Capabilities remain the only persistent Exchange lenses. Menu is the management gateway for cross-cutting services.

## Chassis boundary

```text
RFx / Resources / Intelligence / Capabilities
                    |
             governed LensAction
                    |
                    v
          Shared workflow dispatcher
                    |
       +------------+-------------+
       |            |             |
 Relationships   Referrals   Collaboration
 Save/Watch      Refer       Team/Connect
 Track/Follow
       |            |             |
       +------------+-------------+
                    |
          normalized activity event
                    |
     Notifications / audit / analytics
                    |
                    v
                Menu services
```

The shell owns launch state, overlays, return continuity, and the relationship projection used by reference cards. A production service owns authorization, persistence, settlement, delivery, and domain truth.

## Implemented reference workflows

The shared dispatcher in `lib/exchange/shared-workflows.ts` recognizes these governed action IDs:

- `save` — cross-lens Saved relationship.
- `watch` — RFx watch relationship.
- `track` — Intelligence tracking relationship.
- `follow` — organization/capability follow relationship.
- `share` — permission-aware deep-link contract.
- `refer` — cross-lens referral composer contract.
- `match` — cross-domain matching request and deterministic reference preview.
- `team` — collaboration/teaming request contract.
- `connect` — organization connection request contract.

The reference implementation stores relationship state and emitted workflow events only in the mounted Exchange session. It deliberately does not claim durable production writes.

## Deliberately lens-specific workflows

The following remain owned by their product domains even though they launch from the same Action Rail:

- RFx response submission and response lifecycle.
- Resource request/offer fulfillment and availability management.
- Intelligence comparison/analysis semantics.
- Capability evidence, AMACS verification, and publishing.
- Organization management actions.

Shared services may support those workflows with identity, notifications, files, payments, matching, or events, but they do not absorb the domain transaction.

## Exchange context

Every shared workflow must eventually resolve a server-authoritative context equivalent to:

```text
viewer
active organization
active lens
selected record
ownership
role / permissions
membership / entitlements
geography
feature availability
```

`referenceActorContext` exists only so the TestRFx chassis can exercise the UI contract without pretending authentication is already connected.

## Relationship service

Save, Watch, Track, and Follow use one relationship vocabulary rather than four unrelated persistence systems. `db/shared-workflows.sql` adds `record_relationships` with a `relationship_kind` of `saved`, `watching`, `tracking`, or `following`. The original `favorites` table remains a simple compatibility projection for Save.

Production adapters should support relationship preferences such as deadline alerts or delivery channels without changing the lens UI.

## Cross-lens referrals

Referrals remain a shared workflow, not a bottom-navigation lens.

```text
RFx ----------+
Resource -----+
Intelligence -+--> Refer --> Referral engine --> Recipient/outcome
Capability ---+                         |
                                         +--> Menu > Referrals
```

The canonical `referrals` table is extended rather than duplicated. `referral_events` provides lifecycle provenance. Commercial referral fees, platform fees, credits, Stripe reconciliation, and payouts remain in the organization-level commerce service.

## Matching

The reference matcher ranks normalized Exchange records using metadata overlap, common geography, map-addressability, and cross-domain relationships. This is intentionally deterministic and non-authoritative.

Production matching should replace the adapter with AMACS capability projection, RFx requirements, geography/service areas, organization relationships, permissions, relevance, and explainable confidence. A durable `match_decisions` record is only required when a downstream workflow needs provenance; raw recommendation generation does not need to become transactional truth.

## Collaboration

`team` and `connect` share a collaboration request service. RFx-specific team composition and Resource-specific transaction semantics remain downstream domain responsibilities. Messaging/delivery plugs into the shared request rather than being recreated per lens.

## Share and deep links

Share uses the existing deep-link model: `/exchange/{lens}/{recordId}`. Production may issue scoped or expiring links through `share_links`, but link resolution must re-evaluate authentication and authorization. A share token never grants rights the viewer does not otherwise possess.

## Menu management services

Menu remains a utility surface over the mounted Exchange. This slice connects four management destinations to shared service surfaces:

- Saved & Watchlist
- Referrals
- Notifications
- Billing & Membership

Opening one of these services does not change the active lens, search, selected record, map, or drawer state.

Organization Profile, Account, Settings, and Help remain separate utility modules and are not implemented by this slice.

## Notifications and events

Every reference workflow emits a normalized `SharedWorkflowEvent`. Production should persist the corresponding platform event and let notification rules decide whether to deliver in-app, email, push, or another channel. Lenses should emit events; they should not build separate notification centers.

`notifications` and `workflow_executions` in the persistence extension define that integration seam. Existing `activity_events` remains the canonical general activity stream.

## Membership / commerce

Membership is a shared organization-level service because entitlements affect every lens. It is not a workflow owned by RFx, Resources, Intelligence, or Capabilities.

This slice exposes the Menu management boundary only. It does not duplicate the Pricing/Membership domain or claim live Stripe state, credits, referral settlement, invoices, or payouts.

## API boundary

`GET /api/exchange/workflows` returns the shared workflow/service catalog.

`POST /api/exchange/workflows` validates that an action belongs to the shared-workflow service, that the lens is valid, and that the referenced record belongs to that lens. It returns a normalized reference event with `durable: false` and names the production adapter that must replace the reference behavior.

Client components do not write database tables directly.

## Progressive availability

The action registry is still authoritative for whether an action is visible, applicable, authorized, and operational. This slice makes `Team`, `Connect`, `Match`, and `Refer` operational as reference shared workflows. Lens-specific actions such as Respond, Resource Request, Compare, Evidence, and Publish remain disabled until their product modules exist.

Production authorization must be server-enforced even when an action is rendered enabled in the client.

## Persistence extension

`db/shared-workflows.sql` extends the base schema with:

- `record_relationships`
- referral lifecycle fields and `referral_events`
- `collaboration_requests`
- `share_links`
- `notifications`
- `workflow_executions`
- `match_decisions`

It deliberately reuses `users`, `organizations`, `organization_memberships`, `exchange_records`, `referrals`, `favorites`, and `activity_events` from the base chassis.

## Production adapters still required

- authenticated user and active-organization context
- server-side authorization and entitlement resolution
- durable relationship repository
- referral recipient resolution and lifecycle service
- referral/commercial fee settlement
- AMACS-backed matching
- collaboration and messaging delivery
- notification rules and delivery channels
- payment/membership/credits service
- audit/event persistence
- object storage for workflow attachments
- feature flags and operational-readiness policy

The UI contract should survive those integrations unchanged.
