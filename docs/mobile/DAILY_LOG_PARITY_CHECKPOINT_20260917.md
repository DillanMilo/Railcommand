# September 17 checkpoint: same-day recovery and parity audit

## Current outcome

Daily-log recovery is implemented locally and its schema/RPC change is applied
only to staging `rxuvchdqbzvovqijvfhx`. **Production is unchanged. No new TestFlight
build was uploaded. Installed/internal build remains 300008. The two entries on
Dillan's phone have not been inspected, delivered or discarded by this task.**
The user delegated the product recommendation and implementation, and requested a
full web/mobile parity check before inviting Mark and Caleb. The check found real
functional gaps; do not describe the mobile app as having full web functionality.
Caleb's specific concerns were requested but have not yet been supplied.

## Implemented

- Multiple independently authored daily logs per project/date, keeping the existing
  UUID, idempotency key, permissions and parent/attachment relationships.
- Native Sync Center -> Review saved log -> explicit Keep as a separate log.
  Review shows saved fields, photos and same-day records available in the cache.
  Cached comparisons are explicitly incomplete/stale; no silent merge or overwrite.
- Consent is committed atomically to the existing SQLite operation. A stale sync
  failure cannot overwrite newer consent. Account changes cancel/roll back review.
- Both calendars expose every same-day record; lists include author/time/short ID.
  Mobile bootstrap adds optional authorName and stable pagination tie-breakers.
- Project refresh time is labeled Project data refreshed, not a queue delivery claim.
- Released-web source uses the same atomic/idempotent daily-log RPC for new logs,
  with a stable form UUID, same-day review checkbox and offline-disabled submission.
- Persistent parity inventory covers 126 exported web actions across active sources.
  CI flags new actions without an assessment; --require-complete fails intentionally
  while functional/device parity and distribution gates remain open.

## Offline assessment

Native creation/recovery: **offline draft/queue**. Fields and files stay in the
user-scoped device database; consent survives restart; foreground sync delivers
when online. Existing cached records are read-only, and permissions are checked
again on delivery. Original identities and the photo manifest are unchanged.
Released web creation: **online-only submission**. Disconnect retains mounted form
values; it does not provide the separate offline-development branch's durable
browser draft/queue. Browser restart durability remains an explicit follow-up.
No public cache or sign-out security invariant was relaxed.

## Verification

- 227 native tests passed, including real SQLite consent/rollback/stale-request
  checks and calendar navigation to both records on a shared date.
- 270 backend mobile/API tests passed, including 111 daily-log/bootstrap/web-create
  focused cases. Shared domain 27 tests and API client 13 tests passed.
- Native TypeScript and production iOS Hermes export passed.
- Backend TypeScript and production Next build passed in a clean source snapshot.
- Native-source web TypeScript and production webpack build passed in a clean
  source snapshot. Turbopack rejects the external dependency symlink used by this
  snapshot, so webpack was used; fonts required network access. No app logic was
  changed to bypass verification.
- Isolated PostgreSQL tests passed: separate records; confirmation required for old
  queues; exact retries; original fields unchanged; invalid-child rollback;
  idempotency collision; revoked permissions; RLS; concurrent unconfirmed submissions.
- The same functional/permission assertions passed on staging inside a rolled-back
  synthetic transaction. Confirmed zero fixture users/projects afterward.
- Staging function remains SECURITY INVOKER. No authorization grants were widened.
- Inventory check passes; an isolated unassessed-action fixture makes it fail, and
  the full-parity gate correctly remains red.

Migration `20260917135812_daily_log_same_day_review.sql` uses the version returned
by staging migration history (the initial CLI-created local file was renamed to
match that applied version). Do not blindly push other migrations from any branch.

Staging advisors reported existing deny-all tables (INFO), account-deletion
SECURITY DEFINER RPC warnings, and disabled leaked-password protection. This patch
adds no SECURITY DEFINER function or table and does not change those settings.
References: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
and https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

## Remaining release work — not completed by this checkpoint

1. Review the source audit and incorporate Caleb's concerns. Full parity is blocked
   by native editing/responses/status/attachments and several web-linked modules.
   See WEB_MOBILE_PARITY_AUDIT.md and WEB_MOBILE_PARITY.json for the actual gaps.
2. Before production migration, recheck live function/constraints, preserve a current
   recovery snapshot, and deploy the compatible web/API source from live-backend.
   Apply only the reviewed migration. Never use real field records as test fixtures.
3. Build/sign/upload the next production iPhone build and assign only Dillan for
   recovery acceptance first. Do not uninstall/sign out/reset the current app.
4. On the phone, review each pending entry, compare against the existing web log,
   explicitly retain genuine additional work, and verify web/mobile readback and
   exact retries. Test restart/network interruptions and queued photo delivery.
5. Complete field-module parity and physical iPhone acceptance, then Apple external
   review/demo login/privacy gates before an email promising full functionality.
6. Integrate the temporary worktrees into a reviewed canonical release branch and
   push the CI/policy changes. Local commits do not enforce checks on GitHub yet.

## Source locations and rollback

Native/shared: `.mobile-recovery/candidate`; released web/API: `.mobile-recovery/live-backend`.
Root has unrelated in-progress web/offline changes, preserved. The candidate's web
new-log form is a separate offline development version and was not replaced with
the released-web form. Do not deploy the candidate web tree as the live backend.

If production multiple-log support is enabled later, reverting the UI must retain
both data and the new RPC confirmation check. Restoring the old RPC without date
uniqueness would let old queues submit additional records without review. Do not
reintroduce a unique date constraint by deleting or merging field records; first
check whether multiple same-day records exist and prepare a compatible rollback.
No production rollback is needed now because production was not changed.

For future tasks: read AGENTS.md, WEB_MOBILE_CHANGE_POLICY.md, this checkpoint and
the parity audit. A new task must be in this repository and explicitly cover both
platforms; it does not automatically inherit the conversation. Add Caleb's feedback
in the current task while this work is active.
