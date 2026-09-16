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
