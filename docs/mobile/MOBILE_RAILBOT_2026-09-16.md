# Mobile RailBot implementation and acceptance

Status: implementation and local verification in progress; not yet deployed or in TestFlight.

## Scope

Replace native RailBot placeholder with project-scoped chat, streaming responses,
web-shared conversation history/new chat/deletion, suggested prompts, formatted
responses, microphone dictation, and confirmed creation of RFIs, punch items, and
daily logs. Reuse web tools for summaries, searches, schedules, team, notifications,
activity, daily-log rollups, and role-gated budget information. AI keys stay on server.

## Offline classification and design

- Responses, remote history, transcription and record creation: **online-only**.
  They require verified authentication, current membership and live project data.
- Composer/voice input: **offline draft**. Persist per user, build profile and project
  in native SQLite/documents. Retain uncertain requests; never automatically resend.
  Current conversation is locally readable. This is not a full offline assistant.
- Record proposals require a separate explicit Create action. Persisted server
  proposals are account/project scoped; recheck permissions and RLS on confirmation.
  Deterministic UUIDs make retries and concurrent confirmations return one record.
  Entity numbers are assigned by the existing server trigger. No schema migration.
- Sign-out counts pending RailBot input/proposals/recordings in the existing discard
  warnings and purges the account database/files. No private Cache Storage or global
  localStorage. Failed saves remain visible; do not claim a draft was saved on quota
  failure. Recording stops after two minutes or app backgrounding.
- Server chat and transcription requests never auto-retry. Interrupted chat retains
  input and directs the user to history before sending again. Confirmation retries
  use the same stored proposal and deterministic record ID.
- Existing records are not edited by these tools, so concurrent-edit overwrites do
  not apply. Attachments are not silently added to RailBot-created records.

## Local validation and release gates

- Stream split/UTF-8/truncation and draft serialization tests.
- Real SQLite draft account/project isolation and sign-out pending count.
- Confirmation idempotency, ownership, project, permission revocation and unknown
  proposal rejection tests; existing web RailBot regression suite.
- Mobile/backend typechecks, builds, native bundle export, permission review.
- Physical iPhone: open RailBot, read-only synthetic question; web history readback;
  airplane-mode draft, force-close/reopen, reconnect; voice permission denial, dictation
  review, interrupted transcription, sign-out cleanup; explicit synthetic proposal
  create/retry restricted to a demonstration project.
- External distribution remains gated by demo reviewer credentials and Apple review.
  Do not promise field acceptance until the device checks are complete.

Implementation locations: `.mobile-recovery/candidate` (native) and
`.mobile-recovery/live-backend` (isolated production backend). The root offline
branch is not a production deployment source.

## Implementation verification before release approval

- Native revision `21c66918d041af2e05b7ff934dc295e0e16162aa` committed; a small
  recording lifecycle follow-up preserves interrupted dictation on navigation and
  cleans up after account changes (verification in progress).
- Backend revision `b08c58f` committed. Local production dependency install,
  TypeScript and webpack build passed; 263 mobile API tests and 36 existing RailBot
  regression tests passed. No live database mutations or migrations were run.
- Native typecheck, 222 mobile tests, store declaration check, and iPhone Hermes
  export passed. The local Expo stall was an unreadable node_modules dependency;
  reinstalling the exact lockfile resolved it.
- Deployment `dpl_ECZ7fmPh16iKKCmsU9YJ3oNrPQdh` is READY at
  https://railcommand-b37ph5p44-dillans-projects-f662840b.vercel.app (not promoted
  to railcommand.io). Missing chat/history/transcription credentials and an invalid
  named-pilot token all return 401; a non-pilot token returns 403; all are no-store.
- Live domain remains on the prior read-write pilot deployment. Its records are
  unchanged. The new backend keeps the same three-user allowlist.
- Earlier EAS build request was rejected by automatic approval review: upload of this new
  source payload to Expo plus use of production signing credentials requires explicit
  user authorization. This was resolved by the subsequent explicit user approval;
  see the release continuation below.
- At that checkpoint the remaining work was EAS upload, signed artifact inspection,
  internal submission, backend promotion and physical iPhone acceptance. Update store
  console audio disclosures before external release. Apple external review still
  requires the demonstration account credentials, entered privately by the user.
