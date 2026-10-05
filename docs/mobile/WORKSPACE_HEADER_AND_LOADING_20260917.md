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

Validation: 234 native tests and 20 targeted Workspace/auth/cache tests pass;
mobile TypeScript, focused lint, backend production build and TypeScript pass.
Candidate web production build and TypeScript also pass in a tracked-source
snapshot with clean typeRoots, excluding pre-existing Finder duplicate @types
folders without modifying source dependencies. Backend CI 35274634096 passed
on runtime 8e31314; documentation follow-up CI 35275186204 also passed; native runtime is 6f99e79.

Release: backend 8e31314 is live as dpl_Ecd6PajWijoFUJKaBt8qQNqSbSui.
Five auth/no-store checks and two collection unauthenticated-denial checks pass
on staged/live endpoints. The collection requests are denied by existing login
middleware (307 with no project data); authenticated handler responses are
private/no-store, verified in focused tests. Staged handoff checks used the
authorized Vercel protection bypass; a direct protected request returns Vercel's
SSO redirect and is not evidence about the application handler.
A fresh live-domain inspection confirmed this deployment; the post-promotion
10-minute error scan returned no entries. Rollback: dpl_5RfdY5kutDSpjCPkter7aWFhfPxn.

Production iOS build 300012: a59d9feb-7eaf-40ad-9ae2-30b4f4d74a83;
EAS build FINISHED. The queued Expo submission
c9948436-c181-43c3-8c4f-de6b7888e97b was confirmed CANCELED before direct
submission, avoiding duplicate upload of the same version. Apple's altool first
validated the unchanged IPA successfully, then uploaded it successfully at
2026-09-17 21:35:04 UTC with no errors. Delivery UUID:
63f090af-3c0d-49d9-93c6-2eded1603260. Artifact identity was verified as
io.railcommand.app / 1.0.0 / 300012, source 6f99e79; SHA256:
bc2a85646ce9d3c16fae518332f2488ac4ff74dd28443e8c9713b156579901da.
The existing app-specific submission credential was used through a private
short-lived file; cleanup was verified after validation and upload. Apple
processing completed successfully. Apple build 63f090af-3c0d-49d9-93c6-2eded1603260 is VALID
and IN_BETA_TESTING. Assignment was read back in the existing internal group
b92ba7eb-1a88-40ec-8af2-f38c499dee30 (RailCommand Private Beta), verified to contain
only dillanxx@gmail.com with public links disabled. This confirms tester
availability, not installation or physical acceptance. No Mark/Caleb release.
Build 300011 is superseded by this combined update;
do not ask the tester to install it first. No external distribution, schema,
permissions, live-record test writes or device queue changes accompany this patch.

Physical checks:
confirm one header, More tools and selected project, offline/reconnect access,
repeat Documents/Photos navigation, and an authorized test export. Full web/mobile
parity and every report type are not claimed accepted by this bounded change.
