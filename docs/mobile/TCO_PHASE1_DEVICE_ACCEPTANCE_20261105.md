# Separate Phase1 iPhone update · 5 November 2026

Local acceptance against app source `4558ce9c90c07bad3e067a3fa7f7e1d034dd3f31`
on `codex/tco-inventory-audit-phase-1`. This record supplements
[the first-use implementation](TCO_PHASE1_FIRST_USE_IMPLEMENTATION_20261105.md).
It does not declare live-release readiness.

## Installed build and preservation

- Signed and installed **610005**, bundle `io.railcommand.app.phase1`, in place.
  No uninstall, app-container reset, keychain reset or provisioning change.
- Main app 300015, development app 600001 and staging app 300004 retained their
  existing bundle identifiers/versions. Only the separate Phase1 app was updated.
- Before installation, backed up Phase1 Documents and the previous signed 610004
  app. All rows in all 10 SQLite databases matched immediately after installation;
  SQLite integrity checks passed. After native refreshes, drafts/outboxes/photos
  and sync-history tables still match; only operational cache records refreshed.
- Read-only fingerprints cover every existing row in 66 local public tables.
  No pre-existing row changed or disappeared during these device checks.
- Original dirty checkout's branch, HEAD, main, status and binary diff hash still
  match the preservation checkpoint. No hosted backend, production user data,
  merge, push, deployment, cloud build or paid service was used.

Private manifests, signed rollback app, database copies, fingerprints and logs
remain under the persistent Phase1Local `private/backups/20261105-native-610005`
folder. They are not committed or bundled in media.

## Physical observations completed

- Separate Phase1 app launches on the connected physical iPhone and reaches the
  persistent local backend over the already trusted local HTTPS connection.
- Native More → Inventory has the Beta label. Foreman view loads accepted stock,
  uses book-availability wording and omits financial/setup controls.
- Authenticated native refresh shows the current 5 November server snapshot.
- PM view exposes Add stock and Choose approvers at the top. Named invited-member
  choices and the existing lead selection are visible. No assignments were changed.
- PM sees the delivered-price test lot created on the web in the previous change:
  acquisition 12000 ($120/tie), installed 14300, future disposal 500, accrued
  carrying visibly unknown because receipt date is unknown. No competing upstream
  acquisition subtotal or invented zero is shown. This is **web → native** parity.
- Native history shows actor/time/action records and previous Supply Chain approval.
  Existing requests and prices were not edited for this observation.
- Native Add stock saved QA1105-NATIVE in QA-SALT: 100 ties, received
  2025-11-05, inspection accepted. Lot ID
  `0334f943-809f-467a-b064-5b09e5515ce3` matches the web and SQL receipt.
  Server confirmation appeared, the form cleared and no duplicate save was sent.
  Exactly seven synthetic rows were appended; every pre-existing row is unchanged.
  No native financial save is claimed.

## Remaining bounded device checks

1. **P1-DEVICE-01:** native creation and native → web agreement passed.
   Physical setup fold/disconnection retention remains a follow-up; automated
   receipt recovery already passed without duplicates.
2. **P1-DEVICE-02:** save delivered pricing on that new synthetic lot from native;
   verify web agreement and no double counting. Existing prices/history stay intact.
3. **P1-DEVICE-03:** invoke native CSV, confirm the iOS share sheet, cancel without
   external transmission, and verify authorization and column/value parity.
4. **P1-DEVICE-04:** VoiceOver labels/focus/announcements, offline field-draft app
   restart on this exact build, and Android physical acceptance remain pending.

Device Hub taps recovered after explicitly focusing its title bar. Automated
swipes remain unreliable and can fling the long screen to the opposite end;
normal finger scrolling works. Keyboard capture is off. Do not reset the phone
or repeat unlock/foreground requests as though they resolve this tool limitation.
The user requested simpler navigation, search and collapsible components instead;
see [the navigation change](TCO_PHASE1_NAVIGATION_20261105.md).

## Cross-platform / offline impact

This turn installs previously verified bundled UI and records acceptance; it adds
no API, RLS, schema, policy, membership or app-source change. Web implementation,
shared calculations, compatibility protections, 37 focused tests, 278 native tests,
TypeScript/builds and real Postgres suites are recorded in the linked implementation.

Requests remain **offline draft/queue (drafts only, online submission)**; cached
stock is **offline read-only**. Setup/pricing/approvals/CSV are **online-only**.
Setup/pricing input survives a temporary disconnection in the active screen, not
app termination. Existing draft UUIDs, outboxes, authorization and conflict rules
are unchanged. No price data was added to the private operational cache or public SW.

Older installed clients still depend on the additive version-2 cost capability and
legacy-write guard documented in the implementation. Do not roll those protections
back after delivered-price revisions exist. Build 610004's signed backup is a UI
rollback option only; preserve the current compatible backend and app container.

The refreshed Remotion previews live in the separate local media repository on
`codex/tco-beta-videos`: 38-second silent promo, 195-second American-male narrated
guide. Current desktop images and a real native foreman screenshot contain only
synthetic data. Their existence does not close the outstanding device gates.

## Navigation follow-up

The subsequent navigation/search change is app source
`c09fb362a092d703c2f366acbdc42864c0e65e18`, installed locally as **610006**.
It separates Stock, Requests & approvals and authorized online Material costs,
adds local snapshot search and folds supporting forms/evidence. See
[the full impact and acceptance record](TCO_PHASE1_NAVIGATION_20261105.md).
All 10 SQLite databases matched across the in-place update and other apps retained
their versions. After unlock, iOS accepted launch and the Phase1 process was
running. The user reported errors; screen capture currently fails before the
window can be observed. Backend/HTTPS/auth health is 200 and a brief app-only log
sample has no fatal-JS/SSL/network error markers, but the reported error remains
unidentified. Exact wording was requested. No further data writes or resets.

## Local sign-in/loading recovery completed

The [recovery record](TCO_PHASE1_LOCAL_WORKSPACE_RECOVERY_20261105.md) supersedes the
unidentified-error status above. Physical phone verification now covers the working
primary workspace dashboard, More -> Inventory Beta, stock search with the correct
100-tie lot and costs/stock switching. CSV reached the iOS share sheet through the
workspace bridge; cancellation sent nothing and removed the temporary file. The
separate native Inventory screen opened with 610006 controls/current snapshot, but
its own CSV button and price-save path remain pending. Ten SQLite databases retain
all saved draft/outbox/photo/sync-history rows; only cache records refreshed. All
four installed app versions and the original dirty checkout/main are unchanged.
