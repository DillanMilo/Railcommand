# RailCommand mobile egress audit — 2026-09-02

## Scope and safety

This was a local-repository-only audit and hardening pass. It did not deploy,
publish, query or mutate a hosted database, change Supabase/Vercel settings,
read customer records, change secrets, or alter production.

## Attribution

The exact source of the reported organization-level uncached egress cannot be
proven from source code alone. Supabase aggregates egress across projects in an
organization, so staging traffic can contribute to the same usage allowance as
production when both projects share an organization.

The previous mobile acceptance runner used staging only and transferred a few
synthetic records plus a tiny synthetic PNG. Local unit tests use mocked
transports. Those runs can contribute a small amount to organization usage but
do not plausibly explain a large spike unless a separate retry loop or large
asset workflow was active.

Higher-risk paths found in the existing web application include:

- the project photo gallery can list up to 1,000 attachment rows, create signed
  URLs for the complete returned collection, and render all thumbnail images;
- shared web attachment helpers can create signed URLs for complete attachment
  collections;
- several existing web actions still use broad `select('*')` projections; and
- the generic web query hook refetches on component lifecycle changes without a
  shared request cache.

The mobile app itself already keeps full-resolution record attachments
on-demand: record detail returns text and attachment metadata only, and one
short-lived signed URL is requested only after the user chooses one attachment.

## Changes made

- Development and staging mobile builds now reject the checked-in production
  project/host inventory even if an environment-provided denylist is missing or
  wrong. Guard output no longer prints service URLs, hosts, project references,
  keys, or secrets.
- Development builds may explicitly use loopback Supabase and API services.
  Staging and production still require HTTPS.
- Mobile bootstrap lists are bounded. Daily logs, RFIs, and submittals accept
  bounded offset/limit pagination (default 90, maximum 100) and expose `hasMore`
  metadata. Project, team, camera, and punch reference queries also have caps.
- Mobile record detail no longer selects every database column.
- Identical concurrent GETs are coalesced by the mobile API client and project
  bootstrap loads are coalesced in the provider.
- Recently synchronized bootstrap and record-detail caches are reused for 60
  seconds. Manual refresh remains an explicit forced refresh. Foreground or
  reconnect synchronization no longer forces an unchanged bootstrap after an
  empty outbox.
- Development builds report only operation category, request count, status and
  approximate request/response body bytes. They do not record payloads, URLs,
  IDs, tokens, project references, or personal data.
- Existing on-demand attachment loading remains intact and now has a focused
  client test.

## Offline assessment

- Environment selection: **online-only configuration**. Startup fails clearly
  when the configured service inventory is unsafe.
- Bootstrap and record text: **offline read-only**. Recently synchronized,
  user-scoped SQLite data remains available and unchanged by this pass.
- Daily-log drafts/outbox/photos: **offline draft/queue**. Existing durable,
  idempotent parent-before-photo synchronization is unchanged.
- Existing record attachments: **online-only**. Text remains available offline;
  a signed asset URL is generated only after an explicit open action.

## Verification

- `npm run test:mobile`: PASS — 504 tests across domain, offline, API client,
  Expo mobile, mobile API, and link-association suites.
- `npm run test:mobile-env`: PASS — 13 tests.
- Domain, API-client, Expo-mobile, and root `tsc --noEmit`: PASS.
- ESLint over every changed TypeScript/TSX file: PASS, zero findings.
- `npm run build -- --webpack`: PASS.
- Expo development export for iOS and Android: PASS.
- Exported iOS/Android bundle scan: PASS — production project reference absent.
- `git diff --check`: PASS.

## Remaining risks and approvals

- Source inspection is not usage attribution. Use the Supabase organization
  usage page's per-project filter and Storage/API breakdown to identify the
  project and service responsible for the spike.
- The web photo gallery and broad legacy web queries remain production egress
  risks. They were intentionally not changed in this mobile-only pass.
- Bootstrap intentionally caches only the newest page for v1 offline viewing;
  the current UI does not claim complete offline history.
- Caps of 200 projects/team members, 100 camera embeds, and 500 punch items are
  explicit safety bounds. A later product decision can add UI paging if real
  customers exceed them.
- No configuration or deployment was changed. Explicit approval is still
  required before integrating this recovered mobile source, deploying it to
  staging, or changing any production mobile backend inventory.
