# Daily Log / EarthCam bounded verification — 2026-08-30

Follow-up: the user subsequently authorized another bounded client-only pass.
See [the later checkpoint](CLIENT_FINISH_CHECKPOINT_2026-08-30.md); it supersedes
the stop instruction and camera-message wording below, but does not close the
staging playback or full live-web comparison gaps. The rest of this report is
the historical evidence for the earlier pass.

Status: **partial verification complete; blocked on web-reference sign-in and
staging EarthCam access**. Two small navigation fixes are verified locally.
Initial preflight started 07:28:42 America/Chicago and stopped for sign-in. User
resumed at approximately 07:34; verification finished by 07:48, inside even the
original 45-minute window. No further automatic implementation is authorized.

## Resumed verification — current result

The user opened the signed-in iPhone 16e simulator (iOS 26.2). Its existing staging
session survived installation of yesterday's already-built staging binary. No
password entry/reset was needed. Known local staging credential files were checked
without exposing values and contained no reviewer password. A temporary Play
Console lookup tab was closed when the signed-in simulator became available; no
reviewer draft was read or changed.

| Check | Result | Evidence / limitation |
| --- | --- | --- |
| Daily-log local draft retention | **Passed** | Entered ten synthetic values, used Save draft, left, reopened; all ten values remained and the app reported Saved draft restored from this device |
| Draft after local app update | **Passed** | The same ten values remained after installing the navigation-fix binary and reopening the form |
| Back to logs destination | **Fixed and verified** | Previously returned to Dashboard when opened there; now explicitly opens the Daily Logs calendar. Existing dirty/busy save guard remains |
| More → Cameras navigation | **Fixed and verified** | `/more` conflicted with the empty `(tabs)/more` route. Renamed the tab launcher to `more-tab`; the nine-item modal now opens and Cameras is reachable |
| EarthCam unavailable message | **Passed for access-unavailable state** | Cameras shows Camera access unavailable / Your current project role does not have permission to view EarthCam feeds, with zero feeds |
| EarthCam playback | **Blocked** | No accessible existing feed in this staging session. No permission grants, feed insertion, authentication reset, or backend change attempted |
| EarthCam true network-offline fallback | **Not exercised on simulator** | Focused player-state tests pass; the observed access-unavailable state does not prove network-offline video fallback |
| Live web/native visual comparison | **Blocked** | Read-only navigation from the existing Safari reference to Daily Logs redirected to web sign-in; original 768-pixel responsive width restored afterward |

The ten values were: temperature `72`, conditions `Clear`, wind `NW 8 mph`,
personnel role `Foreman`, personnel count `2`, company `QA Rail`, equipment type
`QA Loader`, work description `QA track inspection`, quantity `12.5`, and work
location `QA segment`. All were observed in the native accessibility tree before
and after reopening. No log or photo was submitted or queued. The synthetic draft
remains saved locally on this simulator; it was not discarded.

The EarthCam message is what the client displayed, not proof of the underlying
permission cause. The client requires `canViewEarthCam === true`; missing or stale
bootstrap flags can also produce this state. Determining the server-side cause is
outside this bounded UI check. Actual playback and exact visual parity are not
accepted or declared complete.

### Changes and verification

- Renamed `apps/mobile/src/app/(tabs)/more.tsx` to `more-tab.tsx`; updated the tab
  registration without changing the displayed More label or root modal.
- Changed the Daily Log editor's Back to logs action to the explicit Logs route.
- Added focused route/destination regression assertions. These source assertions
  are supplemented by the actual simulator navigation checks above.
- **21 focused tests passed** (visual foundation, daily-log editor, EarthCam player).
- Root TypeScript, mobile TypeScript, and mobile lint passed; `git diff --check`
  passed. React review remained limited to navigation and existing save guards;
  no new state layer, effect, dependency, or data API was added.
- One incremental local iOS Release simulator build/install succeeded after the
  two fixes. No new native dependencies, clean build, Expo upload, or store upload.
