# Public / Acquisition — About, Legal, and Footer Destinations

## Architectural rule

This module is a public information and trust subsystem inside the RFxchange Public / Acquisition shell. It does not create another application shell and it does not own registration, login, marketing audience pages, or pricing/membership.

The Marketing source establishes these public routes and footer groups:

- Explore: `/how-it-works`, `/businesses`, `/buyers`, `/resource-providers`, `/founding`
- Organization: `/about`, `/join`, `/signin`, `/image-credits`
- Bottom Matter: `/terms`, `/privacy`, `/platform-rules`, `/accessibility`

`lib/public/destinations.ts` is the route and ownership registry used by the shared public header and footer.

## Owned destinations

This module owns the actual information surfaces for:

- `/about`
- `/image-credits`
- `/terms`
- `/privacy`
- `/platform-rules`
- `/accessibility`

The route implementation is intentionally shared through `app/(public-info)/[slug]/page.tsx`; the destination registry decides whether a route renders a public-information page, redirects into Identity, or presents a bounded integration surface for a sibling Public-shell module.

## Cross-shell handoffs

The Marketing source names `/join` and `/signin`, while the operating chassis already owns `/register` and `/login`. The public route registry preserves the source-facing URLs and redirects them into the existing Identity shell:

```text
/join   -> /register
/signin -> /login
```

The public subsystem must not duplicate authentication or onboarding forms.

## Sibling Public-shell ownership

The footer also links to Marketing and Pricing destinations. Until those modules add their static routes, the dynamic public route renders an explicit integration surface. Static routes added by sibling modules take precedence without requiring footer changes.

```text
/how-it-works         -> Marketing
/businesses           -> Marketing
/buyers               -> Marketing
/resource-providers   -> Marketing
/founding             -> Pricing / Membership
```

## Legal and governance lifecycle

The rendered Terms and Privacy pages in TestRFx are reference architecture, not final production legal text. `db/public-governance.sql` provides a production-target persistence extension for:

- versioned legal documents and effective dates;
- auditable policy acceptance by user and optional organization context;
- public media attribution metadata.

A production deployment should publish approved document versions and link any required acceptance event to the exact stored version.

## Accessibility boundary

Public information pages use semantic navigation, links, headings, lists, and responsive layouts. The Accessibility destination also preserves operating-chassis requirements: non-gesture alternatives for drawer movement, reduced-motion behavior, and list-based access to records that may not have map coordinates. It does not claim a formal conformance certification.

## Integration contract

Other Public / Acquisition modules should import `PublicHeader` and `PublicFooter` rather than recreating public navigation or bottom matter. The canonical destination registry is the shared contract; page ownership remains with the relevant product area.
