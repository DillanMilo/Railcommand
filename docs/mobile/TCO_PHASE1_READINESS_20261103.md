# Phase1 readiness — 3 November 2026

Update November 4: the core physical iPhone checks below have now passed. See
[device acceptance and preservation results](TCO_PHASE1_DEVICE_ACCEPTANCE_20261104.md)
for the current state; the blocked/pending device notes below are historical.

Resume from checkpoint884238b. Keep this round small: correct the misleading annual-review label, verify the existing permission/approval/carrying/split-purchase rules, and finish physical iPhone/offline acceptance when the device is available. No new feature framework, exports, investigation workflow or retention work.

## Impact and verification plan

- Web/mobile: both use shared `annualReviewText`; a reused committed source with zero incremental exposure must not claim its annual total is below the threshold. Keep the total, approval and likely-split evidence visible. Native bundled changes require a new isolated Phase1 build.
- Shared API/backend: no planned schema, RLS, approval, commitment or calculation changes. Review current access boundaries and run the existing real database regression suite against disposable test data. Restart only the persistent local backend; no reset/reseed.
- Offline: unchanged operational draft input and read-only operational cache; finance/configuration/approvals remain online-only. Check draft persistence through app restart and update without changing UUIDs, purging queues or signing out with unfinished work.
- Installed-client compatibility: retain existing routes/RPC payloads. The October30 daily-log/photo release must survive any eventual integration; the old feature branch is not a deployable substitute for current production source.
- Safety: original dirty checkout and existing apps/data stay untouched. Record fresh baselines and local backups. No paid resource, merge, push, hosted mutation, deployment or TestFlight upload is authorized by this resume.

## Minimum release gates

1. Shared label regression, required build/typechecks/focused tests and permission/approval review pass.
2. Physical supported iPhone: correct role controls, distinct Supply Chain approval over50000, safe offline draft/reconnect/restart and preserved existing storage.
3. Prepare compatible web/backend/native release source from the current shipped base, a backed-up additive migration/rollback plan, and a short named-tester setup checklist. Production release remains a separate concrete approval step.

Manual review evidence must be described accurately; a repeat author review is not an independent peer review. Android/other device and older-client queued-payload gaps must remain explicit, and any initial pilot device restriction must be stated before rollout.

## Results so far

- Label correction349ce04 passes17 focused inventory cases. Current shipped web delta through b4e7737 and native caption delta b23bf44 are carried forward in this isolated branch. No Git merge, main change or remote mutation was performed.
- Preserved the shipped photo pagination/upload receipt behavior, US dates/captions, legacy-v1/caption-v2 photo dispatch, release metadata route and Next16.4.1/security dependency lockfile. Resolve overlapping app-release implementation once; preserve inventory exports alongside DFR exports.
- The native CI gate now uses the mobile app's own lockfile/install/prefix; the root is not configured as an npm workspace. Ignore only private .codex-loop workbench artifacts in source/lint/git traversal and fix the existing prefer-const test lint error; no acceptance evidence was deleted.
- Combined checks pass: production build, root/native TypeScript,376 auth/mobile-backend/inventory tests,273 native tests,33 domain tests,14 API-client tests,25 project-photo tests,16 invitation/account tests, database grants/advisor-style role fixtures and web/mobile action inventory. Full lint has zero errors and59 warnings. The action inventory is documentation evidence, not physical parity acceptance.
- Local resume backup restored fully to a new verification database. Tested the already-shipped caption migration there first, then in the persistent LOCAL backend. Both transactions proved all382 existing public row values unchanged, with only a new nullable caption column. The legacy photo RPC definition is byte-identical. The disposable caption suite passed legacy/caption/retry/conflict/length/current-permission/object-owner/metadata/parent/RLS checks. No production/hosted SQL.
- Reviewed the access diff against the preceding executor: same organization/current membership/edit checks, locked revalidation after waiting, append-only grant/revoke/version/receipt history, admin-only policy and assignments, distinct role-ordered approvals, and no Supply Chain cost-edit permission. This is an author review plus real database denial/concurrency tests, not an independent peer review.
- iPhone610003 and all three existing apps are still installed at this point. All six current Phase1 SQLite databases were backed up and pass integrity checks; new native build/upgrade/physical UI checks follow. Existing production app is300015, development600001, staging300004; do not compare against stale October29 production300014.
- Device is paired/available, but screen-control capture currently fails with an audio/video capture error. Availability question is pending; do not mark a physical button/offline test passed from CLI or synthetic adapters.

## End-of-session state

- Separate iPhone build610004 (application sourcefd99183299160f8774ea2fbf1c62ccf03db5da17) built/signed locally and installed in place. Full app-container backup saved. Every row in all six app SQLite databases matched before/after installation, before launch; no drafts/outboxes were pending, so populated-queue upgrade acceptance is still not claimed. Production300015/development600001/staging300004 remain unchanged.
- Real browser now confirms the corrected committed-source label, 5%/365-day500 example,96,000 contract-year review, likely-split warning, assigned Supply Chain button and absence of cost/org editors for Supply Chain. Initial browser startup timeout recovered. This is web evidence, not phone UI evidence.
- New local synthetic request#9 (QA November3 phone acceptance) is awaiting Supply Chain at version3; its new lot remains100ties. External baseline45000 + prior distinct committed6000 + proposed45000 =96000; the two subthreshold tracked sources total51000, so the likely-split review signal is true. Original synthetic lot stays99ties. Leave#9 pending for the physical test.
- iOS refused the launch because the phone is locked; native screen capture also reported an audio/video capture failure. Device availability question remains unanswered. No phone unlock, sharing restart, private outbox purge or permission bypass was attempted. Local launcher error handling now suppresses callback URLs; a new local one-time QA link superseded the unused failed-launch link.
- Rollout review identified a necessary order constraint: new projection reads require finance RPCs, while the inventory migration removes old direct finance-column grants. Added the small conditional finance preparation migration and real PostgreSQL checks; see TCO_PHASE1_ROLLOUT_20261103.md. Legacy roles/RLS/row/grant preservation and final-RPC no-op tests pass; the full real inventory suite also passes after starting with the bridge. CI includes both checks. No new user-facing feature.
- On the existing local Phase1 backend, the bridge is a verified no-op: final finance definitions/grants unchanged and all382 pre-existing public row values still identical to the restored resume backup. Only new synthetic smoke-test records were added. Original dirty checkout/main still match the fresh November3 baseline.
- No hosted changes, push, merge into main, deployment, cloud build, TestFlight upload or paid resource. Application build/typechecks remain valid: changes sincefd99183 are SQL/tests/CI/docs only, not bundled mobile or web runtime code.

### Remaining before a small invited live pilot

1. Finish the physical iPhone admin/engineer/Supply Chain and offline draft/restart/reconnect check. User can tap through a guided test if Device Hub control stays unavailable.
2. Complete actual production migration/ACL/rollback preflight and release review. Author review and automated tests are recorded; independent peer review has not been performed.
3. After approval, perform the staged web/database rollout and production-signed TestFlight delivery/installation verification. Local610004 is not that release.

This is a completion/acceptance/release boundary, not an expansion into Phase2/3.
