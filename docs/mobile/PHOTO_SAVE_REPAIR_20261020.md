# Native photo save repair — October 20, 2026

## Cause and change

Expo FileSystem 57 `File.copy()` returns a Promise on iOS and Android. The native
photo helper started that operation without awaiting it, then immediately read
the destination size. A slow copy therefore raised a missing-file error and
started cleanup before the copy completed. The late file could remain without
SQLite attachment metadata, matching the physical staging failure. The
[Expo change record](https://github.com/expo/expo/blob/main/packages/expo-file-system/CHANGELOG.md)
and the installed Swift/Kotlin implementations confirm the asynchronous contract.

Await the existing copy before checking the size or returning metadata. Both
camera capture and library import share this helper. No schema, database name,
file path, UUID, idempotency key, queued payload or API changes are made.

## Platform/offline impact

- Native iOS/Android: changed bundled file helper; signed app updates required.
- Web/shared workspace: no code change from this native fix. PR #25 supplies the
  separate paginated gallery and bell announcement.
- Shared API/domain/backend: unchanged; authentication, membership/RLS and
  parent-before-photo synchronization remain unchanged.
- Offline classification: **offline draft/queue**. Copy completion must precede
  SQLite photo persistence. Existing draft and photo identities remain stable.
  No resets, sign-outs, queue deletion/reassignment or storage migration is used.
- Installed clients: retain existing APIs and payloads. Update under the same
  bundle/team identity, compare private pre/post draft/queue/file evidence, and
  verify session retention before any release claim.
- The already captured synthetic image remains on the phone and has a private
  readable preservation copy. Do not directly edit the phone's SQLite database
  or delete/reassign the orphan to make acceptance pass.

## Verification

Three executable regression tests run the actual helper with delayed native-copy
completion and rejection. All three fail against the original code and pass with
the fix. They cover camera/import, no early destination read or cleanup, stable
photo/parent/project identity, actual completed size and safe rejected-copy flow.
The complete native suite passes 247 tests and native TypeScript passes using
locked root and mobile workspace dependencies.

Physical staging camera/import, native-to-web photo readback, network/retry and
lifecycle preservation are pending the signed fixed staging update. Physical
Android remains unavailable and must be recorded as a gap, never a pass. The
separate general offline-alpha gate is not advanced by this repair.

## Release

Native source starts at 75d9145 on codex/mobile-beta-20260910; workspace/API-client,
photo helper and package sources are identical to production build 300012 source
6f99e79 before this fix. The isolated branch is codex/mobile-photo-save. Staging
uses mobile-staging.railcommand.io and Supabase rxuvchdqbzvovqijvfhx, verified from
existing EAS preview configuration. Never deploy this older native branch's web
backend to production; main/PR #25 remain the canonical web/backend source.

Build IDs, installation/preservation outcomes and production assignment will be
recorded after actual completion. PR #25 must not be merged on the strength of
these automated checks alone.

## Locked release checks and signed builds

Staging iOS build 300004 (`d7043bc1-0a3c-45db-bd63-0ebcce7e6e8f`) finished
from `a10419f`. Its signed bundle/team/device identity was checked before an
in-place update of `io.railcommand.app.staging`. Every baseline draft/photo/outbox
row and every app-owned file remained unchanged; SQLite integrity passed. No
uninstall, sign-out, purge or direct device-database edit was used. Subsequent
physical capture/sync acceptance remains pending.

Production iOS build 300013 (`1f002d45-76ea-4a28-8851-54a27d7d9bdc`) finished
from `c92e159`; it has not been submitted/distributed yet. The change between
those source revisions is test-only lint cleanup. iOS and Android Hermes exports
passed. Existing EAS signing credentials were reused without modification.

Remote CI exposed inherited test-type/CommonJS lint issues and a false-positive
ref-read report for a factory that stores, but does not call, an account guard.
Corrected test types and documented the specific factory/CommonJS boundaries.
TypeScript emission of all touched application/plugin files was compared against
`c92e159` and is identical after comment removal. Native TypeScript and all 247
native tests pass after the cleanup. Only the photo-copy await changes runtime
behavior.

Expo Doctor using the installed, locked SDK's bundled compatibility inventory
passes 21/21 checks. CI now keeps this deterministic compatibility check as a
release gate and reports online recommendations for newer patches separately.
The online check currently recommends newer Expo 57 patches and React Native
0.86.3. Track their evaluation/update and physical acceptance as
**NATIVE-SDK-PATCH-REFRESH**; no dependency versions or lockfile were changed by
this photo repair. This does not claim the app uses the latest available patches.