- Final verification: recording lifecycle follow-up passed the 222-test mobile suite,
  mobile TypeScript and a fresh iPhone Hermes export. Clean tracked candidate source
  passed root TypeScript and `npm run build -- --webpack` (network access was needed
  for its existing Google Fonts imports). Production backend build passed separately
  against its exact locked Next 16.3.0 / React 19.2.7 dependencies.

## Approved release continuation

- User explicitly approved Expo source upload and existing production signing.
- Build 300006 completed as EAS `952d4755-aa93-4498-89ef-b9c19f1a398e`.
  Artifact inspection caught a missing NSMicrophoneUsageDescription caused by
  expo-image-picker's microphonePermission=false overriding expo-audio. This build
  was NOT submitted to Apple. Its Apple signature validated outside the sandbox;
  production entitlements disable get-task-allow and use railcommand.io applinks.
- Fix committed as `7604d5d`: both plugins now declare the same user-initiated RailBot
  dictation purpose. Expo introspection proves the permission survives plugin
  composition; mobile TypeScript and store declaration verification passed.
- Corrected signed rebuild started. Internal Apple group freshly verified to contain
  only dillanxx@gmail.com, currently installed on 300005. No tester access expanded.

- Corrected build 300007 is EAS `38ea960f-f886-4c97-b083-2566b1b5c816`, source
  `7604d5d`, currently building. Build 300006 remains deliberately undistributed.
- Promoted backend `dpl_ECZ7fmPh16iKKCmsU9YJ3oNrPQdh` to production. Live checks:
  missing credentials (chat/history/transcription) 401; invalid pilot signature 401;
  non-pilot 403; every API response no-store; `/login` 200. No live record writes.
  Rollback is `dpl_6bVok14kbmXCFLm8bCLPQke93MUb`.

- Build 300007 finished. Signed IPA SHA256
  `7aa955a8667a6815739cf92f3adfccc559736d3dff40c9a8c506cd23cfe90e2d`.
  Verified bundle/version, production profile and railcommand.io link host,
  microphone purpose, AudioData disclosure, no background audio, valid deep strict
  Apple signature, production APNs and get-task-allow=false.
- Apple submission started for this exact build, with existing RailCommand Private
  Beta group and explicit `--no-auto-testflight-setup`. Testing notes describe live
  writes, consent, voice, offline draft recovery, and device checks still required.

- Expo rejected the release-notes parameter because it requires an Enterprise plan;
  that attempt did not schedule a submission. Resubmission without that option
  succeeded: Apple submission `d8a72ff9-d15b-4268-8020-ed18e7122771`. Apple processing
  is pending; notes must be entered directly in App Store Connect.
- App Store privacy questionnaire was found entirely unconfigured (not merely missing
  Audio Data). This remains an external/public release gate; public policy URL is
  https://railcommand.io/privacy (HTTP 200).

- Apple processing completed for 300007. What to Test notes saved successfully in
  App Store Connect. CLI group assignment did not take effect, so the same verified
  one-user internal group was selected directly in Apple; assignment verification
  pending. The external Dillan Preview group was not selected.
- Privacy policy URL saved and visibly verified in App Store Connect. The collection
  questionnaire remains unconfigured and must be completed before external/public
  release; no public store release was submitted.

## Internal release outcome

- Apple build `48d58e94-6c94-473b-b0fc-0d74ed54f808`, version 1.0.0 (300007),
  processing Complete. Build detail visibly confirms Group (1): RailCommand Private
  Beta, Internal, 1 tester. Notes visibly Saved. No external group assigned.
- Browser connection became unavailable after that authoritative assignment check;
  no additional Apple mutations were attempted. Phone installation and functional
  acceptance are still user/device checks, not claimed completed.
- Internal user next step: update RailCommand via TestFlight (do not uninstall), open
  RailBot, ask a read-only question, test dictation and offline draft recovery.
  Any synthetic create must use a designated demonstration project.
- External gate: demo-only reviewer login entered privately, Apple privacy
  questionnaire completion, external beta review and physical-device acceptance.
  Existing record editing remains web-only. RailBot classification is online-only
  execution/history retrieval with offline text/audio drafts and a locally readable
  current conversation. No claim of full offline project work.
