# Visual parity checkpoint — 2026-08-29

Work stopped for the night at the user's request. Do not start overnight builds,
deployments, credential resets, or further implementation. Resume when the user
checks in. Full web/native parity is not complete.

## Isolation

- Worktree: `/private/tmp/railcommand-mobile-phase-5-visual-qa`.
- Branch: `codex/mobile-phase-5-visual-qa`; HEAD `7758aeb`.
- Implementation is saved locally as uncommitted changes; preserve all of it.
- No main merge, production deployment, customer-data change, Expo upload, or
  store submission was performed in this checkpoint's work.
- Current Expo internal build 300003 does not contain these latest changes.

## Latest local slice

The new daily-log form now includes weather temperature/conditions/wind,
personnel, equipment, and work-item rows matching the web form's fields, alongside
summary, safety notes, location, and photos. Raw numeric input is preserved until
queue validation. Stable row IDs and serialized draft writes preserve unfinished
input; the existing sync payload now carries the richer fields. Queue validation
rejects partial rows and oversized content instead of silently trimming work.

Offline classification: **offline draft/queue**. Private drafts remain in the
authenticated user's native SQLite store, not public caches. Existing client IDs,
idempotency keys, server authorization, and parent-before-photo ordering remain
the synchronization contract. Tests are not a substitute for device acceptance.

Privacy: the additional weather, personnel role/company/count, equipment notes,
and work-item text are private project data following the same draft/outbox
lifecycle. No new analytics, crash-reporting vendor, or background location use
was introduced by this form slice.

## Verification completed

- 149 focused mobile/domain/API tests passed.
- Root TypeScript, mobile TypeScript, and mobile lint passed.
- Latest local iOS Release simulator build completed with exit code 0; installed
  and launched `io.railcommand.app.staging` on the iPhone 17 Pro simulator.
- Build output: `/private/tmp/railcommand-expo-staging-simulator/Build/Products/Release-iphonesimulator/RailCommandStaging.app`.
- Compiler warnings were present; there was no fatal build error.
- The Mac is accessible again. Before the rebuild, the simulator showed the
  staging sign-in screen. Authenticated rendering of this latest binary has not
  yet been checked.
- Root webpack build and Android export passed for an earlier local slice, but
  have not been rerun after the latest daily-log changes. Do not call those latest
  checks complete.

## Lean next session

1. Open the already-built simulator app; use the existing staging reviewer account
   with user-assisted sign-in if needed. Do not reset credentials just to proceed.
2. Compare the new daily-log screen with the web reference and verify one local
   draft edit/reopen flow, including the new rows and keyboard layout.
3. Verify the existing staging EarthCam viewer and clear offline/error states.
   Native authenticated playback is still pending, not proven by unit tests.
4. Run the remaining focused build/export checks, fix concrete acceptance failures,
   and report remaining parity gaps before starting another feature slice.

Previously added native RFI/Submittal forms, detail screens, PDF export, and local
API routes are also uncommitted and not deployed. Their authenticated end-to-end
acceptance remains pending. Daily-log rich detail display, record attachments and
editing, and other web-only modules are not full native parity yet. The historical
screen map in `WEB_VISUAL_PARITY.md` needs reconciliation with these local slices.

If access, authentication, native playback, or another external blocker arises,
stop and ask the user rather than expanding troubleshooting or making unapproved
environment changes. Keep production untouched.
