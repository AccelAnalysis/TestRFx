# Identity & Onboarding Detail Surface

## Purpose

The Identity & Onboarding Detail Surface is the reusable hierarchical navigator/controller for information and workflows established before a participant enters the authenticated Exchange. It is **not** the authenticated Exchange record-detail controller: it does not mount the persistent map, Exchange result drawer, lens action rail, or bottom lens navigation.

The first implementation proved the top-level subject concept but remained too shallow: it exposed flat subjects, flat form sections, placeholder stage labels, hard-coded example values, and browser `sessionStorage` as a reference Save/Resume mechanism. The deeper implementation removes those mock values and makes the source-defined child/grandchild workflows addressable and routable.

The governing question is now:

> Where am I in the onboarding hierarchy, what child or grandchild workflow is next, which domain owns the real action/data, and how do I return without losing context?

## Chassis boundary

Detail Surface owns:

- focused Identity/Onboarding chrome and responsive composition;
- the governed hierarchical navigation tree;
- canonical nested URL state;
- breadcrumbs and parent/child navigation;
- required / recommended / optional / conditional semantics;
- source traceability for each configured node;
- safe internal `returnTo` continuity;
- links to concrete owning workflows;
- service-boundary metadata where an owning API exists;
- `GET /api/onboarding/detail` as the hierarchy/read-model contract.

Detail Surface does **not** own:

- identity/session persistence or account-verification delivery;
- canonical organization/entity resolution;
- organization membership/authority decisions;
- geocoding, geography rollout policy, or PostGIS persistence;
- Organization Profile persistence;
- AMACS inference, taxonomy persistence, or capability evidence repositories;
- object storage or substantive verification;
- Stripe card collection, billing state, capacity reservation, or entitlement reconciliation;
- final Exchange-readiness policy/activation;
- authenticated Exchange map/detail state.

Those remain domain/service responsibilities. Detail Surface routes into those workflows instead of maintaining a browser-only shadow copy.

## Canonical hierarchy

The canonical top-level Detail Surface subjects are:

1. `account`
2. `organization`
3. `geography`
4. `profile`
5. `capabilities`
6. `membership`
7. `readiness`

Legacy reference routes continue to resolve by redirecting:

- `authority` → Organization → Referral / Invitation → Set Role and Confirm Access
- `capability` → Capabilities → Capabilities Entry
- `evidence` → Capabilities → Evidence / Certifications
- `role-goals` → Profile → Role, Goals & Visibility

These redirects preserve old links without keeping those concepts as parallel top-level data models.

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

The verification leaves are tied to the Account Verification service boundary rather than implemented as fake Detail-Surface fields.

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

This preserves the source distinction between affiliation choice, claim/create resolution, organization setup/detail, and invitation entry.

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

Primary geography, physical address, public map precision, and service geography remain separate concepts.

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

The Profile workflow remains the canonical owner of organization identity/contact/visibility information.

### Capability Enrichment

The source-defined six-step enrichment structure is represented directly:

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

The current Capability Enrichment branch does not expose a server API for canonical AMACS/evidence persistence. Detail Surface therefore delegates to `/onboarding/capabilities` and deliberately does **not** substitute a fake capability API. A real AMACS/evidence/object-storage service can plug in later without changing the hierarchy.

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

The Registration source includes Founding Membership and Stripe payment. The current platform direction also preserves a free participation path; payment is therefore conditional rather than a universal Exchange-readiness gate. Detail Surface never collects card data.

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

The Readiness service remains authoritative for blocking state and activation. The hierarchy merely routes users to the issue or activation workflow.

## Nested route contract

Root subject:

```text
/onboarding/detail/[subject]
```

Child / grandchild / deeper workflow:

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

The route itself is the nested navigation state. Browser refresh and deep links therefore restore the exact node rather than reconstructing the hierarchy from ephemeral component state.

`returnTo` is sanitized to an internal path and preserved while navigating the Detail Surface tree.

## Concrete workflow/service ownership

| Detail area | Owning workflow | Existing service boundary |
|---|---|---|
| Account creation | `/register` | Registration-owned identity adapter |
| Email/access verification | `/onboarding/account-verification` | `POST /api/identity/account-verification` |
| Organization resolution | `/onboarding/organization` | `GET /api/onboarding/organizations` |
| Geography | `/onboarding/geography` | `POST /api/onboarding/geography` |
| Organization Profile | `/onboarding/organization-profile` | `POST /api/onboarding/organization-profile` |
| Capability Enrichment | `/onboarding/capabilities` | No canonical server API currently exposed; do not fake one |
| Membership | `/onboarding/membership` | `GET /api/membership/catalog`; checkout remains Membership-owned |
| Readiness | `/onboarding/completion` | `GET /api/onboarding/readiness` |
| Exchange activation | `/onboarding/completion` | `POST /api/onboarding/readiness/activate` |

The Detail Surface UI shows this boundary at the active node and opens the owning workflow for actual mutation/validation.

## Mock-removal rule

The deeper implementation removes:

- hard-coded example users and organizations from Detail Surface;
- fake field values and fake completion states;
- browser `sessionStorage` as Detail Surface persistence;
- client-side required-field validation pretending to be domain validation;
- a Detail-Surface-specific Save command that could diverge from the canonical domain repository.

Static hierarchy configuration is not domain data; it is the shell navigation contract. Domain data must come from the owning services/workflows.

If an owning production service is unavailable, the UI should remain explicit about that boundary. It must not manufacture a successful save, verification, geocode, AMACS mapping, evidence upload, payment, or activation result.

## Source traceability

The hierarchy is limited to children actually represented in the supplied Onboarding, Registration, and Capabilities flows or the previously agreed Detail Surface structure. The source-specific items restored in this revision include:

- Welcome / Role Selection;
- Join Existing Organization / Create New Organization;
- Validate Invitation → Accept and Join → Set Role and Confirm Access;
- Organization Name / Type / Location-Geography / Visibility Preferences;
- Registration organization details (Description, optional Industry/NAICS, Website/Contact);
- county/city/region geography search;
- physical address → geocode → marker placement;
- the six-step Organization / Capabilities Enrichment sequence;
- verification resend/change-email exception paths;
- Membership Selection and Payment (Stripe) children;
- completeness check, actionable missing items, save/continue later, and completeness indicator;
- Exchange-ready presence, four-lens browsing, and Profile-through-Menu outcomes.

No unrelated lens, referral navigation item, or separate onboarding-only application is introduced.

## Convergence with parallel onboarding branches

This branch continues to avoid copying the forms currently owned by the parallel Identity/Onboarding PRs. After those branches converge, their pages can deep-link into the hierarchy and return via `returnTo` while keeping their domain APIs/repositories authoritative.

That means:

- Organization Selection / Creation owns search, duplicate resolution, claim/join/create, and membership/authority decisions.
- Geography owns geography policy, geocoding/provider integration, privacy, service area, and PostGIS persistence.
- Organization Profile owns canonical profile/contact/role/goal/visibility persistence.
- Capability Enrichment owns capability claims, AMACS integration, evidence, discoverability, and publication intent.
- Membership owns plan catalog, capacity, Stripe checkout, payment reconciliation, and entitlement state.
- Exchange-ready Completion owns blocking readiness and activation.

Detail Surface remains the stable shell-level hierarchy and continuity contract around those modules.

## Handoff to the authenticated Exchange

Onboarding must populate the same canonical organization truth later used by the authenticated Exchange. It must not create a temporary second organization/profile/capability identity. Once readiness policy activates the organization, the participant enters the existing Exchange shell; ongoing organization management later occurs through Menu and Capabilities using the same underlying records.
