# RailCommand Phase1 checkpoint — 29 October 2026

Paused at the user's request. Resume Friday30October or Monday2November2026; no background work or scheduled wake-up requested. The earlier Device Hub reconnect permission question is deferred. Do not continue testing until the user resumes.

## Work and data preserved

- Branch: codex/tco-inventory-audit-phase-1.
- Feature worktree: /Users/dillanmilosevich/.codex/worktrees/tco-inventory-audit-phase-1/Railcommand.
- Installed/verified application source: b2a2ec8c3c590e42ee97127b098deaa786ab5397. Isolated iPhone app: RailCommand Phase1, io.railcommand.app.phase1, build610003. Access evidence committed separately as5d8b9b40bcffe0697038aeac2dd26be96ab472a5; this checkpoint is documentation only.
- Original dirty checkout remains on codex/offline-foundation-day-1; branch/HEAD/main/status/diff hash match the pre-test snapshot. Leave it alone.
- No merge, push, deployment, hosted database mutation or paid resource this round. Existing production/development/staging phone apps remain installed unchanged.
- Latest data preservation check: all294 original public rows across65 tables unchanged. Four pre-existing Phase1 SQLite databases preserved through installation; no pending drafts/queues existed in that upgrade snapshot. Do not claim a populated-queue upgrade test.
- New access rules and organization controls are implemented on web/native/shared API and local RLS. Defaults remain5% yearly and strictly aboveUSD50000 per contract anniversary year, approved commitments plus request. Separate Supply Chain authorization; likely splitting requires review.
- Checks passed: web build; root/native TypeScript;482 root/shared tests;272 native tests; rendered platform handlers; real upgrade/authorization/idempotency/concurrency database suite; actual web-cookie/mobile-bearer parity; real browser admin/PM/engineer/Supply Chain visibility.
- Latest synthetic request76dd20af-af70-4cb7-9e2e-b7b87d8180d0 is POSTED, version4. Supply Chain was clicked in the web UI after three distinct prior actors. Synthetic stock99ties, carrying495/year at5%, contract-year total51000. Actual iPhone610003 read back99ties. No real stock or spending.
- Profile/access-only PDF on Desktop: RailCommand TCO - Profile Access Rules.pdf.

## Persistent local backend / safe shutdown

- Folder: /Users/dillanmilosevich/Library/Application Support/RailCommand/Phase1Local.
- Supabase project: railcommand-phase1-persistent. Only this project was stopped with backup enabled. Its named Docker database volume was checked and remains present. Never use --no-backup, volume deletion/pruning, database reset, reseeding or factory reset.
- Verified Phase1 web/proxy processes were stopped too. Docker Desktop itself and unrelated projects were not stopped by the agent. The user may quit Docker Desktop normally; Phase1 will be unavailable while it is off. Quitting the app normally retains its data.
- Fresh full custom database archive: private/backups/20261029-pause-checkpoint/phase1-before-pause.dump. SHA/catalog verification and copies of local runtime overrides are beside it. This newest archive's catalog is verified; the earlier profile-access backup was fully restored and row-compared. Keep backups private and do not print credentials or auth URLs.
- Local same-origin web runtime overrides: /supabase gateway through existing cookie-stripping proxy, auth health rewrite, /supabase middleware exclusion, web env URL http://localhost:3108/supabase. CSP unchanged. Native env retains private-LAN HTTPS. Snapshots are in the pause backup; do not overwrite them when refreshing runtime source.
- Local web test URL: http://localhost:3108. Phone endpoint: https://192.168.1.100:44321. Temporary synthetic web sign-in helper was stopped. No emails or shared/master login.

## Resume steps

1. Open Docker Desktop and wait for its engine to be ready.
2. Run /Users/dillanmilosevich/Library/Application Support/RailCommand/Phase1Local/Start Phase1 Local.command. It starts existing persisted services without resetting or reseeding and checks the local IP/certificate. If those checks fail, preserve data and repair local connectivity; never fall back to hosted user data.
3. Keep Mac awake and iPhone/Mac on the same Wi-Fi; open only RailCommand Phase1. USB/unlocked phone and visible Device Hub are needed for physical UI testing.
4. Recheck code/build identity and local-only endpoints before testing. Read docs/mobile/TCO_PROFILE_ACCESS_20261029.md and Phase1Local/PROFILE_ACCESS_RESULTS_20261029.json for evidence.
5. Continue the remaining acceptance below. Resume this same chat with: "Resume the October29 Phase1 checkpoint. Keep everything local and preserve all data."

## Remaining acceptance / known gaps

- P1-ACCESS-01: physical610003 admin/engineer/Supply Chain tap-through and offline draft/restart regression. Phone display and read-back work; Device Hub taps/keyboard were not forwarded. Automatic approval review rejected stopping sharing as a reconnect step because it interrupts the testing connection. Do not retry that rejected action without user approval; do not stop/restart or reset the phone as a workaround. User has now paused, so leave this for resume.
- P1-ACCESS-02: correct the existing-source summary label on BOTH platforms. A posted51000 source has zero incremental exposure on reuse, but the summary currently says "Within annual threshold". Use explicit already-committed/no-new-exposure wording and retain enforcement tests. No threshold bypass was demonstrated.
- P1-ACCESS-03: independent review of the new access diff remains outstanding. The older c7b review does not cover b2a2ec8. New source changes require suitable tests/build and a new isolated phone build when bundled UI changes.
- Offline classification: operational input drafts; synchronized operational stock/status read-only offline; financial decisions, settings and grants online-only. No new outbox. Do not describe this as full offline project work.
- Wider beta still needs Mark/Spike pilot participants/consent/yard/dates and tracked older-client queue recovery/Android coverage. Do not contact anyone automatically. No final wider-beta sign-off yet.
