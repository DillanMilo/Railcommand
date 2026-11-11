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
PostgreSQL tests, grant checks and simulator workflow results are recorded below
once verified. The older 610009 package is superseded by the scene-enabled rebuild;
it must not be uploaded as the final candidate.
