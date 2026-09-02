# Bounded client finish pass — 2026-08-30

Status: **this client-polish pass is complete; full application/release acceptance is not complete.**
Started at 08:52 America/Chicago; implementation and simulator verification finished
around 09:10, within the 45-minute limit. No additional modules or dependencies were added.

**Latest readiness follow-up:** the [backend/beta readiness report](BACKEND_READINESS_2026-08-30.md)
now includes read-only inspection of the actual existing backend, confirmed
compatibility/security gaps, and locally tested TestFlight configuration. No live
data/backend changes or TestFlight upload were made. The integration entries below
retain the earlier implementation/deployment history; they are not launch acceptance.

**Integration update:** the user subsequently approved the bounded staging-only
slice. Its [preflight and access handoff](STAGING_INTEGRATION_2026-08-30.md) records
the verified Vercel target and existing preview health. Staging Supabase access is
now verified; inspection found missing web-contract tables/fields and daily-log
child read permissions. The user approved the minimal staging extension; it is
applied and rollback-only database checks passed with zero leftover fixtures.
The subsequently approved Step 1 Preview is now Ready at deployment
`dpl_8JCGcAzdPquFkSm9Auw3dm4kmUum`; build, health, unauthenticated rejection,
and unchanged custom-domain checks passed. See the integration report for exact
evidence and remaining signed-in HTTP/device gates. The installed Expo app was
not updated and production remains untouched.

## Latest follow-up: record request lifetimes — completed locally

The final bounded client-only change applies the existing account/session and
storage-purge safeguards to the newer RFI/Submittal forms, details, attachment
lookups, and PDF exports. A late response after account/project changes cannot
update the replacement screen, persist an old receipt/options result, or start
later file/share work. The same-owner success path keeps its original client ID.
An already-dispatched server request cannot be undone; server-side authorization
and idempotency acceptance remain staging requirements.

| Check | Result |
| --- | --- |
| Full `npm run test:mobile` chain | **250 passing**: domain 13, offline 5, API client 10, native client 182, mobile API 37, links 3 |
| Additional behavioral coverage | 6 record-create lifecycle tests, 13 detail/report cancellation tests, and 1 SQLite stale-read/receipt-cleanup test |
| Mobile/root TypeScript, mobile lint, `git diff --check` | Passed |
| Root compatibility build | `npm run build -- --webpack` passed locally; default Turbopack limitation unchanged |
| iOS and Android Hermes exports | Passed at `/private/tmp/railcommand-mobile-record-scope-export-XMPliy`; **bundle exports only**, not new native builds, installations, or device acceptance |

The new tests exercise component/adapter behavior with mocked native/auth/network
boundaries, plus real in-memory SQLite behind the native bridge stub. They do not
prove live-server authorization or operating-system file/share behavior. The
simulator evidence below predates this final record-wiring change.

Offline classification is unchanged: cached record text is **offline read-only**;
record forms preserve **offline drafts with online-only submission**; attachment
retrieval and PDF export are **online-only**. No additional outbox or public cache
was introduced. Supabase session guidance and React lifecycle checks informed reuse
of the existing guards; environment-separation guidance kept local builds limited
to public staging configuration.

The client-only follow-ups above made no backend change, upload, deployment, or
main merge. The subsequently approved staging integration is tracked separately
at the top of this document; it does not authorize production connection.

## Follow-up: account/project lifecycle — completed locally at 09:37

One concrete client-only safety slice followed the polish pass. It does not change
the release status or authorize staging/production integration.

- Auth events synchronously invalidate the previous account lifetime, including
  A → B → A events before a render. A delayed initial session lookup cannot replace
  a newer auth event. Same-owner token refresh does not reset the application.
- The data provider resets state/locks at an account boundary. Latest project
  selection wins over delayed success, failure, and loading completion. Project
  projections remove unrelated logs/team/module data and metrics immediately,
  while retaining the canonical cached snapshot for an offline P → Q → P return.
- Bootstrap and outbox API calls bind token lookup, 401 refresh/replay, and actual
  dispatch to the initiating account lifetime. No request intentionally replays
  A's work with B's token.
- Purge invalidates pre-existing storage work before waiting for a pending database
  open, closing/deleting it, and removing owned files. Wrong-owner bootstrap data
  cannot be cached or read. Stale cache transactions roll back. New same-account
  foreground work can proceed after cleanup without joining a canceled sync lock.
- Outbox work checks ownership/purge state between parent creation, photo metadata,
  prepare, upload, finalize, completion, and file cleanup. Cancellation stops later
  dispatches and preserves pending work without labeling it a permanent failure.
  A server request already dispatched cannot be undone; retries retain the original
  operation IDs/idempotency keys. No server contract, schema, or RLS was changed.

