# RFx Mobile Task Canvas

## Purpose

RFxchange promises that a participant can create, pursue, collaborate on, and submit an RFx from a phone without falling back to a desktop procurement application. The canonical RFx workflow tree remains the process and state authority. The Mobile Task Canvas is the mobile-first presentation and interaction layer over that tree.

The central experience rule is:

> The workflow engine stores the process. The phone shows the next meaningful decision.

The Task Canvas does not replace the persistent Exchange chassis. It opens over the mounted map, search, drawer, cards, and bottom navigation, then returns the participant to the exact prior Exchange state.

## Canvas composition

The focused canvas contains only:

1. Back / close.
2. Current RFx and stage.
3. Quiet autosave state.
4. One primary thumb-zone action.

Raw persistence implementation, version, pursuit state, RFx state, audit metadata, and long workflow breadcrumbs are removed from the primary task surface. Those facts remain in the workspace and event history rather than competing with the user’s work.

## Creation experience

Creation begins with **What do you need?**, not with a giant RFx form or the workflow tree.

Participants can:

- type or dictate the need;
- capture a photo/scan from the device camera;
- upload a file;
- start from a governed quick-service, RFQ, or Sources Sought template;
- review a deterministic RFx-type recommendation and its reason;
- choose Quick, Guided, or Formal experience depth without creating separate RFx models.

The same canonical RFx object remains underneath all three experience depths.

### Adaptive paths

- **Quick**: defined need, scope, requirements, timing, preview, publish.
- **Guided**: adds market context, deliverables, response instructions, package assembly, and validation.
- **Formal**: exposes the complete source workflow, including evaluation, governance, approvals, and publication readiness.

The issuer moves through visual chapters and micro-tasks. A responder preview and publication preflight appear before the final publish commitment.

## Response experience

The first responder screen answers:

- What is this?
- Why am I seeing it?
- Can I pursue it?
- What will pursuing it require?

It displays deadline, geography/value context, understandable Matched / Confirm / Gap states, estimated response effort, and Pursue / Watch / Decline actions. Match context is always framed as discovery support—not qualification, endorsement, eligibility, or award probability.

After Pursue, the Response Home provides:

- readiness percentage;
- deadline countdown;
- next best action / exact resume;
- blockers;
- chapter progress;
- direct Review & Submit entry.

RFx requirements remain the authority for response planning, compliance, reuse confirmation, collaboration, Q&A/addenda, review, and submission. Capability or Resource gap handoffs save the RFx workspace before changing lens so returning work is not lost.

## Mobile-native input

The Task Canvas provides:

- large touch targets and one-handed sticky actions;
- visual choices instead of dense select metadata;
- boolean switches;
- quantity steppers;
- native date inputs;
- speech recognition when the browser supports the Web Speech API plus keyboard-dictation fallback;
- camera and file capture;
- device-persistent attachment blobs through IndexedDB;
- interruption-safe debounced autosave and exact path resume;
- immediate save before navigation, completion, handoff, publish, and submit;
- reduced-motion and safe-area support.

Device attachment persistence is a real offline/mobile capability. A production hosted submission still requires the selected server-side object-storage policy before device attachment bytes can become authoritative shared attachments. The workflow never labels a device-only blob as an uploaded shared attachment.

## Market preview

The Market Preview requests currently visible Capability results from the Exchange application boundary and builds a transparent funnel:

- potential visible profiles;
- profiles representing criteria terms;
- profiles in service geography;
- profiles with sufficient visible readiness context.

When the search service is unavailable, the interface does not invent counts. It explains that live market preview is unavailable while preserving the RFx draft.

Market preview and Match remain discovery aids. Neither is qualification, eligibility, endorsement, or a probability-of-award prediction.

## Publication

Publication uses a preflight rather than a generic completion button. Required checks adapt to the selected Quick, Guided, or Formal path. Modeled blockers prevent publication.

The browser does **not** declare publication successful. The final action calls `/api/rfx/transactions`, where the server:

