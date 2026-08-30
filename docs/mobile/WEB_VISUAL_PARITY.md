# RailCommand native/web visual parity map

This document makes the native design target explicit. The authoritative visual
reference is the signed-in RailCommand web command shell and its sign-in experience,
not a generic Expo starter or a separate mobile brand.

## Shared visual contract

- Use the same navy, orange, cream, paper, border, success, warning, and danger color
  system as `src/app/globals.css`.
- Use the bundled Plus Jakarta Sans, DM Sans, and JetBrains Mono families that mirror
  the web typography roles. Native UI must not load fonts from the network.
- Preserve the web hierarchy: a full-width white 66-point utility bar containing a
  compact navy project selector, mono uppercase eyebrow, strong editorial page title,
  sharp bordered cards, orange primary action, and compact status badges.
- Keep native controls at least 48 points tall and retain Dynamic Type. Visual parity
  does not justify copying inaccessible web sizing or contrast.
- Reuse the RailCommand rail mark. Do not introduce an unrelated Expo or mobile-only
  identity.

## Screen map

| Web surface | Native route | Current parity state | Offline classification |
| --- | --- | --- | --- |
| Sign in | `/sign-in` | Shared brand, wording, hierarchy, fields, primary action, recovery action, and US-access treatment aligned | Online-only; failed requests remain recoverable |
| Dashboard | `/(tabs)` | Measured white utility bar/navy project control, breadcrumb/title/status, six-card two-column KPI composition, recent activity, milestones, and quick actions aligned; KPI values come from the authenticated staging bootstrap rather than fabricated fixtures | Cached project/log/team/module summaries are offline read-only; new logs are offline draft/queue |
| Daily logs list/detail | `/(tabs)/logs`, `/daily-log/[id]` | Project header, web-style New Log action, Calendar/List switcher, month grid, cached record cards, weather metadata, and detail sections aligned for the available mobile data | Offline read-only; new-log navigation opens the offline draft/queue workflow |
| New daily log | `/daily-log/new` | Durable workflow uses the web report-details, weather, field-activity, safety, evidence, and autosave hierarchy; richer personnel/equipment/work-item fields require separate mobile contracts | Offline draft/queue |
| Project team | `/team` | Project header, cached-state notice, roster heading, member cards, initials, email, and role treatment aligned | Offline read-only |
| Sync Center | `/(tabs)/sync` | Native-only operational surface now uses the same project header, page status, KPI, action-card, and activity-row language | Offline-capable status and retry control |
| Profile/privacy/support | `/(tabs)/account` | Identity, session state, device services, support/compliance, and safe-sign-out sections aligned to the web settings hierarchy | Mixed; deletion and remote links are explicitly online-only |
| Invitation, recovery, and secure callback | `/invitation/[token]`, `/reset-password`, `/auth/callback` | Shared secure-access hierarchy and live verification/recovery status treatment aligned | Online-only; failed requests remain recoverable |
| Account deletion | `/account-deletion` | Privacy heading, 30-day recovery status, retention explanation, local-work inventory, and identity confirmation aligned | Online-only request; local work is never silently discarded or queued |
| Submittals | `/(tabs)/submittals` | Authenticated cached list, count, web-matched filters/search/cards, and connected web create/export handoff | Offline read-only list; create/edit/export remain explicitly online-only and are never queued |
| RFIs | `/(tabs)/rfis` | Authenticated cached list, count, web-matched filters/search/cards, and connected web create/export handoff | Offline read-only list; create/respond/edit/export remain explicitly online-only and are never queued |
| More/navigation | `/more` | The visible native navigation mirrors the web priority order and opens the same nine-item bottom sheet. Cameras and Team have native routes; the other deferred modules hand off to the authenticated staging web app when connected | Mixed: Cameras/Team metadata is cached read-only; deferred module navigation is explicitly online-only |
| EarthCam Cameras | `/cameras` | Project-authorized feed labels plus embedded EarthCam share players, strict HTTPS host allowlist, external-open fallback, and permission-checked native add/edit/remove controls matching the web workspace | Feed metadata is offline read-only; live video and administration are online-only, an open form preserves its input through connection loss, and mutations are never silently queued |
| Punch list, safety, QC/QA, documents, photos, reports, schedule | Not yet native workflows | Preserve web information architecture; implement only with real data endpoints and complete states | Online-only/unavailable until separately implemented |
| Administration, billing, RailBot voice | Intentionally deferred | Must stay clearly unavailable in the field release | Online-only/unavailable |

## Phase boundary

Phase 5 proves the shared native shell, accessibility/security behavior, and physical
device reliability. The implemented parity slices now cover sign-in, dashboard,
the Dashboard/Submittals/RFIs/Logs/More navigation structure, cached Submittal/RFI
lists, the EarthCam viewer and permission-checked feed controls, daily-log list/form/detail, team, Sync Center, account,
account deletion, invitation, recovery, callback, and the shared components later
screens inherit. Submittal/RFI mutations still hand off to the connected web application.
EarthCam add/edit/remove is native but remains online-only and is never placed in the outbox.
Web-style project links for Submittals, RFIs, Daily Logs, Cameras, and Team now select the
linked project and open the corresponding native workspace instead of falling through to an
unmatched route. A known project opens immediately from the signed-in user's cached project
list and then revalidates in the background; a failed response never makes an unknown project
ID active. Unsupported v1 administration modules continue to return safely to the
project dashboard and are not represented as native/offline-capable.

Full route-by-route parity is product work, not store metadata work. It must continue
before release-candidate sign-off, but it must not weaken the accepted offline or
security invariants and must not invent dead controls for modules whose mobile API and
workflow do not yet exist.

## Measured signed-in reference — 2026-08-29

The signed-in production web shell was inspected read-only in Safari Responsive
Design Mode at 390 × 844, 768 × 1024, and desktop width. No record was created,
edited, submitted, or downloaded during this inspection.

- Both measured phone and tablet widths retain the mobile shell: full-width 66-pixel
  utility bar, navy 36-pixel project selector, two-column KPI cards, and fixed
  Dashboard / Submittals / RFIs / Logs / More navigation.
- The dashboard content uses 12-pixel phone gutters, a breadcrumb above the orange
  command eyebrow, a 28-pixel project title, a divider, and six 148-pixel KPI cards.
- Cards use the warm paper surface, one-pixel neutral border, two-pixel corner radius,
  and restrained three-pixel offset shadow from the web command-shell stylesheet.
- The desktop-only dark sidebar appears only beyond the measured tablet shell.
- Native data remains truthful: Budget, schedule, Submittal, RFI, Punch List, and
  Daily Log KPI positions use authenticated bootstrap data. Existing module lists are
  cached read-only; actions that are not native open the connected staging web route
  or explain the offline boundary. No synthetic count or silently queued mutation is
  introduced for visual parity.

## Acceptance for each later screen

1. Compare the rendered web surface and native phone/tablet surface at the same state.
2. Match information hierarchy, terminology, colors, type roles, borders, spacing,
   empty/loading/error states, and permission-specific actions.
3. Document the offline classification before implementation.
4. Prove no lost input during connectivity loss and no dead controls.
5. Run TypeScript, focused mobile/offline tests, lint, and native iOS/Android exports.
6. Capture physical iOS evidence and physical Android evidence before public release.
