# Phase 1 TCO profile access - 29 October 2026

User approved implementing the recommended profile matrix and continuing local beta verification. Scope stays on codex/tco-inventory-audit-phase-1; no push, merge, hosted migration, deployment, paid resource or changes to the original dirty checkout.

## Access decisions

- Foreman/crew: operational quantities, locations, readiness, requests and status; no money. Inventory lead adds verification and count observations, not finance.
- Engineer/superintendent: operational/technical view by default. Organization admin may explicitly grant or revoke project cost viewing; this never grants editing or approval.
- PM/manager: project cost viewing/editing and assigned PM decisions. No organization policy, access-grant or Supply Chain assignment management.
- Supply Chain: explicit project assignment; eligible current manager/engineer/superintendent with edit permission. This adds financial review and only that assigned approval step, not project cost editing or organization configuration. Requester, lead, PM and Supply Chain must be different people.
- Organization admin: current same-organization project membership and edit permission required. Manages organization defaults, project cost-view grants and Supply Chain assignment. Existing invite-only account/team management remains. No approval-order/self-approval/history exception.
- Owner: project financial read only; no edits/decisions. Executive is an audience, not a new enum role.

One append-only project/member cost-access table is added. Existing role enums and invitation paths are unchanged. Access versions, reason, actor and server time are recorded through the existing locked executor/event/receipt path. Replay of an old grant returns its receipt without reactivating a revoked grant. Current membership and org checks still apply. New grants are restricted to engineers/superintendents; inventory assignment alone cannot expose finance.

Cost edits by PM preserve an existing carrying override; only organization admin may change/reset it. Organization defaults remain5% and strictly aboveUSD50000 per contract anniversary year, based on approved commitments plus proposed spending. Project finance readers see linked contract evidence, including cross-project sources on those contracts, not every unrelated contract in the org.

## Platform and offline impact record

- Web and native: matching admin-only forms and read-only finance views; assigned Supply Chain approval is independent of general project management. Shared form visibility and command parsing prevent UI drift; server decisions remain authoritative. Connection failures use plain wording and preserve work.
- Shared API/database: optional additive finance capability fields and cost_access command. Prior read/execute/receipt/settlement signatures remain. Migration20261029192357_inventory_profile_access.sql adds minimum grants/RLS and immutable access history. No authenticated direct access/write to the grant table.
- Offline classification: operational drafts; operational cached stock/status read-only; finance/settings/grants/approvals online-only. No new outbox or blob work. Grant input is private receipt-only persistence with original UUID/version recovery; private finance/access history never enters device cache. Sign-out/storage/upgrade paths preserve existing protections and unrelated queues.
- Compatibility: old clients remain server-restricted. Build610002 cannot display the newly separated SC capability; install the new isolated Phase1 build before testing those controls. Original TestFlight/development/staging apps are not replaced. No OTA or hosted distribution is claimed.
- Scope: TCO inventory permissions only; this is not a general rewrite of legacy non-inventory role navigation. Shared database financial read boundaries follow the stricter predicate. Server denials remain effective if a legacy client shows an old control.

## Verification / rollout record

Implementation and evidence will be updated below after local verification. Wider beta still needs named participants, consent, real pilot project/yard/lot and dates from Mark/Spike. Do not invite or contact them automatically. Broader Android/other-device and actual older-client queue recovery remain separately tracked; no device data purge is an acceptable test.

### Completed local verification

- Production web build, root/native TypeScript,482 web/shared tests,272 native tests and actual rendered web/native component-handler parity passed. Focused lint has no errors; four pre-existing unused-variable/hook warnings remain. Real disposable PostgreSQL confirms policy/access denial, grant/revoke/version/idempotency, no SC management, preservation on upgrade and final SC posting. Existing lock-wait/rollover/receipt/grant suites passed.
- Full isolated local database backup restored to a separate database. All65 existing public application tables match. Migration applied to that restored copy first, then to the persistent local backend. Each transaction compares all existing application rows and aborts on any difference; both committed with no existing-row changes. Backups and verification remain private under Phase1Local/private/backups/20261029-profile-access.
- No production/hosted database operation, merge, push or deployment occurred. Physical new-build and real local web/API acceptance continue below; they are not implied by the rendered test harness.

### Runtime and device verification completed

- Code commit: b2a2ec8c3c590e42ee97127b098deaa786ab5397. Signed isolated iPhone build610003 installed over610002 without uninstalling. Existing production, development and staging bundles remain at300014,600001 and300004. All rows in four Phase1 SQLite databases matched before/after installation. There were no unfinished drafts/outbox items in that upgrade snapshot; this does not establish a populated-queue upgrade test. The earlier610002 physical offline draft/restart result remains historical evidence, not a fresh610003 offline acceptance.
- Real local API tests passed for eight profiles. Admin-only policy edit/restore, engineer grant/revoke, stale version, original-receipt replay and engineer edit denial passed using a separate new synthetic organization. Earlier test organization policy remains unchanged. Actual web-cookie and mobile-bearer transports agreed for six profiles; web grant/mobile revocation was enforced across transports.
- Real browser UI confirmed admin defaults0.05/50000, PM finance without organization/access/Supply Chain assignment controls, engineer operational view without finance, and assigned Supply Chain financial review without cost editing or organization controls. The synthetic51000 contract-year request waited after foreman, lead and PM; Supply Chain's web button posted it, stock100→99, four actors recorded, carrying500→495. The actual iPhone610003 subsequently refreshed and displayed99ties. The fourth approval was clicked on web, not on the phone.
- Local web runtime uses a same-origin /supabase gateway routed through the existing cookie-stripping local proxy, plus its health route. Only the runtime copy has this Next rewrite and middleware path exclusion; CSP, Supabase auth/RLS and source branch configuration are unchanged. Browser URL is http://localhost:3108; phone retains its private-LAN HTTPS endpoint. These local overrides must be retained if the runtime is regenerated.
- Final preservation check at2026-10-29T20:15:46Z found all294 original rows across65 application tables present and byte-equivalent at row-JSON hash level. Original checkout branch/HEAD/main/status/diff hash still match the pre-test snapshot. All added records are synthetic QA. Full backup, successful restore verification, device backup and granular evidence remain private under Phase1Local/private.
- Desktop profile/access-only PDF created, rendered and visually checked. No credentials or test account details appear in it.

### Tracked remaining acceptance / follow-ups

- P1-ACCESS-01: physical610003 admin settings/engineer view/Supply Chain tap-through and offline restart/draft regression. Device Hub displays the app and live read-back, but coordinate/keyboard input did not reach phone controls. Automatic approval review rejected stopping screen sharing as a reconnect step because it interrupts the test connection; screen sharing was left running. Do not mark these checks passed from the rendered harness or web API evidence.
- P1-ACCESS-02: polish the already-approved-source annual-review wording. After posting a51000 source, its incremental amount is0 and no second commitment is created; the summary currently says "Within annual threshold" although the displayed annual total remains51000. Replace that label with explicit already-committed/no-new-exposure wording on both platforms and retain enforcement tests. This is a display-copy gap, not evidence of a threshold bypass.
- P1-ACCESS-03: independent review of the new access diff remains outstanding. Build610003 is locally verified against b2a2ec8; do not reuse the older c7b review as approval of this change.
- Wider beta: Mark/Spike participant/yard/date agreement, older installed-client queued-operation recovery and Android/other-device coverage remain tracked. No hosted deployment, invite/contact or paid resource is authorized by this test record.
