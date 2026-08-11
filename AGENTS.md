# RailCommand Repository Instructions

These instructions apply to the entire repository. Read them before planning,
implementing, or reviewing changes.

## Offline mode is a first-class design constraint

Every new feature and every material change to an existing feature must include
an explicit offline-mode assessment. Do not wait until the end of implementation
to consider offline behavior.

At planning time, classify the feature as one of:

1. **Offline-capable** — reads and writes work locally and synchronize later.
2. **Offline read-only** — previously synchronized data can be viewed, but not changed.
3. **Offline draft/queue** — user input is preserved locally and submitted when online.
4. **Online-only** — connectivity is inherently required. The UI must say so clearly and
   must not discard user input when the connection is lost.

Include the classification and a short rationale in the implementation plan and
final handoff. An online-only classification is acceptable when justified; silently
ignoring offline behavior is not.

## Required offline design review

For each feature, consider all applicable items:

- What project data must be available after the device loses connectivity?
- Can users create or edit records offline? If not, should the form autosave a draft?
- What dependencies must be synchronized first?
- Does a queued mutation have a client UUID and an idempotency key so retries cannot
  create duplicates?
- How will concurrent server changes be detected and resolved? Use a server version or
  `updated_at` baseline; do not silently overwrite newer work.
- Are permissions, membership, and RLS revalidated when queued work reaches the server?
- Are server-assigned values such as entity numbers left for the server to assign?
- Do files, photos, signatures, or other blobs need quota limits, compression, retry
  state, and parent-before-attachment ordering?
- What does the user see while offline, pending synchronization, failed, conflicted,
  or synchronized?
- What happens if the app is closed, the device restarts, the user signs out, storage
  is full, or connectivity repeatedly drops and returns?
- What automated and device-level offline tests are required?

## Offline architecture and security invariants

- Treat `public/sw.js` as a public static-asset cache only. Never cache authenticated
  HTML, React Server Component payloads, API responses, Supabase responses, signed URLs,
  or project records in Cache Storage.
- Store private offline data in the user-scoped IndexedDB foundation in
  `src/lib/offline/storage.ts`. Do not store project records or queued mutations in
  global `localStorage` keys.
- Keep offline databases partitioned by authenticated user. Sign-out must remove that
  user's offline database and any legacy/private RailCommand caches.
- The local database is a cache and outbox, not an authorization boundary. Every queued
  operation must be authenticated and authorized again on the server during sync.
- Prefer immediate local persistence and an explicit outbox over intercepting or replaying
  arbitrary Server Action requests in the service worker.
- Foreground synchronization is the guaranteed path. Browser Background Sync may enhance
  it, but core correctness must not depend on Background Sync being available.
- Preserve entered field work. Never silently drop, duplicate, or overwrite queued work.
- Keep the neutral `/offline.html` fallback functional even when no authenticated project
  data is available locally.

## Current offline rollout

- **Day 1 complete and accepted:** static-only service-worker policy, user-scoped
  IndexedDB schema, connectivity state, last-refresh metadata, offline UI, sign-out
  cleanup, and focused security tests. Deployed-browser acceptance verified worker
  activation, the public cache boundary, and A→B→A shared-device database isolation
  with non-human QA accounts. A real network-offline run against the exact accepted
  commit verified that the neutral shell opens without exposing the signed-in QA user
  or project.
- **Day 2 offline read-only project data complete locally:** the active project, team
  reference, and latest 90 daily logs are cached in the signed-in user's IndexedDB
  after an authenticated membership/RLS check. Project records refresh after 24 hours,
  team references after 1 hour, and daily logs after 15 minutes. Stale copies remain
  visibly read-only while offline and are discarded after 30 days (projects/logs) or
  7 days (team). A real network-offline restart test verified cached daily-log list and
  detail viewing. The public service-worker cache remains static-only.
- Later phases will add daily-log drafts/creation, the mutation outbox, synchronization,
  photos, punch items, RFIs, and conflict handling.

Until those later phases land, do not describe RailCommand as supporting full offline
project work. Distinguish the installable PWA/offline fallback from data-aware offline mode.

## Feature completion checklist

A feature is ready for handoff only when:

- Its offline classification and behavior are documented.
- Offline transitions do not lose user input.
- Private data stays out of public/shared caches.
- Relevant sync, retry, idempotency, authorization, and conflict cases are tested or
  explicitly deferred with a tracked follow-up.
- Online-only controls fail clearly and safely while disconnected.
- `npm run build`, `npx tsc --noEmit`, and relevant focused tests pass.
