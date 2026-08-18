# Identity & Onboarding Detail Surface

## Purpose

The Identity & Onboarding Detail Surface is the reusable hierarchical navigator/controller for workflows established before a participant enters the authenticated Exchange. It is **not** the authenticated Exchange record-detail controller and it does not mount the persistent map, Exchange result drawer, lens action rail, or bottom lens navigation.

The merged first version proved a common Detail Surface, but review against the source flows exposed four gaps:

1. top-level subjects were flat rather than a true child/grandchild workflow tree;
2. nested location was component state instead of an addressable navigation state;
3. the surface rendered hard-coded user/organization/capability values and browser-session save behavior;
4. several source-defined children were not represented as concrete destinations.

The revised governing question is:

> Where am I in the onboarding hierarchy, what child or grandchild workflow is next, which domain owns the real action/data, and how do I return without losing the Detail Surface context?

## Chassis boundary

Detail Surface owns:

- focused Identity/Onboarding chrome and responsive composition;
- the recursive navigation tree;
- nested route state, breadcrumbs, parent/child navigation, and deep links;
- required / recommended / optional / conditional semantics;
- source traceability for configured nodes;
- safe internal `returnTo` continuity;
- explicit handoffs to owning workflows and APIs;
- service-maturity disclosure instead of pretending an integration is production-backed;
- `GET /api/onboarding/detail` as the hierarchy/read-model contract.

Detail Surface does **not** own:

- identity/session persistence or verification delivery;
- canonical organization/entity resolution writes or authority decisions;
- geocoding, geography rollout policy, or PostGIS writes;
- Organization Profile persistence;
- AMACS inference/taxonomy persistence;
- evidence/object storage or substantive verification;
- Stripe card collection, capacity reservation, payment reconciliation, or entitlements;
- final readiness policy or durable Exchange activation;
- authenticated Exchange map/detail state.

Those remain domain/service responsibilities. The Detail Surface no longer keeps a browser-only shadow record for them.

## Canonical hierarchy

The seven canonical roots follow the onboarding progression while keeping conditional commercial membership separate from access readiness:

```text
Identity & Onboarding Detail Surface
├── Account & Identity
├── Organization
├── Geography & Location
├── Organization Profile
├── Capability Enrichment
├── Membership (conditional)
└── Exchange-ready Completion
```

Legacy Detail Surface URLs continue through redirects so old links do not break:

- `authority` → Organization → Referral / Invitation → Set Role and Confirm Access
- `capability` → Capability Enrichment → Capabilities Entry
- `evidence` → Capability Enrichment → Evidence / Certifications
- `role-goals` → Organization Profile → Role, Goals & Visibility

### Account & Identity

```text
Account & Identity
├── Account Creation
│   ├── Name
│   └── Email / Password or Auth Method
└── Verify Email / Access
    ├── Send Verification
    ├── Verification Link
    ├── Resend Verification
    └── Change Email Address
```

The verification leaves point to the merged Account Verification API contract instead of fake Detail-Surface values.

### Organization

```text
Organization
├── Basic User Onboarding
│   ├── Welcome / Role Selection
│   ├── Join Existing Organization
│   └── Create New Organization
├── Organization Setup
│   ├── Claim Existing Organization
│   └── Create New Organization
├── Organization Setup Details
│   ├── Organization Name
│   ├── Organization Type
│   ├── Location / Geography
│   └── Visibility Preferences
├── Organization Details
│   ├── Organization Name & Description
│   ├── Industry / NAICS (optional)
│   └── Website / Contact Info
└── Referral / Invitation
    ├── Validate Invitation
    ├── Accept and Join Organization
    └── Set Role and Confirm Access
```

The merged Organization workflow has a concrete organization-search/entity-resolution API. Claim/join/create mutations still use reference workflow state today, so Detail Surface labels that production persistence boundary rather than inventing a server save.

### Geography & Location

```text
Geography & Location
├── Select Geography
│   ├── Search County / City / Region
│   ├── Primary Locality
│   └── Market Boundaries
├── Location / Map Placement
│   ├── Add Physical Address
│   ├── Geocode Address
│   └── Confirm Marker Placement
├── Visibility Preferences
│   ├── Exact
│   ├── Approximate
│   └── Locality Only
├── Service Geography
└── Review Geography
```

Primary geography, physical location, public precision, and service geography remain separate concepts. The merged Geography API validates the draft/context boundary, while live geocoding and durable PostGIS writes remain production adapters.

### Organization Profile

```text
Organization Profile
├── Core Profile Details
│   ├── Organization Overview
│   ├── Contacts
│   └── Description and Key Info
├── Industry & Services
│   ├── Industries Served
│   └── Service Offerings
└── Role, Goals & Visibility
    ├── Welcome / Role Selection
    ├── Visibility Preferences
    └── Goals
```

Profile work delegates to the merged Organization Profile workflow/API rather than creating a second onboarding-only profile record.

### Capability Enrichment

The source-defined enrichment sequence is represented directly:

