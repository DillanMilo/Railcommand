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

## Verified outcome so far

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
- EAS build request was rejected by automatic approval review: upload of this new
  source payload to Expo plus use of production signing credentials requires explicit
  user authorization. An asynchronous approval request is pending. No new EAS build
  started, no new Apple upload/invitation was sent.
- Remaining: authorize EAS upload, produce/inspect signed artifact, submit/assign
  internally, promote verified backend, physical iPhone acceptance. Update store
  console audio disclosures before external release. Apple external review still
  requires the demonstration account credentials, entered privately by the user.
- Final verification: recording lifecycle follow-up passed the 222-test mobile suite,
  mobile TypeScript and a fresh iPhone Hermes export. Clean tracked candidate source
  passed root TypeScript and `npm run build -- --webpack` (network access was needed
  for its existing Google Fonts imports). Production backend build passed separately
  against its exact locked Next 16.3.0 / React 19.2.7 dependencies.
