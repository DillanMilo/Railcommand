# Offline daily-log alpha acceptance

Last updated: 2026-08-30

## Scope and classification

New daily logs are **offline draft/queue**: text fields autosave in the
authenticated user's IndexedDB, then an explicit outbox delivers the log and
queued photos. Selected photos become durable when the user queues the log;
they are not included in text-draft autosave. The form warns users to queue
photos before closing it. The neutral recovery form currently supports text
drafts only. Cached project/team/log viewing is **offline read-only**.
Existing-log edits, authentication, project photo-library retrieval, and PDF
generation that requires signed remote images remain **online-only**;
concurrent edit conflict resolution is a later phase.

The acceptance invariant is:

> No entered field work is silently lost, duplicated, or overwritten.

## Required gate

| Scenario | Required result | Automated/backend evidence | Physical-device evidence |
| --- | --- | --- | --- |
| Airplane mode before launch | Neutral shell opens; signed-in user can recover cached data and drafts without another user's data | Browser offline acceptance | Required on iPhone/iPad and Android |
| Network loss halfway through submission | Atomic local queue retains the log and every photo; retry resumes with the same identifiers | IndexedDB transaction and interrupted-upload acceptance | Required with genuine network interruption |
| Connection repeatedly drops and returns | Bounded backoff; no duplicate log or attachments | Retry/idempotency tests and connection-flapping acceptance | Required with unstable mobile/Wi-Fi network |
| App/browser force-closed with pending work | Drafts, outbox operations, and blobs survive restart | Browser restart acceptance | Required in installed PWA/browser |
| Device restarted before synchronization | Same pending work is recovered and synchronized exactly once | Browser relaunch acceptance | Required on physical devices |
| Same operation retried several times | Original server row is returned; counts remain exactly one log and one row per photo | RPC replay acceptance | Covered by backend evidence |
| Permission removed while offline | Server rejects synchronization; local operation remains visibly failed | Permission-revocation backend and browser acceptance | Covered by backend evidence |
| User signs out with pending data | Sign-out is blocked by a live draft/outbox check; user must synchronize, review, cancel, or confirm discard twice | Sign-out safeguard tests and browser acceptance | Required once per target browser family |
| Device storage nearly full | Warning appears at 90%; quota failure is explicit; atomic failure cannot delete the saved draft | Quota classification and transaction tests | Required with a storage-constrained test device |
| Two users edit the same record | Server-version conflict is detected; newer work is never silently overwritten | Deferred: offline editing is not part of the create-only alpha | Required in conflict-resolution phase |

## Advancement rule

Do not merge the offline branch into `main` until every applicable row has
passed. A row may be marked not applicable only when the capability is not
present, as with offline editing in the create-only alpha. Browser viewport
emulation is useful layout coverage but is not physical-device evidence.

## Automated and backend evidence — 2026-08-14

- Thirty-nine focused offline, security, retry, quota, and sign-out tests pass.
- A production build and TypeScript validation pass.
- Three consecutive offline browser reloads retained the same parent log and
  photo operations in IndexedDB.
- A deterministic interruption after the Storage upload but before attachment
  finalization left the photo in retry state. Foreground retry reused the same
  path and idempotency key, resulting in exactly one daily log and one
  attachment.
- Removing the QA user's project membership before reconnect produced a visible
  permanent permission failure. “Synchronize and sign out” kept the user signed
  in and retained the local operation. Restoring permission synchronized that
  exact operation once and then completed sign-out.
- An unfinished draft survived reload, triggered the sign-out safeguard, and
  remained intact after choosing “Review saved draft.” The discard path required
  a separate second confirmation.
- The 90% storage-pressure warning was verified using the development-only
  deterministic acceptance gate. A true constrained-device quota run remains in
  the physical-device column.
- All temporary Auth, profile, membership, log, attachment, and Storage objects
  created by the tests were removed.

## Later reuse

