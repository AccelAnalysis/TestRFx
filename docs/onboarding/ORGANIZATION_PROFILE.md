# Identity & Onboarding — Organization Profile

## Purpose

Organization Profile is the bridge between organization selection/geography and Capability Enrichment. It establishes the canonical organization identity that the authenticated RFxchange Exchange later reuses in RFx, Resources, Intelligence, Capabilities, referrals, organization detail, and Menu administration.

It is **not** an onboarding-only duplicate of the organization record.

## Chassis placement

```text
Identity & Onboarding Shell
  Account verification
  -> Organization selection / creation
  -> Geography
  -> Organization Profile
  -> Capability Enrichment
  -> Exchange-ready completion
```

This route deliberately does not mount the authenticated map/drawer/bottom-navigation chassis. It prepares the organization context consumed by that chassis.

## Organization Profile boundary

This step owns the minimum Profile Complete identity:

- organization display identity and overview
- multi-role participation model
- primary organizational contact
- primary operating address
- based-here vs service-geography distinction
- public location precision and visibility preferences
- onboarding goals / first-value intent
- one plain-language capability seed

The following stay downstream or elsewhere:

- detailed capability modeling
- AI -> AMACS mapping
- capability evidence and certifications
- independent organization/capability verification
- user credentials and MFA
- membership/billing/credits
- referral management
- RFx response and teaming workflows

## Canonical identity rule

`organizations` remains the administrative organization/tenant anchor. `organization_profiles` is a linked 1:1 Exchange-facing profile projection. The profile is created during onboarding and later edited through Menu -> Organization Profile; downstream lenses consume the same organization identity instead of creating lens-specific copies.

## Geography rule

Where an organization is based is not the same as where it can provide service.

- `locations.address` stores the authoritative address.
- `locations.point` stores the confirmed geocode.
- `locations.service_area` stores the service territory when production geospatial enrichment is available.
- `organization_profiles.visibility.locationPrecision` governs what the public/member projection may show.

The reference UI intentionally displays a geocoding confirmation seam instead of inventing coordinates.

## Completion rule

The API marks the reference profile complete only when it has:

- identity
- primary contact
- primary location
- service geography
- at least one organization role
- visibility state
- at least one first-value goal
- a meaningful capability seed

`profile_complete` does **not** mean `verified`, and a capability seed is not an independently verified capability claim.

## API boundary

`POST /api/onboarding/organization-profile`

The route validates and normalizes the profile payload, returns the canonical organization identifier, exposes the Profile Complete checklist, and hands off to `step=capability-enrichment`.

The TestRFx adapter is intentionally stateless. Production should replace it behind the same boundary with:

- authenticated active-user and active-organization resolution
- server-side organization membership / authority checks
- organization profile and contact persistence
- geocoding + user confirmation
- location and service-area persistence in PostGIS
- audit/activity events
- duplicate/entity-resolution protections
- logo/media object storage
- verification workflow integration
- server-enforced visibility and authorization projections

## Data extension

`db/organization-profile.sql` adds the reference `organization_profiles` and `organization_contacts` persistence targets while preserving the chassis `organizations`, `organization_memberships`, and `locations` tables.

## Route contract

Reference route:

```text
/onboarding/organization-profile
  ?organization=<canonical-or-provisional-id>
  &name=<resolved-organization-name>
  &claim=claimed|created|selected
  &geography=<primary-geography>
  &returnTo=<safe-relative-path>
```

The page accepts missing query context so it can still be reviewed independently, but production onboarding should normally arrive with organization and geography already resolved by prior steps.
