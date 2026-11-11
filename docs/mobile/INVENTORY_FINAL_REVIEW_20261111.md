# Final Inventory review — 11 November 2026

This round stays local, with no merge, push, deployment or existing app replacement.

## Scope and findings under verification

- Finish the old-data technical review using the saved backup. Preserve the missing
  project's history/children and unknown assignments. No guessed repair or blanket
  permission revoke. A clean old-reference result is not claimed.
- Fix the observed first-use contract chooser: a normal PM can register a contract,
  but it was hidden until a purchase already referenced it. Return its ID in the
  immutable registration receipt and use that receipt as explicit project provenance.
  Both final SQL definitions must retain this behavior after catalogue upgrade.
  No old contract is attached to a project by inference; same-org other projects and
  non-finance roles remain excluded. No new table, column or source-data rewrite.
- Use a fresh Xcode simulator as the owner requested. No physical-phone certificate
  or app installation is needed. Keep the earlier, separate QA identity/source copy
  and new synthetic-only backend; do not use restored customer Auth/data as fixtures.
- Current Xcode uses the iOS 27 SDK, while SDK 57 retains the older app lifecycle by
  default. Apply Expo's supported `expo-build-properties` setting
  `ios.enableSceneSupport=true`, with Expo >=57.0.23. Replace the earlier signed
  candidate after rebuilding. Do not hide a production launch issue with a QA-only
  generated-file patch.
  [Expo's supported SDK 57 setting](https://github.com/expo/fyi/blob/main/ios-scene-lifecycle.md#staying-on-sdk-57-with-xcode-27).

## Platform and offline assessment before final verification

Web/native contract UI: shared server fix, existing chooser and refresh behavior.
Shared API: optional `contractId` response field; request/receipt identity unchanged.
Database: unshipped Inventory function definitions only; existing ACL/RLS unchanged.
Native lifecycle: supported generated scene setup on every iOS profile; no app
identifier, keychain group, storage schema or queue payload change. Android uses
unchanged application behavior; do not imply new Android physical acceptance.

Offline classification: contract registration/costs/approvals remain **online-only**;
stock remains **offline read-only** and request input remains **offline drafts**.
No contract/pricing values are added to persistent operational caches. Simulator
restart must preserve the foreman's synthetic draft. No existing user draft is
opened, erased or migrated. Scene lifecycle checks must cover cold-start sign-in
links and restart; simulated results must remain distinct from physical acceptance.

The production backup and all 83 original tables/access definitions must still
match in the isolated migration rehearsal. Required app builds/types, relevant
PostgreSQL tests, grant checks and simulator workflow results are recorded below.
The older 610009 package is superseded by the scene-enabled rebuild;
it must not be uploaded as the final candidate.


## Old-data review completed locally

The final seven Inventory SQL files were applied to another isolated restore of
the saved production archive. Before and after comparisons passed for all **83
original tables**, including their original values/counts, access grants, column
grants, policies, functions, constraints, roles and memberships. The saved archive
checksum remains unchanged. No production connection was used in this round.

The 21 old history entries still reference the same absent project, and 24 punch
assignments still reference a missing profile. Their true ownership is unknown.
All history and assignments remain unchanged. A guarded repair template exists
for confirmed mappings, but no real repair was applied and clean referential
integrity is not claimed. These inherited exceptions are documented separately;
the additive Inventory pilot does not require guessing or deleting them.

The existing 37 authenticated TRUNCATE grants were preserved. No public function
offering TRUNCATE or arbitrary SQL was found, and the current table HTTP routes
do not expose a SQL TRUNCATE operation. Anonymous/nonmember denial checks passed.
This is a bounded access review, not a claim that all inherited security settings
have been independently audited or corrected.

## First-use contract correction verified

Both final contract definitions passed real PostgreSQL tests. A normal PM can now
select a newly registered contract before entering its first cost. Same-org
unrelated projects and field finance access remain excluded. Repeating the same
operation returns the same contract. A real local HTTP check also confirmed the
behavior and that an older unlinked contract remains unassigned and hidden.

Required web build and TypeScript, 44 Inventory tests, static grants, 9 grant parser
tests and preview/reset/legacy-default database fixtures passed. Native TypeScript
and 278 tests passed after the supported scene setting was enabled. The isolated
QA identity copy also passed all 278 tests after its app-name/scheme substitutions
were checked against canonical native source. The final
catalogue and contract PostgreSQL suites passed. Simulator and replacement signed
package results are recorded below.


## Simulator acceptance results

Passed in a **fresh iPhone 17 Pro simulator, iOS 26.5**, using the separate
`io.railcommand.app.reviewqa` identity and a new synthetic-only local backend:

- Cold-start one-time sign-in and native More → Inventory Beta navigation.
- Foreman and inventory lead stock/request access without finance or cost export.
- Stock search, approved-material stock and fractional fuel quantities in US gallons.
- Native cost display: $10,000 held for 365 days at 5% shows $500 carrying cost.
- Actual iOS CSV share sheet; cancelled without sharing, then verified temporary
  CSV removal from only the fresh QA app's container.
- Exactly $50,000 approved by the PM without Supply Chain. $30,000 approved plus
  a $25,000 request on the same contract showed the likely-split warning at $55,000.
- PM approval left the second request awaiting Supply Chain with stock unchanged
  at 100. A distinct Supply Chain actor approved through the native screen; stock
  became 90/version 2 exactly once. The visible trail retains every actor/revision.
- Real cost-review changes correctly denied two stale approval attempts. The first
  request was revised through the native requester screen. The second stale review
  was refreshed through normal synthetic foreman/lead/PM RPCs, then final Supply
  Chain approval was performed in the native screen. This is recorded as mixed
  native/API preparation, not a claim that every retry tap was performed in native.
- A 12.5 US gal request draft retained its quantity, location and reason after
  terminating/relaunching the app while only the new QA proxy was stopped.
  Failed submission retained its durable operation identity. Reconnecting and
  retrying created one request and one submit event; the draft was removed only
  after acceptance. Four user-scoped SQLite Inventory caches contained no finance.

The initial unsigned simulator build could not use secure storage. Rebuilding
with normal Xcode simulator signing enabled supplied its simulated application
identity. An unnecessary manual entitlement experiment was rejected by macOS and
removed; the tested build uses Xcode's normal generated simulator signature and
simulated entitlement section. No production entitlement or business-rule bypass
was used. The supported scene launch setting is present in both QA and production.

The disconnection test made the **test backend unreachable** while Mac internet
stayed connected. It is not airplane-mode, cellular, VoiceOver, physical iOS 27 or
installed-app upgrade acceptance. Those remain explicit follow-ups. No physical
phone, existing app/database/draft, other simulator or protected source checkout
was used as a disposable test target. All synthetic evidence remains private on
this Mac outside Git.

## Release decision and artifact

The old-data technical review and the above simulator checks are complete. Known
legacy missing links/assignments stay preserved as documented exceptions, with
confirmed mappings required before any later repair. No guessed cleanup is a
prerequisite for an additive limited pilot. No independent review is claimed.

Signed production-profile **1.0.0 (610011)** passed deep/strict signature, ZIP CRC,
App Store profile, scene manifest, existing push/app-link entitlements, bundled
JavaScript match and server-credential scan. It supersedes 610009 and stays local;
see [the signing record](INVENTORY_IOS_SIGNING_20261111.md). Its native source tree
matches the tested candidate. Apple build-number availability remains a pre-upload
check; no TestFlight upload or tester assignment occurred.

Before team rollout: review/acknowledge the documented inherited exceptions,
complete independent release review and a brief physical iOS 27 launch/link/restart
smoke on the final distributed build, refresh the production backup/preflight at
the actual release window, then obtain rollout authorization. Backend/web rollout
and the compatible new mobile build must be coordinated. No merge, push,
deployment, production SQL, invitation, existing app replacement or paid resource
creation occurred in this round. The owner's original uncommitted checkout and
saved production archive still match their recorded baselines.


## Further release checks and owner-selected simulator scope

The owner chose to continue with Xcode instead of the physical phone. **No phone
certificate setup is needed for the simulator.** No physical app was installed,
updated, opened, signed out or erased. Read-only connection/installed-app metadata
was collected before that decision. The existing RailCommand apps remain intact.

A separate local development build **610012**, `io.railcommand.app.reviewqa`, was
prepared with the same tested native source and supported scene lifecycle. Its
existing development profile, isolated keychain identity, signature and local
server-secret scan passed. It stays on the Mac, uninstalled; it does not replace
signed distribution candidate 610011. No new provisioning access, paid resource,
cloud build or live connection was needed. The renewed seven-day test certificate
is staged locally only; it was not installed or trusted on the phone.

Additional read-only source/artifact checks passed:

- All mobile routes present in the released source base remain present. The only
  modified released route is the already-tested bootstrap finance projection; the
  Inventory route is additive. Existing authentication, allowlist, sync, recovery,
  photo and RailBot route implementations and mobile authentication helpers remain
  byte-identical to the release base. The two changed helper files are tests.
- The native source tree and all seven SQL hashes still match the tested candidate
  and faithful 83-table preservation rehearsal.
- The signed 610011 distribution package still matches its verified checksum.
- The original dirty checkout's branch, HEAD, main, status and binary-diff checksum,
  and the saved production database archive, still match their recorded baselines.

No application code changed in this continuation. Existing passing builds/tests
remain valid; no redundant database restore or production query was run.

**INV-REL-05 — physical iOS 27 acceptance, explicitly deferred:** before iOS team
release, verify cold launch and sign-in link handling, the primary online workspace,
Inventory navigation and receiving controls, CSV sharing, role privacy, and a saved
field request through actual network loss/restart/reconnection. Verify synthetic
pending-work upgrade preservation before expanding distribution. Use a separate
QA identity/environment or an explicitly approved test project, preserving existing
apps and field work. Current Xcode simulator results do not close this hardware or
final-distributed-build gap. Android/iPad acceptance is not added by this review.

The source and signed package remain local. Independent release review, Apple
build-number availability, fresh production preflight at the eventual rollout
window and explicit rollout authorization remain outstanding. No merge, push,
TestFlight upload, deployment or production data/access change occurred.
