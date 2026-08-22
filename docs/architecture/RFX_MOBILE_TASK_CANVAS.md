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
- **Guided**: adds deliverables, response instructions, and validation.
- **Formal**: adds evaluation, governance, approvals, and publication readiness.

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
- next best action / resume;
- blockers;
- chapter progress;
- direct Review & Submit entry.

RFx requirements remain the authority for response planning, compliance, reuse confirmation, collaboration, Q&A/addenda, review, and submission.

## Mobile-native input

The Task Canvas provides:

- large touch targets and one-handed sticky actions;
- visual choices instead of dense select metadata;
- boolean switches;
- quantity steppers;
- native date inputs;
- speech recognition when the browser supports the Web Speech API;
- camera and file capture;
- device-persistent attachment blobs through IndexedDB;
- interruption-safe autosave and exact path resume;
- reduced-motion support.

Device attachment persistence is a real offline/mobile capability. A production hosted submission still requires the selected server-side object-storage policy before device attachments can become authoritative shared attachments.

## Market preview

The Market Preview requests currently visible Capability results from the Exchange application boundary and builds a transparent funnel:

- potential visible profiles;
- profiles representing criteria terms;
- profiles in service geography;
- profiles with sufficient visible readiness context.

When the search service is unavailable, the interface does not invent counts. It falls back to available structured match context or explains that the live preview is unavailable while preserving the RFx draft.

## Publication

Publication uses a preflight rather than a generic completion button. Required checks adapt to the selected Quick, Guided, or Formal path. Modeled blockers prevent publication. The final commitment explains that publishing activates discovery, matching, and the response timeline, then creates a publication event in the durable workspace.

## Submission

### RFxchange-hosted

Hosted submission requires:

- modeled response preflight readiness;
- explicit submitter-authority confirmation;
- a locked workspace version;
- timestamp;
- generated receipt identifier;
- submitted pursuit state.

The receipt is displayed as a calm, unmistakable success state.

### External issuer system

External submission is deliberately different:

1. RFxchange validates the prepared package.
2. The participant opens the authoritative issuer channel when a governed URL exists.
3. The participant records the external confirmation/reference and time.
4. RFxchange stores the state as **externally submitted — self-reported**.
5. A later permitted integration may promote that state to verified.

RFxchange never creates a hosted receipt or claims formal submission merely because the response was prepared here.

## Persistence and security

The Task Canvas uses the existing RFx workspace service:

- Postgres JSONB workspace plus append-only events behind the trusted service boundary;
- durable local-device fallback for static/offline clients;
- debounced autosave plus immediate save on navigation, completion, handoff, publish, and submit;
- persisted nested path for exact resume.

The client never treats a disabled button or a reference actor as authorization. Final production publication and hosted submission must continue to revalidate the verified user, active organization, role, RFx authority, and workflow state server-side.

## Accessibility and responsive behavior

The experience targets:

- 360px-wide phones without horizontal scrolling;
- 44–52px controls;
- 16px task input text;
- visible focus states;
- screen-reader labels;
- native mobile input modes;
- reduced motion;
- safe-area padding;
- no horizontal procurement tables.

Desktop and tablet retain the same task model inside a centered focused canvas; they do not become separate applications.

## Acceptance criteria

The implementation is not complete until:

- a simple RFx can be created and published from a phone without a desktop-only control;
- a responder can understand fit and choose Pursue / Watch / Decline quickly;
- every required response item can be reached at 360px width;
- closing and reopening restores the exact task and draft;
- modeled blockers prevent hosted publication/submission;
- hosted and external submission states cannot be confused;
- device attachments, dictation fallback, autosave, and offline/device persistence communicate their real state;
- keyboard, screen-reader, focus, zoom, contrast, and reduced-motion behavior remain usable.