- Punch-list creation: reuse the user-scoped outbox, UUID, permission, retry,
  idempotency, and Sync Center patterns.
- RFI creation: reuse the same architecture with dependency validation.
- Offline edits: add `updated_at` or server-version baselines and an explicit
  conflict-resolution workflow before permitting queued edits.
- Safety and QC reports: extend after daily-log, punch-list, and RFI acceptance.
- Documents, scheduling, RailBot, EarthCam, and administration remain
  online-only initially and must preserve any entered input if connectivity is
  lost.

## Integration evidence — 2026-08-30

Release status: **preview candidate; physical-device gate still open**.

- Integrated offline foundation `2a1958b` with production/main `149c4ce` in
  an isolated worktree. Preserved main's Next.js/Webpack build, lazy demo
  loading, notifications, optional daily-log rows, photo picker, and PDF sharing.
- Runtime IndexedDB tests exposed partial queue commits after synchronous
  storage failure and an invalid draft key in the public recovery queue. Both
  queue paths now abort atomically; the original draft survives failure.
- Thrown create/upload/finalization requests now use the same bounded retry
  path as returned transport errors, retaining operation IDs and photo blobs.
- Involuntary session loss detaches the active offline scope without deleting
  drafts/outbox. Same-user sign-in can reopen them. Intentional sign-out first
  flushes mounted draft autosave and fails closed if persistence cannot finish.
- Sign-in no longer waits for a demo-session cleanup request after successful
  authentication. No account credentials or authentication policies changed.
- Public static cache version advances to v9. Private IndexedDB stays at
  schema version 3; no database reset or backend migration is part of release.
- Existing deployed offline SQL/RPCs were inspected read-only and already
  match the branch. Do not replay migrations or reverse these contracts;
  the mobile client also depends on them.
- Original dirty web checkout and native mobile worktrees were left untouched.
  No customer/user records, accounts, files, memberships, or stored work were
  deleted or changed during integration. Runtime fixtures use in-memory fake
  IndexedDB, not real browser storage or Supabase.
- Final local production build and standalone TypeScript validation passed.
  Focused suites passed: 68 offline/login/data-safety tests, 5 photo/PDF tests,
  and 14 UP-reporting tests. Lint passed with 0 errors and 35 existing warnings.
  CI now runs these focused suites and a production build on pull requests.
- Local public landing-page rendering passed. Localhost intentionally skips
  service-worker registration; it is not evidence of deployed offline startup.
  Production-mode local login correctly rejects an unknown country. Neither
  guard was disabled for testing.

Still required on this integrated revision: dedicated QA account/project
end-to-end synchronization (including photos, expired session recovery and
sign-out), deployed worker/cache acceptance, and every applicable physical
iPhone/iPad and Android row above. Do not substitute historical August 14
evidence, a simulator, or a passing build for these release gates.

Shared-device follow-up within that acceptance: verify an already-open offline
fallback tab hides old-user content when another tab signs out or changes
account. Twelve synthetic runtime regressions now verify that the reader locks on
scope change, guards asynchronous reads, and cannot recreate a deleted database.
Recovered-draft autosave and queueing compare the saved `updatedAt`/client ID
inside the same transaction before writing or deleting. A stale tab cannot
overwrite newer work or resurrect a queued draft; conflicting input remains in
memory with a visible error, not an automatic overwrite or discard.
The follow-up advances only the public static cache to v10, not private IndexedDB.
Positive-path tests also verify the last input is saved into the original user's
existing database on session loss, without changing the other user's draft, and
that autosave followed by queueing retains the latest payload and delivery IDs.
The main app's draft save and queue paths apply the same atomic baseline check,
including two writers racing and queued drafts followed by new drafts. Seven
additional runtime regressions cover those paths. The focused suite now contains
87 offline tests (106 including photo/PDF and UP reporting).
Also verify mounted project UI after involuntary session expiry; existing
in-memory data can remain visible until navigation. These observations must
not be marked passed by the new session-loss storage tests alone.
