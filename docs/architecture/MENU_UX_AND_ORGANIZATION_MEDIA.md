# Menu UX and Organization Media

## Menu experience rule

Menu is navigation and lightweight account/organization management. The production UI must not expose the architecture used to implement it.

Visible Menu surfaces should use:

- short labels;
- row-first navigation with hairline separation;
- one clear back path;
- badges only when they convey user-relevant state, such as unread counts;
- explanatory copy only where the user needs context to complete a task;
- cards only for actual content or summaries, not for every navigation option.

The following are internal implementation concepts and must not appear in member-facing Menu UI:

- cross-lens;
- task surface / submenu / handoff classifications;
- service-boundary names;
- `operational`, `defined`, or integration-state metadata;
- workflow/option counts used only to describe the information architecture;
- architecture notices explaining which repository or database owns a fact.

Progressive availability remains part of the chassis, but visible language should be human: for example `Coming soon` or a disabled control with a concise reason.

## Media ownership

Media is owned by the entity it describes.

| Entity | Where media is set | Card priority |
| --- | --- | --- |
| RFx | RFx create/edit workflow | RFx media first, organization media fallback |
| Resource | Resource create/edit workflow | Resource media first, organization media fallback |
| Organization / Capability discovery | Organization Profile | organization intro video, then organization logo |
| Intelligence | Intelligence/source workflow | visualization/source media first |

Menu does not own media. Menu links into Organization Profile → Logo & Media.

The shared Exchange card contract remains the only card-media renderer. Domain modules provide `ExchangeCardMedia`; they do not create separate video players.

## Organization Profile media

The organization profile supports:

### Logo

A canonical organization logo may be stored on the organization profile and projected anywhere the organization appears.

### Linked introduction video

An organization may link one short introduction video.

Current provider allowlist:

- YouTube
- Vimeo

Rules:

- HTTPS only;
- provider URL is parsed and normalized server-side;
- RFxchange stores provider + provider video ID + canonical URL rather than arbitrary embed markup;
- maximum intended duration is 30 seconds;
- newly linked videos remain `pending` until provider metadata verifies that the duration policy is satisfied;
- only `ready` organization videos may be projected into Exchange discovery cards;
- rejected or unverified media fails closed and does not become discovery media.

The UI may preview a saved pending video inside the organization's own profile while verification completes.

### Future direct upload

The data contract and persistence model reserve a direct RFxchange-hosted introduction video:

- maximum 15 seconds;
- object-storage key rather than database blob;
- server-controlled transcoding/normalization;
- generated poster/thumbnail;
- duration validation before status becomes `ready`;
- one active introduction video per organization.

The upload control remains disabled until object storage, transcoding, malware/media validation, and delivery are connected. No large video binary is stored in PostgreSQL.

## Approved embeds

The client never renders a user-provided iframe string.

RFxchange constructs embeds only from a validated provider and provider ID:

```text
YouTube provider + video ID -> youtube-nocookie.com embed
Vimeo provider + video ID   -> player.vimeo.com embed
```

Any additional provider must be added to the server-side allowlist and receive an explicit parser/embed implementation before user links from that provider are accepted.

## Media fallback order

The shared card presentation resolves media in this order:

1. record video;
2. record image / visualization;
3. organization hero / ready intro video;
4. record logo;
5. organization logo;
6. governed category fallback.

This guarantees that an RFx photo/video or Resource photo/video always represents that specific item, while organization media supplies a useful fallback when the record has no media of its own.

## Persistence

`organization_media` is organization-scoped and holds the single `intro_video` projection. Linked provider media stores no uploaded video binary. Future direct uploads store object-storage references and delivery metadata.

Only organization members with profile-write authority may change logo or introduction media. All changes emit platform activity events.

## Menu and profile handoff

The Menu tree remains deep internally so server policy, destructive flows, and future deep links have stable destinations. Presentation is intentionally flatter:

```text
Menu
  Organization Profile  >
  My Profile             >
  Security & Account     >
  Settings               >
  Referrals              >
  Messages & Notifications >
  Saved & Watchlist      >
  Billing & Membership   >
  Privacy & Data         >
  Help & Support         >
  About RFxchange        >
```

Inside Organization Profile, `Logo & Media` is the organization-owned media editor. RFx and Resource media remain in their respective create/edit workflows.
