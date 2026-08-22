# RFx Mobile Creation / Response / Submission Acceptance

This checklist is the implementation acceptance contract for the mobile-first RFx experience. It complements `RFX_MOBILE_TASK_CANVAS.md`; it does not create new product requirements.

## Mobile composition

| Requirement | Status | Implementation |
| --- | --- | --- |
| Focused RFx work can occupy the full phone viewport | Implemented | Task Canvas uses `100dvh`, safe-area insets, focused scroll region, and sticky thumb-zone actions. |
| 360px phone support without procurement tables | Implemented | Dedicated 360px rules, stacked cards/choices, no horizontal data tables. |
| Tablet / desktop reuse the same workflow model | Implemented | The same Task Canvas centers at larger breakpoints rather than branching into a second RFx application. |
| Primary controls meet mobile target sizing | Implemented | Task/footer/capture/choice controls use approximately 44–54px minimum targets. |
| Reduced motion / visible focus / screen-reader labels | Implemented | CSS and semantic control states are retained throughout the canvas. |

## Create RFx

| Requirement | Status | Implementation |
| --- | --- | --- |
| Start with “What do you need?” | Implemented | Dedicated creation entry avoids exposing the recursive workflow tree. |
| Type / speak / scan / upload | Implemented | Text capture, Web Speech API when supported, camera/file inputs, IndexedDB device storage. |
| Start from governed template | Implemented | Quick Service, RFQ, and Sources Sought starting points feed the same canonical RFx workflow. |
| Reuse a previous RFx | Implemented | Authenticated active-organization picker and server copy service. Only reusable structure is copied. Dates, lifecycle, responses, acknowledgements, and award state are excluded. Copied RFx type must be reviewed again. |
| RFx-type recommendation with rationale and alternatives | Implemented | Deterministic experience adapter; issuer retains the decision. |
| Quick / Guided / Formal adaptive experience | Implemented | Different presentation depth over the same canonical RFx object. |
| Structured requirement cards | Implemented | Requirement, kind, Required/Preferred, applies-to, and evidence/confirmation request. |
| Market preview | Implemented with production truth boundary | Capability API is PostgreSQL-backed; dedicated RFx market-preview service is authenticated and organization-aware. Missing database/service fails closed rather than returning fixture counts. |
| Responder preview | Implemented | Compact responder-first preview before publication. |
| Publication preflight | Implemented | Adaptive blockers plus date consistency; same preflight reruns server-side. |
| Formal publish commits canonical RFx | Implemented | Authenticated transaction creates/updates canonical Exchange/RFx records and activity before returning a receipt. |
| Published state immediately reconciles in mounted Exchange | Implemented | Compatibility bridge updates the mounted card only after committed server/workspace state shows Open; server remains authoritative. |

## Respond

| Requirement | Status | Implementation |
| --- | --- | --- |
| Decision-first opportunity screen | Implemented | Deadline, geography/value, match context, effort, Pursue / Watch / Decline. |
| Match context is not qualification | Implemented | Matched / Confirm / Gap plus explicit discovery-only boundary. |
| Fast Go / No-Go | Implemented | Fit, Eligibility, Capacity, Economics use Yes / Unsure / No plus optional notes. |
| Response Home | Implemented | Readiness, deadline, blockers, next-best action, chapter progress, Review & Submit. |
| Requirement / compliance matrix | Implemented | Requirement/component, owner, state. |
| Reused organization data must be confirmed | Implemented | Explicit reuse-confirmation checklist; `false` cannot satisfy required confirmation. No silent auto-submit of profile data. |
| Gap handoff to Capabilities / Resources | Implemented | Workspace saves before lens handoff so response state is preserved. |
| Collaboration task structure | Implemented | Section assignment, information requests, responsibilities, document references, completion tracking. |
| Legal teaming is not created by UI click | Implemented truth boundary | Workflow participation is distinct from external/legal teaming agreement. |
| Q&A / addenda workflow positions | Implemented at source-workflow level | Questions, answers, controlled addendum version, and acknowledgement tasks are represented. A live issuer Q&A messaging/diff service is not fabricated where the current repository lacks that authoritative data service. |