Validation on the final local source:

| Check | Result |
| --- | --- |
| Full `npm run test:mobile` chain | **230 passing**: domain 13, offline 5, API client 10, native client 162, mobile API 37, links 3 |
| New behavioral coverage | 11 real-provider callback/effect cases; 4 auth-lifecycle cases; 50 sync-pipeline cases; 8 owner-bound transport/SQLite cases |
| Reproduction before fix | The original seven provider race tests failed for the expected behavior before the implementation changed, then passed |
| Mobile/root TypeScript, mobile lint, `git diff --check` | Passed |
| Root compatibility build | `npm run build -- --webpack` passed locally; default Turbopack limitation unchanged |
| iOS Release build/update | Passed; existing staging iPhone 16e / iOS 26.2 simulator updated in place |
| Simulator reopening | Existing session opened its dashboard; the ten synthetic draft values were restored. No sign-out, purge, new log, photo, or location action was performed |
| Android export | Hermes bundle passed at `/private/tmp/railcommand-mobile-account-export-HLkHjW`; **not** a native Android/device acceptance run |
| Independent review | Three concrete regressions found during review were fixed and regression-tested; no further concrete issue found within this slice |

The simulator showed **Showing saved device data** on its online dashboard; this
is evidence of local session/cache restoration, not a claim that a fresh deployed
bootstrap or round-trip succeeded. The newer endpoint/capability integration still
requires the staging work described below. Behavioral tests stub native/auth/network
boundaries; cache tests execute real in-memory SQLite behind a mocked native bridge.
They do not replace physical-device or real-server authorization acceptance.

Updated simulator evidence: [restored draft after account-lifecycle update](evidence/2026-08-30-scoped-check/client-account-lifetime-draft.png).

Offline classification for this slice: **offline read-only** project/cache views
and **offline draft/queue** daily logs/photos. Cancellation does not discard field
input; user-scoped SQLite and secure token storage remain in place. Supabase auth,
React effect-cleanup, and environment-separation guidance informed these changes;
no new dependency, service, background-sync architecture, or product feature was added.

## Delivered in this pass

- Daily-log banners use explicit saving, saved, failed, attention, and queued
  states. Failed writes and permission denial no longer receive a saved/protected
  heading. Existing draft persistence, revision checks, and navigation guards stay intact.
- Camera messaging distinguishes missing project data, unverified capability data,
  and an explicit role denial. Playback still requires `canViewEarthCam === true`;
  no permissions were granted. Hidden feeds do not expose a count, and read-only
  users are not told to add a feed they cannot manage.
- Choice searches distinguish no matching results from no available options.
  Bundled weather/role/unit choices no longer suggest reconnecting on a search miss.
- Daily-log section cards reuse the command shell's existing radius and offset shadow.
- Fixed an observed choice-modal title/status-bar overlap with a modal-local safe-area
  provider. No navigation, selection, or persistence behavior changed.

## Verified

| Check | Result |
| --- | --- |
| Complete local mobile test suite | **89 passed**, including the focused status, permission, choice, navigation, SQLite, and security-boundary cases |
| Mobile TypeScript and lint | Passed |
| Root `npx tsc --noEmit` | Passed |
| Local web compatibility build | `npm run build -- --webpack` passed; no deployment. The previously recorded default Turbopack host limitation was not revisited |
| Local iOS Release build | Passed; installed in place on iPhone 16e / iOS 26.2 as `io.railcommand.app.staging` |
| Android Hermes export | Passed at `/private/tmp/railcommand-mobile-client-export-NnjXVg`; this is **not** a native Android build or hardware acceptance |
| Existing staging session | Survived both local simulator updates; no password entry/reset required |
| Ten-value daily-log draft | All ten earlier synthetic values survived the updates/reopens; no log/photo was submitted or queued |
| Choice search | An unmatched query showed the correct message; clearing it restored choices with Clear still selected; cancel kept the saved value |
| Choice modal layout | Final screenshot shows its title below the status bar, with accessible Cancel/search/options |
| Camera screen | Actually displayed **Camera access not verified**; no feed was opened or permission changed |
| Independent scoped review | No concrete regressions found in this pass's changes; wider known issues remain below |

Some tests are source-contract assertions or synthetic transport/SQLite tests.
They do not establish deployed authorization, real stream playback, storage exhaustion,
VoiceOver/TalkBack acceptance, or the full physical-device matrix.