1. resolves the signed-in participant from the HttpOnly `rfx_session`;
2. resolves and verifies the active organization membership;
3. requires RFx write authority;
4. verifies issuer ownership for an existing RFx, or permits the authenticated organization to promote its local create draft;
5. reloads the organization-scoped shared workspace;
6. reruns publication preflight server-side;
7. rejects a stale client version while newer edits are still syncing;
8. creates or updates canonical `exchange_records` and `rfx_records`;
9. records an activity event;
10. returns the committed publication receipt/timestamp.

Only after that commit does the Task Canvas show **Your RFx is live**.

## Submission

### RFxchange-hosted

Hosted submission requires:

- modeled response preflight readiness;
- explicit submitter-authority confirmation;
- authenticated participant and active organization;
- organization membership with RFx response authority;
- an RFxchange-hosted RFx that is currently accepting responses;
- a synchronized shared-workspace version.

The server reruns preflight and then atomically updates the canonical `rfx_responses` and `rfx_pursuits` state and records the activity event. The response receipt/timestamp displayed by the client is returned from that committed transaction; a local button click cannot manufacture it.

### External issuer system

External submission is deliberately different:

1. RFxchange validates the prepared package.
2. The participant opens the authoritative issuer channel when a governed URL exists.
3. If no authoritative URL is stored, RFxchange says so rather than inventing one.
4. The participant records the external confirmation/reference and submitted date/time and explicitly confirms the self-report.
5. The server verifies the RFx is external/external-submission-required and records the canonical response state as **external-submitted-self-reported**.
6. A later permitted integration may promote that state to verified.

RFxchange never creates an RFxchange-hosted submission receipt or claims formal issuer-system submission merely because a response was prepared here.

## Persistence, identity, and isolation

The Task Canvas uses two truthful persistence modes:

- **Authenticated shared workspace**: Postgres JSONB state plus append-only workspace events.
- **Local-device workspace**: browser `localStorage` state plus IndexedDB attachment blobs for static preview, offline work, or temporarily unavailable runtime services.

The shared workspace service is authorized by the existing production identity-session boundary, not by browser-supplied user/organization IDs. It resolves `rfx_session`, then verifies `organization_memberships`.

Workspace identity is:

`record_id + perspective + active organization`

This is essential because multiple responder organizations can work against the same RFx without seeing or overwriting one another’s response workspace. Workspace events also record organization and actor user IDs.

If an authenticated participant has meaningful newer local work when shared persistence becomes available, the client reconciles that local draft into the participant’s organization-scoped shared workspace instead of silently replacing it with an empty remote state.

Client-side disabled controls are never treated as authorization. Publication and submission always revalidate participant, active organization, role/permissions, RFx ownership/source/state, workspace version, and preflight server-side.

## Accessibility and responsive behavior

The experience targets:

- full `100dvh` phone composition;
- 360px-wide phones without horizontal scrolling;
- 44–54px controls;
- 16px task input text;
- visible focus states;
- screen-reader labels;
- native mobile input modes;
- reduced motion;
- iOS/Android safe-area padding;
- no horizontal procurement tables.

Tablet and desktop retain the same task model inside a centered focused canvas; they do not become separate applications.

## Acceptance criteria

The implementation is not complete until:

- a simple RFx can be created and published from a phone without a desktop-only control;
- a responder can understand fit and choose Pursue / Watch / Decline quickly;
- every required response item can be reached at 360px width;
- closing and reopening restores the exact task and draft;
- local work reconciles to the authenticated organization workspace without cross-organization leakage;
- modeled blockers prevent hosted publication/submission on both client and server;
- only a canonical server commit can produce a hosted publication/submission success state;
- hosted and external submission states cannot be confused;
- external submission remains explicitly self-reported unless verified by a permitted integration;
- device attachments, dictation fallback, autosave, and offline/device persistence communicate their real state;
- keyboard, screen-reader, focus, zoom, contrast, reduced-motion, and safe-area behavior remain usable.
