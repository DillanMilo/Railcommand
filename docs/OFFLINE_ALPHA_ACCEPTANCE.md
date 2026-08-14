# Offline daily-log alpha acceptance

Last updated: 2026-08-14

## Scope and classification

Daily-log creation, drafts, photos, and foreground synchronization are
**offline-capable**. Entered work is stored immediately in the authenticated
user's IndexedDB database, then delivered through an explicit outbox. Daily-log
edits remain online-only; concurrent edit conflict resolution is a later phase.

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
