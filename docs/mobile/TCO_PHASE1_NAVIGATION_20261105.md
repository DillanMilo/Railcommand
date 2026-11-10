# Phase 1 navigation simplification — local only

## Scope and impact

Replace the single long inventory workspace with Stock, Requests & approvals,
and authorized online Material costs sections, on web and native mobile. Add
case-insensitive material/yard search and request-number/location/reason search.
Collapse stock counts, individual cost details and supporting rules/evidence.
Keep hidden sections and filtered records mounted so navigation never clears inputs.
Requesting a lot opens the request section and returns the viewport to its top.
Search is local to the already authorized snapshot; it does not broaden access.

- Web: InventoryWorkspace and its styles.
- Native: inventory screen; optional Screen scroll ref, default behavior unchanged.
- Shared: presentation-only search helper. No API, database, grants, RLS,
  calculation, approval, idempotency or conflict behavior changes.
- Older installed clients: existing routes/payloads and persisted drafts unchanged.
- Offline: navigation/search are offline-capable on loaded operational data;
  stock remains offline read-only; requests retain existing device draft behavior
  and explicit online submission. Costs, setup and approval remain online-only.
  No financial records enter offline caches, and no new persistence is introduced.
  Closing/restarting retains existing request drafts, not unsaved financial input.
- Rollout: isolated local runtime and separate Phase1 app only. No push, merge,
  hosted database, deployment, production app or user-data mutation.

## Acceptance

1. Default Stock view does not show request forms, cost forms or organization rules.
2. Search supports multiple words, mixed case and no-match/clear states.
3. Request-from-lot opens Requests with the selected lot and existing draft intact.
4. Switching sections, filtering and folding does not clear entered fields.
5. Field users and offline views do not expose Material costs or financial data.
6. Both platforms compile/build; focused inventory tests and required grant gates pass.
7. Browser checks cover narrow viewport, search, navigation and input retention.
   Physical checks require an updated separate Phase1 build; record gaps honestly.

## Existing device evidence

Build 610005 saved exactly one synthetic native opening lot:
0334f943-809f-467a-b064-5b09e5515ce3 (QA1105-NATIVE, QA-SALT, 100 ties,
received 2025-11-05, inspection accepted). Native server confirmation, cleared
form and matching web stock were verified. The existing synthetic purchase source
was selected for the new lot but no native price save was submitted. Native CSV
share/cancel, exact-build offline restart and accessibility checks remain pending.
Device Hub automated swipes are unreliable; normal finger scrolling works. Do not
reset the phone, its data or its apps to work around automation.

## Verification before native packaging

- Web production build, root/native TypeScript, 39 focused inventory tests and
  278 native tests passed. Both iOS and Android JavaScript exports passed.
- Grant static check and all three disposable local database grant scenarios passed.
- Browser: multiword material/yard search, no match and clear; retained count input
  after filtering and section changes; retained unsaved price evidence after section
  changes and an offline/reconnect cycle; direct lot -> request with selected lot;
  390px viewport without horizontal overflow. No approval or financial write sent.
- All original rows in 66 public local tables remain unchanged; exactly seven new
  synthetic stock creation rows exist. No migration or hosted connection changed.
- React review: state scoped by user/project keys; stable record keys and mounted
  hidden panels; no new effects/fetches/private persistence; controls are labelled,
  selected/expanded states exposed and hidden native content excluded from accessibility.
- Native build/device validation for this navigation revision remains pending at this
  checkpoint. The earlier 610005 stock save passed, but native price save, CSV share
  cancellation, exact-build offline restart, VoiceOver and Android hardware remain gaps.

## Local build 610006

- App source: `c09fb362a092d703c2f366acbdc42864c0e65e18` on
  `codex/tco-inventory-audit-phase-1`.
- Release iPhone build, existing development signature and bundled server-secret
  scan passed. Installed in place as `io.railcommand.app.phase1` build 610006.
- Backed up signed 610005 and all Phase1 Documents. All rows and integrity checks
  in all 10 SQLite databases match immediately after installation. Main 300015,
  development 600001 and staging 300004 are unchanged. No uninstall/reset.
- After the user unlocked the phone, iOS accepted launch and the Phase1 process
  was running. The user reported errors but their wording is not yet known.
  Screen control now fails with ScreenCaptureKit audio/video capture failure,
  preventing direct observation. Local trusted HTTPS/backend/auth health returned
  200; a 20-second Phase1-only log sample contained no JS-fatal, TypeError,
  ReferenceError, SSL or network-error markers. This limited sample does not
  establish that the reported error is resolved. Await exact error wording; no
  resets, reinstalls, price submissions or existing-record edits were attempted.
  Physical navigation acceptance remains open.
- Rollback: private `20261105-native-610006/previous-610005.app`; preserve the
  existing app container and compatible local backend when rolling back UI.
- Browser evidence: `evidence/20261105-stock-search.png`. The tab remains open on
  the local synthetic project. Offline/network and viewport overrides were reset.
- Media previews still contain 610005 phone captures; refresh captures after the
  new phone layout is verified. Existing source-labelled media is not proof of
  acceptance for 610006.

## Reported error resolved

The later [local workspace recovery](TCO_PHASE1_LOCAL_WORKSPACE_RECOVERY_20261105.md)
resolved the reported sign-in failure, blank development page and false health
warning. The physical app's primary workspace now opens More -> Inventory Beta,
filters QA1105-NATIVE to 100 ties, retains that search across cost/stock sections
and opens/cancels the iOS CSV share sheet. Its export file was removed after cancel.
The separate native 610006 inventory screen also rendered its new section/search
controls and current data. Native Field-tools filter interactions, native price
save, its separate CSV button, exact-build offline restart, VoiceOver and Android
hardware remain independent acceptance items. The original Mac 3108 origin and
its existing saved request were retained and verified; no browser draft migration.