- Root web build, Android build, physical-device matrix, full offline/security
  suite, stream playback, and live visual comparison were **not** rerun/verified.

Offline behavior is unchanged: daily logs remain **offline draft/queue** with
local save-before-navigation; EarthCam video remains **online-only**. The route
fix only makes the existing camera screen reachable; it does not weaken its access
check or add caching of streams.

### Current screenshots

- [Save draft before leaving](evidence/2026-08-30-scoped-check/draft-save-before.jpeg)
- [Restored draft](evidence/2026-08-30-scoped-check/draft-restored.jpeg)
- [More menu after fix](evidence/2026-08-30-scoped-check/more-fixed.jpeg)
- [EarthCam access-unavailable state](evidence/2026-08-30-scoped-check/earthcam-access-unavailable.jpeg)
- [Back to logs after fix](evidence/2026-08-30-scoped-check/back-to-logs-fixed.jpeg)
- [Expired web-reference session](evidence/2026-08-30-scoped-check/web-reference-signed-out.jpeg)

No main merge, production/customer-data mutation, backend change, new module,
password reset, permission change, deployment, or Expo/store upload occurred.
Stop here; the next work requires a signed-in web reference and an accessible
existing staging EarthCam feed (or separate authorization to diagnose its access).

## Initial preflight — historical, superseded where noted above

## Scope and boundaries

Use the existing staging simulator binary and signed-in web reference to compare
Daily Log and EarthCam, verify one local draft save/reopen without submission,
and verify existing-feed playback plus unavailable/offline messaging. Small fixes
only. No backend changes, credential resets, new modules, deployment, Expo/store
upload, or main merge. Worktree remains `codex/mobile-phase-5-visual-qa`.

Offline classification: Daily Log is **offline draft/queue** (this check must not
submit or queue a log). EarthCam metadata is **offline read-only**; live playback
is **online-only** and needs an explicit unavailable/offline state.

## Evidence and results

| Check | Result | Evidence / limitation |
| --- | --- | --- |
| Isolated mobile branch | Passed | `git status --short --branch` identifies `codex/mobile-phase-5-visual-qa`; existing uncommitted work preserved |
| Existing simulator accessible | Passed | iPhone 17 Pro, iOS 26.2 responds to Computer Use |
| Authenticated staging session | Blocked | RailCommand shows Welcome back, empty Email/Password fields and Sign In; neither target screen can be reached |
| Signed-in web reference ready | Not established | Existing Safari responsive tab is 768×1024 on the prior RFI page; accessibility state reports Couldn't load RFIs / Check your connection and try again. No navigation or troubleshooting performed |
| Two-screen visual comparison | Not run | Requires staging sign-in and target web reference pages |
| One draft save/leave/reopen | Not run | No draft entered, queued, submitted, overwritten or removed |
| Existing EarthCam feed playback | Not run | Requires signed-in project/feed access |
| EarthCam offline/unavailable state | Not run | No connectivity setting changed |
| Fix verification | Not applicable | No code fixes made, no tests/builds rerun |

Screenshots:

- [Simulator access preflight](evidence/2026-08-30-scoped-check/simulator-sign-in.jpeg)
- [Existing web reference preflight](evidence/2026-08-30-scoped-check/web-reference-preflight.jpeg)

The simulator screenshot is small at the existing window scale. Its accessibility
tree, not visual measurement, establishes the sign-in blocker. These are access
screenshots, not evidence of Daily Log/EarthCam parity or successful playback.

## Next user action

Sign in to RailCommand in the Mac's **iPhone Simulator** with the existing staging
reviewer account (`app-review@railcommand.io`), then tell the assistant when the
dashboard is open. No physical phone connection is needed for this simulator check.
If the password is unavailable, stop and ask for direction; do not reset it.

Only this report and the two preflight screenshots were added in this bounded
attempt. No production data, account settings, application code, or deployments
were changed. The requested functional verification remains incomplete.
