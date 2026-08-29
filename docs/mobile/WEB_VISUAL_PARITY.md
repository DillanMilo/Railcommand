# RailCommand native/web visual parity map

This document makes the native design target explicit. The authoritative visual
reference is the signed-in RailCommand web command shell and its sign-in experience,
not a generic Expo starter or a separate mobile brand.

## Shared visual contract

- Use the same navy, orange, cream, paper, border, success, warning, and danger color
  system as `src/app/globals.css`.
- Use the bundled Plus Jakarta Sans, DM Sans, and JetBrains Mono families that mirror
  the web typography roles. Native UI must not load fonts from the network.
- Preserve the web hierarchy: dark project-control top bar, mono uppercase eyebrow,
  strong editorial page title, sharp bordered cards, orange primary action, and
  compact status badges.
- Keep native controls at least 48 points tall and retain Dynamic Type. Visual parity
  does not justify copying inaccessible web sizing or contrast.
- Reuse the RailCommand rail mark. Do not introduce an unrelated Expo or mobile-only
  identity.

## Screen map

| Web surface | Native route | Current parity state | Offline classification |
| --- | --- | --- | --- |
| Sign in | `/sign-in` | Shared brand, wording, hierarchy, fields, primary action, recovery action, and US-access treatment aligned | Online-only; failed requests remain recoverable |
| Dashboard | `/(tabs)` | Project-control header, project title/status, KPI-card language, quick action, and module hierarchy aligned for the scoped field data | Cached project/log/team data is offline read-only; new logs are offline draft/queue |
| Daily logs list/detail | `/(tabs)/logs`, `/daily-log/[id]` | Native field subset exists; detailed row/card parity remains to be completed | Offline read-only |
| New daily log | `/daily-log/new` | Durable field workflow exists; final web form-section and field-density alignment remains | Offline draft/queue |
| Project team | `/team` | Native cached member list exists; final web row treatment remains | Offline read-only |
| Sync Center | `/(tabs)/sync` | Native-only operational surface; uses the shared command-shell visual language | Offline-capable status and retry control |
| Profile/privacy/support | `/(tabs)/account` | Native field subset exists; final web settings-section parity remains | Mixed; deletion and remote links are explicitly online-only |
| Submittals | Not yet a native workflow | Named in the native project-module hierarchy without a false working control | Online-only/unavailable in the scoped field release |
| RFIs | Not yet a native workflow | Named in the native project-module hierarchy without a false working control | Online-only/unavailable in the scoped field release |
| Punch list, safety, QC/QA, documents, photos, reports, schedule | Not yet native workflows | Preserve web information architecture; implement only with real data endpoints and complete states | Online-only/unavailable until separately implemented |
| Administration, billing, EarthCam admin, RailBot voice | Intentionally deferred | Must stay clearly unavailable in the field release | Online-only/unavailable |

## Phase boundary

Phase 5 proves the shared native shell, accessibility/security behavior, and physical
device reliability. The first high-impact parity slice covers sign-in, dashboard,
top-level navigation labeling, and shared components so later screens inherit the
correct design foundation.

Full route-by-route parity is product work, not store metadata work. It must continue
before release-candidate sign-off, but it must not weaken the accepted offline or
security invariants and must not invent dead controls for modules whose mobile API and
workflow do not yet exist.

## Acceptance for each later screen

1. Compare the rendered web surface and native phone/tablet surface at the same state.
2. Match information hierarchy, terminology, colors, type roles, borders, spacing,
   empty/loading/error states, and permission-specific actions.
3. Document the offline classification before implementation.
4. Prove no lost input during connectivity loss and no dead controls.
5. Run TypeScript, focused mobile/offline tests, lint, and native iOS/Android exports.
6. Capture physical iOS evidence and physical Android evidence before public release.