```text
Capability Enrichment
├── Core Profile Details
├── Industry & Services
│   ├── Industries Served
│   └── Service Offerings
├── Capabilities Entry
│   ├── Detailed Capabilities
│   └── Solutions
├── AMACS Mapping / AI-to-AMACS Assistance
│   ├── Suggest AMACS Mapping
│   └── Review / Confirm Mapping
├── Evidence / Certifications
│   ├── Certifications
│   ├── Licenses
│   ├── Case Studies
│   └── Supporting Documents
└── Tags / Keywords / Specialties
    ├── Keywords
    ├── Specialties
    └── Tags
```

The merged Capability Enrichment page exists, but it does not expose a canonical onboarding capability/AMACS/evidence server API. Detail Surface therefore delegates to `/onboarding/capabilities` and labels the service as workflow-only. It does **not** add a fake AMACS endpoint or fake object storage.

### Membership

```text
Membership
├── Membership Selection
│   ├── Founding Membership ($49/mo)
│   ├── Future Plans as Available
│   └── Continue Free
└── Payment (Stripe)
    ├── Enter Payment Details
    ├── Secure Checkout
    └── Payment Confirmation
```

The Membership catalog API is connected. Live Stripe checkout/payment reconciliation is not. Payment leaves therefore hand off to Membership and explicitly remain production-pending rather than collecting card details or returning fabricated confirmations.

### Exchange-ready Completion

```text
Exchange-ready Completion
├── Review & Completion Checkpoint
│   ├── Completeness Check
│   ├── Missing Items / Actionable Prompts
│   ├── Save and Continue Later
│   └── Profile Completeness Indicator
└── Exchange Ready
    ├── Listed / Presence in Exchange
    ├── Browse RFx, Resources, Intelligence, and Capabilities
    └── Profile Available Through Menu
```

Readiness and activation are owned by the merged Completion endpoints. Optional AMACS depth/evidence does not become an artificial access gate.

## Nested navigation state

Root subject:

```text
/onboarding/detail/[subject]
```

Child, grandchild, and deeper workflow:

```text
/onboarding/detail/[subject]/[...path]
```

Examples:

```text
/onboarding/detail/organization/referral-invitation/validate-invitation
/onboarding/detail/geography/location-map-placement/confirm-marker
/onboarding/detail/capabilities/amacs-mapping/review-confirm-mapping
/onboarding/detail/readiness/review-completion-checkpoint/missing-items
```

The URL is the navigation state. Refreshes, direct links, and browser history therefore preserve the exact tree branch without reconstructing it from ephemeral React state.

`returnTo` is restricted to internal paths and is preserved while navigating the Detail Surface. It is forwarded only to owning workflows that currently understand a return destination; unsupported targets are not given decorative query parameters.

## Concrete workflow/service ownership

| Detail area | Owning workflow | Existing service boundary | Current maturity |
|---|---|---|---|
| Account creation | `/register` | `POST /api/identity/register` | Connected API; stateless/reference identity adapter |
| Email/access verification | `/onboarding/account-verification` | `POST /api/identity/account-verification` | Connected API; reference challenge/delivery boundary |
| Organization resolution | `/onboarding/organization` | `GET /api/onboarding/organizations` | Search connected; claim/join/create persistence pending |
| Geography | `/onboarding/geography` | `POST /api/onboarding/geography` | Validation connected; geocoder/PostGIS persistence pending |
| Organization Profile | `/onboarding/organization-profile` | `POST /api/onboarding/organization-profile` | Validation connected; persistence adapter reference |
| Capability Enrichment | `/onboarding/capabilities` | no canonical onboarding server API yet | Workflow only |
| Membership | `/onboarding/membership` | `GET /api/membership/catalog` | Catalog connected; Stripe execution pending |
| Readiness | `/onboarding/completion` | `GET /api/onboarding/readiness` | Connected contract; reference repository inputs |
| Exchange activation | `/onboarding/completion` | `POST /api/onboarding/readiness/activate` | Connected contract; durable activation/events pending |

This distinction is intentional: “endpoint exists” and “production source of truth exists” are not treated as the same statement.

## Mock removal

The Detail Surface no longer contains:

- fabricated user names/emails;
- fabricated organization names/geographies;
- fake capability/AMACS/evidence values;
- generic editable form fields that compete with owning domain forms;
- browser `sessionStorage` persistence;
- Detail-Surface client validation pretending to be canonical domain validation;
- a fake Save/Continue command.

Static hierarchy definitions remain in code because they are navigation configuration, not mutable domain data.

Where the owning implementation is still reference-only, the surface says so. It never manufactures successful verification, organization persistence, geocoding, AMACS mapping, evidence upload, Stripe payment, or Exchange activation.

## Parent onboarding shell

The merged `/onboarding` page previously showed non-clickable stage tiles and a direct `Enter reference Exchange` link. The follow-on makes those stages navigable into the Detail Surface hierarchy and removes the bypass. Exchange entry now routes through the readiness branch.

Commercial Membership remains a conditional path rather than a numbered required stage.

## GitHub Pages preview

The nested catch-all route exports every configured source-derived path through `generateStaticParams`. The shared Detail Surface also provides default root props so the existing Pages preview projection can statically render root subjects without creating a parallel preview-only hierarchy implementation.

## Handoff to the authenticated Exchange

Onboarding must populate the same canonical organization truth later used by the authenticated Exchange. It must not create a temporary second organization/profile/capability identity. Once readiness policy activates the organization, the participant enters the existing Exchange shell; ongoing organization management later occurs through Menu and Capabilities using the same underlying records.