Screenshots: [restored draft](evidence/2026-08-30-scoped-check/client-draft-restored.jpeg),
[unverified camera access](evidence/2026-08-30-scoped-check/client-earthcam-unverified.jpeg),
[fixed choice-sheet safe area](evidence/2026-08-30-scoped-check/client-choices-safe-area.jpeg).

## What is actually built, and what is not

This is a real bundled Expo/React Native application, not just an offline-mode test.
It includes the shared branded shell, sign-in/session handling, project dashboard,
cached lists/team, daily-log form and outbox, Sync Center, account/privacy/support,
and existing native device adapters. The newer RFI/Submittal text forms, read-only
details, and PDF exports exist locally; their backend routes are now in the
Step 1 Preview. The next native build and signed-in end-to-end acceptance remain open.

Full web parity is not claimed. The rich daily-log detail contract is now implemented
and locally tested, but still needs signed-in readback and updated-device acceptance.
RFI/Submittal attachments, responses/reviews/edits, and their
notification/activity parity remain unfinished. Other deferred modules are web
handoffs or unavailable, not secretly completed native/offline workflows.

## Recommended next boundary — staging integration, not production

The next useful work needs the staging backend; it is not another broad styling pass.
Request approval for **one staging-only integration slice** before starting it:

1. Inspect deployed bootstrap/capability and record contracts read-only. Resolve the
   missing camera/create capability information without weakening access checks.
2. Integrate the existing local endpoints/data fields in an isolated staging preview,
   then verify the supported daily-log round trip and the existing local text-record/
   detail/export flows with synthetic accounts. Address authorization, reference/role
   changes at write time, and retry/idempotency semantics before accepting those
   flows for beta. Provider/bootstrap/outbox and record/create/export account-response
   races are now covered locally as recorded above. Actual staging authentication,
   server authorization, receipt/idempotency behavior, and native file/share
   acceptance are still required; local cancellation tests do not close those gates.
3. Perform only the remaining acceptance checks needed for those integrated flows,
   then produce an updated internal build after separate upload authorization.

Do not add the deferred modules in that slice. Do not treat an endpoint compiling as
proof its deployed schema/RLS/numbering triggers are correct. EarthCam playback needs
an authorized existing staging feed; the current unavailable state cannot prove it.
Recovery-email delivery and the one-use password update were verified in the dated
Phase 4 release gates on August 27; this client pass neither repeats nor invalidates
that evidence. Remaining device/accessibility checks retain their tracked gates;
the Phase 4 Android hardware exception does not waive Phase 5 public-release checks.
See the [current backend-readiness assessment](./BACKEND_READINESS_2026-08-30.md)
for the later intermittent JWT failure, locally corrected error handling, and
remaining workflow, native, and contract gates. The earlier passing diagnostic
does not close the signed-in workflow gate.

The final bounded session-error follow-up also covers daily-log/photo requests and
native queue pause/resume: a final unverified session preserves saved work and
pauses the batch, while genuine permission denials remain blocked. **494 local
mobile/shared/API tests and 14 verifier tests pass**, with the compatibility build,
root/mobile TypeScript, and targeted lint passing. See the integration report for
the synthetic-test scope. Its backend changes are now deployed in the newly
approved Preview `dpl_Eav1bRAd7GS3Ci6bxkDg6JDu5EkK`; health and unauthenticated
rejection checks pass without modifying data. The native follow-up is not
installed, and signed-in staging/current-device acceptance remains open.

**The live RailCommand backend comes later**, only after staging acceptance, a scoped
production connection/rollout plan, and explicit user approval. Staging is the testing
boundary, not a requirement for a permanently separate customer backend. No live
backend change is needed to review the current simulator UI.

## Offline and safety handoff

- Daily logs: **offline draft/queue**; keep user-scoped SQLite persistence, client IDs,
  idempotency, server reauthorization, and parent-before-photo ordering.
- Camera labels: **offline read-only**. Live video/management: **online-only**; unknown
  access remains closed, and no stream is cached or described as offline live video.
- RFI/Submittal text: **offline draft, online-only submission**; not an additional outbox.
- Cached record detail: **offline read-only**; attachment retrieval and PDF export
  remain **online-only**, with account/project cancellation and temporary-file cleanup.
- UI-only messages, bundled choices, and card/safe-area styling add no network dependency.

Work remains uncommitted in `/private/tmp/railcommand-mobile-phase-5-visual-qa`, branch
`codex/mobile-phase-5-visual-qa`. Previous work is preserved. No main merge, backend
change, production/customer-data mutation, credential reset, permission change,
Expo upload, or store action occurred. Expo internal build 300003 still lacks these
local follow-ups. The synthetic draft remains on the simulator and was not discarded.