## Submission

| Requirement | Status | Implementation |
| --- | --- | --- |
| Blockers shown before final commitment | Implemented | Response preflight is visual and reruns server-side. |
| Hosted submitter authority confirmation | Implemented | Explicit checkbox plus server role/permission validation. |
| Organization isolation | Implemented | Shared workspace key includes RFx + perspective + active organization. Different responders cannot share one response workspace. |
| Hosted submission commits canonical response/pursuit | Implemented | Canonical response/pursuit upserts and activity event before receipt. |
| Hosted receipt comes only from server commit | Implemented | Client cannot manufacture a hosted receipt. |
| External submission is materially distinct | Implemented | Official channel handoff only when a governed URL exists; confirmation/time captured; state stored as externally submitted — self-reported. |
| External submission never gets a hosted receipt | Implemented | Separate transaction/state path. |
| Device-only attachments are not falsely represented as shared files | Implemented truth boundary | IndexedDB attachments are explicitly local-device artifacts. Production shared object-storage authority is not fabricated. Hosted workflows must synchronize authoritative shared attachment references before those files can be part of a formal server package. |
| Response status immediately reflected in mounted Exchange | Implemented | Submitted workspace reconciles the card relationship to Responded after committed state. |

## Persistence and interruption safety

| Requirement | Status | Implementation |
| --- | --- | --- |
| Debounced autosave | Implemented | Task edits save automatically; navigation/commit/handoff save immediately. |
| Exact resume | Implemented | Active workflow path and values persist. |
| Offline / static preview drafting | Implemented | Local-device workspace and IndexedDB blobs. |
| Reconnect while workflow remains open | Implemented | Local-mode saves opportunistically promote to authenticated shared persistence when connectivity/service returns. |
| Reopen with newer local work | Implemented | Local-to-shared reconciliation promotes the newer meaningful local draft. |
| Server authorization does not trust browser actor IDs | Implemented | `rfx_session` → active organization → membership/role/permission resolution. |

## Database invariants

`db/rfx-mobile-transaction-runtime.sql` defines the conflict/uniqueness keys used by mobile publication and submission:

- one RFx domain projection per Exchange RFx record;
- one current response per RFx/respondent organization;
- one pursuit state per RFx/organization;
- actor/workspace event indexes for mobile audit/history.

## Intentionally not fabricated

The following need an authoritative external/provider service before RFxchange can claim them as production behavior:

- shared object-storage bytes for RFx/response attachments;
- authoritative external procurement-portal submission confirmation unless a permitted connector exists;
- live issuer Q&A messaging/change-diff data beyond the current controlled workflow/addendum records;
- a legal teaming agreement generated by a Team button;
- qualification/eligibility/award probability inferred from capability matching.

These boundaries are not “mock TODOs” presented as success. The UI either uses the real service currently available, stores a clearly labeled device-local artifact, or fails closed.

## Automated acceptance

The PR must retain automated checks covering:

- mobile experience adapter behavior;
- source-contract presence for need-first creation, mobile capture, reuse, requirement cards, rapid fit, collaboration/addenda, hosted/external truth, session authorization, organization isolation, canonical Capability discovery, transaction indexes, 360px/safe-area/reduced-motion behavior;
- existing Exchange card/selection/icon behavior.

Repository-wide production typecheck/build remains a separate gate. Any unrelated baseline failure must be identified explicitly rather than misreported as an RFx pass or an RFx regression.

## Human visual acceptance

The stable PR preview is intended for final hardware review on:

- small phone around 360px wide;
- current iPhone-sized viewport;
- common Android-sized viewport;
- tablet;
- desktop;
- installed/PWA-style full-height mode where available.

Review Create, Pursue/Watch/Decline, resume, Response Home, publication preflight, hosted submit, external submit, keyboard/focus, safe-area and long-title/keyboard conditions. Static Pages preview cannot execute production database/session transactions and must fail closed for those operations.
