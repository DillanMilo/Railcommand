# Single mobile header and faster collection reads — September 17, 2026

User requests removal of the extra Back/Refresh/Field tools/RailBot toolbar and
reports about three seconds opening Documents and Photos. They report the shared
app is generally working; that is not full action-by-action physical acceptance.

## Implementation and impact

- Native: remove the duplicate toolbar. Keep the web header and bottom navigation.
  Field Tools and native RailBot move into More, enabled only for a native build
  advertising support. Error/empty/offline screens retain direct Field Tools
  access. The online unsaved-form notice moves into More; offline warning remains.
  Hardware Back only intercepts events while Workspace is focused.
- Web and mobile Workspace: Documents and Photos use a read-only GET transport
  to existing getProjectDocuments/getProjectPhotos actions. This bypasses the
  client Server Action queue while retaining existing authentication and per-user
  Supabase/RLS reads. No mutations, grants, schema changes or data maintenance.
- Shared API: additive /api/workspace/projects/[projectId]/[collection] endpoint,
  UUID and collection allowlist, same-origin credentials, private/no-store response,
  controlled errors. Existing actions and all /api/mobile/v1 routes remain.
- Compatibility: builds 300010/300011 retain their toolbar and do not show new More
  tools. The new native build retains the previous navigation-reuse improvement.
  No queue payloads, draft identities, auth/session protections or storage changed.
- Offline classification: **online-only** Workspace lists. Requests fail clearly
  without persistent private-response caching. Mounted forms and native
  **offline draft/queue** state remain intact. Offline/error Field Tools navigation
  preserves access to durable local work. No new offline photos/documents claim.

## Evidence and outstanding checks

Server Action requests are serialized by Next.js on the client; these two hooks
previously queued their collection reads alongside permissions and other actions.
The new client test proves both independent reads start before either resolves;
this is not an on-phone latency measurement. Native navigation reuse from 300011
also remains subject to phone confirmation.
Source: https://nextjs.org/docs/app/getting-started/mutating-data
Supabase SSR guidance was reviewed; no auth method or library changed. Current
changelog breaking changes found concern other features, not this GET transport.

Tests/builds and release IDs will be recorded after verification. Physical checks:
confirm one header, More tools and selected project, offline/reconnect access,
repeat Documents/Photos navigation, and an authorized test export. Full web/mobile
parity and every report type are not claimed accepted by this bounded change.
