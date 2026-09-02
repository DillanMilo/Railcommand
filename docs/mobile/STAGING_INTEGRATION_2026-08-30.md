# Bounded staging integration — 2026-08-30

Status: **Step 1 Preview deployment complete; signed-in workflow acceptance remains open**.
Approved staging schema and rollback database acceptance also passed. Production
and customer data are unchanged; the existing custom staging URL was not moved.

The subsequent [read-only backend and local beta preflight](BACKEND_READINESS_2026-08-30.md)
confirmed specific live-contract gaps without changing production. Its small
TestFlight association/profile corrections are local only and postdate the Preview
below. No TestFlight upload or signed-in workflow pass is implied.

## Authorized boundary

**Latest approval, 2026-08-30:** one new unique Preview was authorized with zero
user data adjusted or deleted. The resulting pass below is non-mutating: no
application sign-in, synthetic fixture creation, password reset, database change,
or deletion. This boundary supersedes earlier full-run permissions for this pass.

Integrate and verify only the already-built mobile workflows in a unique Preview
deployment of `railcommand-mobile-staging`. Do not change production, merge main,
add modules, upload an Expo build, or perform a store action. Existing drafts and
queued work must remain intact.

After reviewing the next steps, the user approved **Step 1 only**: deploy existing
code as a Preview, permit generated Preview links to update, verify it, and preserve
the custom staging URL. Signed-in workflow testing and a new internal Expo build
remain separate next steps. No new product code was added during this deploy pass.

The user reconfirmed that the finished app will use the **existing RailCommand
web application's backend and accounts**, not a permanent separate mobile backend.
Staging is an isolated synthetic test environment. Match its contracts to the
checked-in web schema; do not migrate customer data, change production connections,
or apply a staging-only fixture to the production migration chain. Production
connection/cutover requires a later explicit approval and compatibility check.

## Verified preflight

### Latest approved Preview — 20:45 UTC; ready and non-mutating checks passed

| Deployment field | Verified result |
| --- | --- |
| URL | https://railcommand-mobile-staging-h1a0dvnhe-dillans-projects-f662840b.vercel.app |
| ID / target / state | `dpl_Eav1bRAd7GS3Ci6bxkDg6JDu5EkK` / Preview (`target: null`) / **READY** |
| Project / team | `railcommand-mobile-staging` / `team_s16JIS0pr4dx8WxpQZ6jAD2R` |
| Source | Dirty worktree `codex/mobile-phase-5-visual-qa`, base `7758aeb4d3bcd1e2026e9ea0a68e2e4f923b60ee`; no commit or merge |
| Framework / runtime / build | Next.js / Node 22.x / approximately 35 seconds; ready `2026-08-30T20:45:59.385Z` |
| Upload | 621 regular files, 8,794,747 bytes; required mobile API/shared-package files present |
| Upload manifest SHA-256 | `66a4e8270dc3c3f4199063fce1880985509ca1daa74ae84839a18652733071fb` |
| Aliases | Empty; no alias/promote command executed |
| Existing custom staging domain | Unchanged: `dpl_8FxHqTEgrPKAMyXN5wQgMdP4kPom` |
| Staging project's production target | Unchanged: `dpl_AJDmQw8yo8rjvDsRAidA9EzTcSgq` |

Preflight resolved only the public Preview Supabase URL and confirmed exact project
`rxuvchdqbzvovqijvfhx`; no server secret was revealed, changed, or copied. Secret
metadata remains Preview-scoped. The upload excludes environment/signing files,
local tool settings, private QA screenshots, native build folders, and caches.
Vercel guidance informed these upload and target checks. The deploy command used
`--target preview`; `--skip-domain` was not used because it is production-only.
No cron endpoint was invoked. Vercel documents scheduled cron requests against the
[production deployment URL](https://vercel.com/docs/cron-jobs).

Checks against this exact protected Preview used Vercel CLI access and no
application bearer token or cookie:

- `GET /login`: 200, without a sign-in attempt.
- `GET /api/health/supabase`: 200, `ok: true`, upstream Auth health 200, no-store.
- `GET` bootstrap and record detail: 401 / `Not authenticated`, no-store.
- Empty unauthenticated `POST` daily-log sync, photo prepare, photo finalize,
  record create, and PDF report: 401 / `Not authenticated`, no-store. Authentication
  rejected these before a database record or storage operation was reached.

No record, account, membership, password, schema, device draft, installed app,
customer deployment, or store release changed. These checks **do not** prove the
intermittent signed-in JWT failure resolved or the full workflow succeeded.
The reviewer script/test were subsequently pinned locally to this new URL; only
`--check` is permitted within this non-mutating pass. The script's default full
mode creates fixtures, so do not run it without clarifying synthetic-test authority.

The following sections retain the earlier deployment and diagnostic history.

- Worktree: `/private/tmp/railcommand-mobile-phase-5-visual-qa`, branch
  `codex/mobile-phase-5-visual-qa`; previous uncommitted work preserved.
- Vercel CLI verified project `prj_JWLbG1P1z06rCpN1bDI2DuugVpCy` under team
  `team_s16JIS0pr4dx8WxpQZ6jAD2R`, named `railcommand-mobile-staging`.
- Pulled public Preview configuration resolves to Supabase
  `rxuvchdqbzvovqijvfhx.supabase.co` and `mobile-staging.railcommand.io`.
  The local configuration remains ignored by Git. Server secrets are hidden by
  Vercel and were not retrieved, printed, or changed.
- Existing preview `dpl_8FxHqTEgrPKAMyXN5wQgMdP4kPom` is READY and Preview-only:
  `https://railcommand-mobile-staging-l5acq3goj-dillans-projects-f662840b.vercel.app`.
- Authenticated Vercel CLI access to that preview's `/api/health/supabase`
  returned HTTP 200 with `ok: true` and `Cache-Control: no-store`.
- An unauthenticated `/api/mobile/v1/bootstrap` request returned HTTP 401,
  `Not authenticated`, and `Cache-Control: no-store, max-age=0`; no project data.
  This does not prove a signed-in bootstrap or any mutation.

## Staging dashboard access — resolved

The user signed in through the existing dashboard. Read-only inspection verified
organization **RailCommand Mobile Staging** (`qshmtslwjtyqhihblpsh`) and its sole
project **RailCommand Mobile Staging** (`rxuvchdqbzvovqijvfhx`, AWS `us-east-2`).
The connector still lacks access and the CLI has no Supabase access token, so the
supported dashboard SQL editor was used for read-only metadata queries. No account
was signed out and no password, key, access grant, or deployment protection setting
was changed.

Use the existing staging-owner alias `mobile-staging@railcommand.io` documented in
the Phase 4 handoff to sign in to Supabase. This is distinct from the application
reviewer `app-review@railcommand.io`. A physical phone is not needed for this step.

## Pre-extension schema findings (read-only, 2026-08-30)

- Present: profiles, projects, project_members, daily_logs, the three daily-log
  child tables, and attachments. Each has RLS enabled and no anonymous SELECT grant.
- Missing: rfis, submittals, rfi_responses, milestones, punch_list_items,
  earthcam_embeds, and entity_number_sequences. Projects also lacks budget_total
  and budget_spent. These are required by the newer local bootstrap/record routes;
  a cached dashboard is not proof of successful current bootstrap integration.
- Daily-log temperature is numeric(5,1), work quantity numeric(12,2), and crew/
  equipment counts int4. The parent contains wind and geo_tag as expected.
- The three daily-log children have INSERT-owner policies but **no authenticated
  SELECT grant or SELECT policy**, so complete detail readback requires an additive,
  parent-authorized read rule.
- Profile and project-membership reads are currently self-only, which is inadequate
  for shared-project team and assignee choices. Any extension must remain limited
  to authorized shared projects and avoid recursive RLS.
- Storage contains private project-photos and thermal-photos buckets. There is no
  project-documents bucket. Existing object policies support owner-authorized
  daily-log photo operations only, not RFI/Submittal attachment downloads.
- The staging fixture marker is present. The existing app reviewer has manager /
  can_edit membership in the synthetic project; its credentials were not read or
  reset. The older automation email was not present in the inspected profile set.
- Child-table foreign keys and the attachment entity/category constraints match
  the required readback/attachment contract. The existing daily-log sync RPC remains
  executable by authenticated users. `public.log_activity` is absent in staging.

These findings led to the transaction-guarded extension under `supabase/staging/`,
grounded in `supabase/schema_snapshot.sql`, without production migration changes.
The user approved applying this exact staging extension and rollback-only checks.

## Applied staging extension and database acceptance

- [Schema extension](../../supabase/staging/phase5_mobile_workflows.sql): adds the
  seven missing tables and two project budget columns, shared-project team reads,
  parent-authorized daily-log child reads, restricted RFI/Submittal inserts with
  server numbering, an empty private document bucket, and exact-parent attachment
  reads. Existing EarthCam endpoints receive only their needed server-role grants;
  no authenticated or anonymous direct EarthCam writes are added.
- [Rollback-only database checks](../../supabase/staging/phase5_mobile_workflows.acceptance.sql):
  used two temporary synthetic projects and a temporary membership for the
  existing reviewer, with all changes rolled back. It checks scoped reads, record
  insertion/UUID collision behavior, denied references, read-only membership,
  unknown-subject isolation, and attachment authorization. It creates no auth
  account, password, Storage object, or uploaded file, and changes no existing
  membership. The entire file executed successfully and rolled back.
- Primary and independent static review completed. The initial EarthCam server
  grant omission was corrected before approval. Both SQL files were executed in
  the signed-in dashboard for `rxuvchdqbzvovqijvfhx` only. No local database was started.

### Execution evidence — 2026-08-30, verified by 17:52 UTC

- Schema script returned **Success. No rows returned** after its transaction committed.
- Acceptance returned **Phase 5 SQL acceptance passed; all fixtures are being rolled back**.
- A separate post-transaction query confirmed 7 new RLS-enabled tables, 2 project
  budget columns, and 3 private attachment buckets.
- Remaining acceptance projects: **0**; temporary memberships: **0**; test RFI,
  Submittal, and attachment metadata rows: **0**. The document bucket has **0 objects**.
- The existing reviewer retains its original manager/can-edit membership. No user,
  password, original membership, uploaded file, or existing device draft was changed.
- Exact executed source SHA-256 values (retain scripts unchanged for provenance):
  - Schema: `981901931a3a6744a48c2a572f6f89a8787ffc4a96ddba36538b82e41b467550`
  - Acceptance: `bc354abeecb8cc66a5d5ed41bc3ebb7e6f4edd94842b5a9335e2fedbead174cd`
- The scripts' proposal-era header comments are historical; this execution record
  is authoritative. The schema script is one-time and must not be blindly rerun.

Database assertions passed for scoped child/team reads, restricted privileges,
server-assigned numbering, duplicate UUID protection, denied cross-project and
assignee/milestone references, read-only membership, unknown-subject isolation,
and exact-parent attachment metadata authorization. These are real PostgreSQL/RLS
tests, not HTTP authentication, file-download, or native-device acceptance.

### Security Advisor review

The staging dashboard's Security filter showed six findings:

- Leaked Password Protection Disabled (existing Auth setting; not changed).
- Signed-in execution of the existing `cancel_account_deletion` and
  `request_account_deletion` SECURITY DEFINER RPCs (two findings; unchanged).
- RLS Enabled No Policy for `mobile_staging.fixture_manifest`, `public.organizations`,
  and `public.entity_number_sequences`. The last is the new private counter table:
  no client table grants/policy are intentional; only the guarded numbering trigger
  accesses it. No broad policy was added to silence the advisory.

This is not a claim that all project security findings are resolved. Existing Auth
and deletion-RPC findings remain release-review items. No new public SECURITY
DEFINER function or anonymous table grant was added by this extension.

### Preview deployment preflight — approval resolved, deployment completed

- CLI 59.10.0 rejects `--skip-domain` for Preview; it is production-only. Do not
  use `--prod` to work around this. A unique Preview URL remains unique, but stable
  generated branch/latest aliases may move. No documented Preview flag guarantees
  zero existing alias movement.
- Read-only environment metadata shows 12 general Preview variables, all with
  `gitBranch=null`. The server key and cron secret are sensitive/secret; no values
  were retrieved or changed. There is no Phase 5 branch-scope omission.
- Both staging project domains have `gitBranch=null` and no custom environment.
  The existing `mobile-staging.railcommand.io` alias currently points to
  `dpl_8FxHqTEgrPKAMyXN5wQgMdP4kPom`. Preserve that assignment and compare after any
  separately approved Preview deployment; do not run alias/promote commands.
- Added explicit upload exclusions for environment files, private evidence,
  signing files, backups, Supabase temporary metadata, and build caches. No new
  native folders, credentials, or unrelated artifacts should enter the upload.
- The user approved generated Preview-link updates while keeping the custom
  staging URL, production, and stores unchanged. Exactly one Preview was dispatched
  as recorded below; no alias, promotion, Git push, or production deploy command ran.

References: [CLI skip-domain](https://vercel.com/docs/cli/deploy#skip-domain),
[generated deployment URLs](https://vercel.com/docs/deployments/generated-urls).

### Step 1 deploy result — 2026-08-30, 18:09 UTC

- URL: https://railcommand-mobile-staging-iyluvnb4a-dillans-projects-f662840b.vercel.app
- Deployment: `dpl_8JCGcAzdPquFkSm9Auw3dm4kmUum`
- Target: **Preview**, confirmed by `vercel inspect`; REST uses `target: null`
  for this Preview. Final state: **READY**.
- Project/team: `prj_JWLbG1P1z06rCpN1bDI2DuugVpCy` /
  `team_s16JIS0pr4dx8WxpQZ6jAD2R` (`railcommand-mobile-staging`).
- Source: existing dirty worktree on `codex/mobile-phase-5-visual-qa`, based on
  `7758aeb4d3bcd1e2026e9ea0a68e2e4f923b60ee`. This is **not** a clean-commit build;
  uncommitted and untracked implementation files were included without a commit.
- Framework: Next.js 16.3.3, Node 22.x. Remote `npm run build` / Turbopack passed,
  including TypeScript. Vercel build: **37 seconds**; dispatch-to-ready: about
  **53 seconds**. Existing middleware-to-proxy deprecation warning remains.
- Actual CLI dry run: 626 regular files, 9,354,265 bytes; 637 entries including
  empty directories. No detected credential/signing files or native-build contents.
  Required root/workspace manifests and shared-package entrypoints were included.
- Fresh local pre-deploy checks: `npm run test:mobile` **275 passed**;
  root `npx tsc --noEmit` and `git diff --check` passed.
- Final REST `alias` list was empty; no generated aliases were assigned to this
  deployment. The unique deployment URL is available with existing protection.

### Post-deployment checks — 2026-08-30, 18:10–18:12 UTC

All requests targeted the exact new Preview through authenticated Vercel CLI
access; deployment protection was not disabled. Application requests below did
**not** contain an application bearer token.

| Check | Observed result |
| --- | --- |
| `GET /login` | HTTP 200; no sign-in attempt |
| `GET /api/health/supabase` | HTTP 200, `ok: true`, upstream Auth health status 200, `Cache-Control: no-store` |
| `GET /api/mobile/v1/bootstrap` | HTTP 401, `Not authenticated`, `no-store, max-age=0` |
| `GET /api/mobile/v1/records/detail` | HTTP 401, `Not authenticated`, `no-store, max-age=0` |
| `POST /api/mobile/v1/records/create` with empty JSON | HTTP 401, `Not authenticated`, `no-store, max-age=0`; no record created |
| `POST /api/mobile/v1/reports/pdf` with empty JSON | HTTP 401, `Not authenticated`, `no-store, max-age=0`; no report generated |
| Custom staging URL | Still `dpl_8FxHqTEgrPKAMyXN5wQgMdP4kPom`, exact before/after match |
| Staging project's production target | Still `dpl_AJDmQw8yo8rjvDsRAidA9EzTcSgq`, exact before/after match |

These checks prove Preview deployment, reachability, and unauthenticated rejection,
not successful signed-in bootstrap, record creation, PDF rendering, Storage signing,
or a native-device round trip. No database schema/data, user credentials, project
permissions, device drafts, main branch, or store release changed during Step 1.
This Vercel deployment does **not** update the installed Expo application.

This is a reduced contract fixture, not full production-schema parity. General
administration, record review/update/delete, search, notification/activity side
effects, and punch creation are intentionally excluded. In particular, EarthCam
API success will not establish activity-audit parity until the missing activity
function is addressed. A later existing-backend compatibility/release gate remains
required before production connection.

## Concrete checks queued for the authenticated pass

### Step 2 authorization/preflight — 2026-08-30

The user approved the focused signed-in pass after Step 1. The exact new Preview
was rechecked and remains Ready. No signed-in request has run yet: the scoped local
test configuration has neither the current reviewer password nor a reviewer access
token (`.env.mobile.local` is absent; the two ignored Preview configuration files
contain only the applicable public staging configuration, not reviewer credentials).
The Supabase dashboard owner login is not an application reviewer session. Asked
the user whether the existing `app-review@railcommand.io` password is available for
masked local entry; no password reset, email, credential-store inspection, account
creation, permission change, device purge, or synthetic mutation was performed.

#### Masked reviewer runner prepared (not yet signed in)

The user confirmed they have the existing reviewer password. Added the bounded
`scripts/mobile/verify-preview-reviewer.mjs` entry point and synthetic workflow
module. The runner pins the exact Preview, staging Supabase host, public API key,
Vercel project/team, reviewer identity, and synthetic project. Password entry is
TTY-only and hidden; credentials remain in memory. Application bearer tokens and
request bodies use stdin, not process arguments or files. A tiny curl wrapper
forces `--disable` to be the real curl's first argument, preventing default curl
configuration from enabling traces, output files, redirects, or extra URLs.

Six local transport/parser tests, a synthetic hidden-input TTY check, root
TypeScript, and the exact Preview's unauthenticated preflight passed. The workflow
module loads during preflight before password entry. Independent review identified
the curl argument-order issue, which was corrected before any real credentials.
No product code changed in this preparation, so the Step 1 application build is
unchanged. This is **online-only API verification**, not new native offline evidence.

Computer Use cannot operate Terminal in this session. The user must launch the
runner locally and enter the password there, not in chat. The runner writes only
sanitized results and synthetic record IDs to ignored
`.vercel/phase5-signed-in-result.json`. It signs out only its newly created QA
session; existing phone sessions and device work are not touched. It performs no
password reset, production request, deployment, deletion, or store action.

#### First reviewer attempt — 18:52 UTC

The user ran the masked prompt locally. Exact Preview transport/no-store checks
passed, but reviewer sign-in failed before session refresh or any workflow/record
creation. The original runner suppressed the Auth error code as well as its message,
so this attempt does **not** establish incorrect credentials as the cause. No reset
or automatic retry ran. Its generic “temporary QA session ended” output did not
prove that a session had been created; reporting now explicitly distinguishes this.

A read-only request to the staging `/auth/v1/settings` endpoint returned HTTP 200
with email/password authentication enabled using the same public staging key.
Added allowlisted Auth code/status/type diagnostics, without server messages or
credential values, following the
[Supabase Auth error reference](https://supabase.com/docs/guides/auth/debugging/error-codes).
Eight focused harness tests passed. Waiting for one user-entered retry; no account,
password, production, device data, or backend configuration changes were made.

#### Second reviewer attempt — 18:59–19:00 UTC

Reviewer sign-in and session refresh **passed**. The first authenticated request,
`GET /api/mobile/v1/bootstrap?projectId=20000000-0000-4000-8000-000000000001`,
returned HTTP **403** with the required JSON/no-store response. The runner stopped
before any workflow mutation. The four displayed entity UUIDs were allocated
locally, not created as records. Only the new QA session was signed out.

Read-only investigation through the existing staging dashboard verified:

- Reviewer profile and original manager/can-edit synthetic-project membership exist.
- All ten project columns used by the initial query exist, including both budgets.
- Authenticated SELECT grants exist on profiles, project_members, and projects.
- The two expected project-member foreign keys are present.
- In a read-only transaction under `authenticated`, with this reviewer's subject,
  the profile and joined project read succeed. Changes to local transaction settings
  are rolled back; no grants, roles, memberships, or data were changed.
- The reviewer's Auth role and audience are both `authenticated`.
- Anonymous direct Data API profile, membership, and embedded-project queries
  return HTTP 401 / `42501`, with no data. This does not prove signed-in REST success.
- An independent local synthetic test of the exact server authentication helper
  confirms that the installed SDK preserves Bearer headers on subsequent queries.

No root cause is claimed yet. Added `--diagnose` to the local runner: sign in once,
check only boolean JWT identity/issuer expectations, execute the exact profile and
membership reads through a stateless client, and record the Preview's allowlisted
error message. Only HTTP status/error codes/booleans are retained; no token, full
claims, private records, or raw error message is logged. This mode creates **no**
workflow records and performs no resets or permission changes. Ten focused harness
tests pass. It remains an
**online-only** diagnostic, not additional device-offline acceptance.

#### Diagnostic reviewer attempt — 19:43 UTC, passed

The user's `--diagnose` run completed at `2026-08-30T19:43:37.228Z` with
`status: diagnostics-passed` in the ignored sanitized result file. Reviewer sign-in
and refresh passed. Token identity checks confirmed the expected authenticated
role, reviewer subject, and staging issuer without retaining the token or claims.
Direct profile and exact embedded-membership queries returned HTTP 200 with no
database error code; manager role, original synthetic membership, edit permission,
and project visibility were all confirmed. The exact Preview bootstrap also passed.

The earlier 403 did **not** recur in this diagnostic; its cause was then unconfirmed. No permission,
membership, credential, schema, application-code, or deployment change was needed
for this successful run. No workflow records were created. Only this temporary QA
session was ended; existing device sessions and queued work were not changed.

The later full-run result and confirmed masking defect are recorded below.
RFI/Submittal attachment retrieval with an
existing valid record attachment and actual inaccessible-project HTTP isolation
remain separate evidence gaps unless suitable existing synthetic fixtures are
available; missing-record/attachment rejection must not be described as those tests.

#### Full runner — 20:08 UTC, stopped; upstream error identified

The full runner completed at `2026-08-30T20:08:05.258Z` with `status: failed`.
Reviewer sign-in and refresh passed; the exact Preview bootstrap returned 403 with
`Could not verify project access`. No workflow write was reached. UUIDs printed
before bootstrap were allocated locally, not created as database records.

Read-only API Gateway inspection in staging project `rxuvchdqbzvovqijvfhx`
subsequently showed:

| UTC request time | Path | Upstream status | Proxy error |
| --- | --- | --- | --- |
| `20:08:04.577000` | `/rest/v1/profiles` | 200 | none |
| `20:08:04.579000` | `/rest/v1/project_members` | 401 | `PGRST303` |

Both requests carried the authenticated role with the same issued-at and expiry
timestamps (issued 20:08:02 UTC, expires 21:08:02 UTC). No access token, session ID,
password, key, IP address, or private record was selected or retained. The
membership response's `Proxy-Status` was `PostgREST; error=PGRST303`.
The JWT claim category/message was not available from the inspected service logs.
Clock/claim timing remains a hypothesis, not an established cause.

The demonstrated application defect was that bootstrap mapped **every** initial
query error to 403, hiding an upstream authentication failure and preventing the
existing API client's single 401 session-refresh retry. The local correction
preserves RLS, genuine permission denials, no-store responses, fail-closed
behavior, and saved-device work. No password reset, permission grant, schema change,
or arbitrary retry delay is justified by this evidence.

A new unique Preview was requested for verification; until explicitly approved
and deployed, the existing Preview and installed native app remain unchanged.
The signed-in workflow acceptance gate is still open.

Reference: [PostgREST JWT error codes](https://docs.postgrest.org/en/stable/references/errors.html#group-3-jwt).

#### Local correction verified; deployment still pending

- Bootstrap preserves user-scoped upstream 401 / `PGRST301–303` as 401 so the
  existing client can refresh once. Confirmed permission failures remain 403;
  unknown/internal failures are 500. Admin EarthCam service-credential failures
  remain internal errors, not user-session errors. Non-2xx null/empty responses
  also fail closed, with no partial project payload or raw database message.
- App refresh messaging distinguishes session verification, denied access, and
  connectivity/server failure while retaining the current user's saved data.
  Known-offline fallback and draft/outbox persistence are unchanged. No sign-out,
  purge, new retry policy, or storage mechanism was added.
- The synthetic verifier now mirrors the app's single unexpected-401 refresh and
  same-request replay; it does not retry 403, expected-negative checks, transport
  failures, failed refresh, or a second 401. Request identities stay unchanged.
- Verification: 358 total mobile/shared/API tests (including 78 focused bootstrap
  tests and 21 provider lifecycle tests), 14 verifier tests, root/mobile TypeScript,
  targeted ESLint and diff checks passed. Final `npm run build -- --webpack`
  passed; root `npx tsc --noEmit` was run after build regeneration completed.
- These corrections are local only on `codex/mobile-phase-5-visual-qa`. No new
  Preview, alias reassignment, database mutation, installation, Expo upload, store
  action, or main-branch commit/merge occurred. Staging JWT claim timing remains
  unconfirmed, and the signed-in workflow gate remains open until retested.

#### Bounded follow-up: queued log/photo session failures — local only

The same read-error collapse existed in daily-log writes and photo authorization.
They now reuse bootstrap's status-only classifier: user authentication failures
remain 401, confirmed permission/missing-profile denials remain 403, and unknown
write/authorization failures are retryable 503. Validation/integrity failures stay
permanent 400 without raw SQL/row messages. Successful log/photo responses require
the queued identity and an explicit duplicate flag before acknowledging success.
No RPC, RLS, Storage configuration, or deployed definition was changed.

The existing API client still makes at most one refresh/replay. If that leaves a
401, the native worker marks the current log/photos retrying with a static session
message and pauses later rows in this foreground batch. A fresh foreground attempt
can resume using the same saved payload, client IDs, idempotency keys, and photo
references. Account change/purge still cancels without new failure writes. True
403 and other existing failure/conflict behavior remain unchanged.

Supabase/PostgREST guidance informed the separation of authentication, permission,
and temporary failures; it does not establish the exact rejected JWT claim in the
live staging incident. This is **offline draft/queue** behavior, with server
reauthorization still required. No added background mechanism or public cache.

Final local verification: **494 mobile/shared/API tests passing** (27 domain,
5 offline, 10 API client, 204 native, 245 mobile API, 3 links), plus **14 verifier
tests**. New bounded coverage comprises 26 daily-log route/SDK cases, 104 photo
route/SDK cases, and 6 native 401 pause/resume cases. Root compatibility build
`npm run build -- --webpack`, subsequent root/mobile TypeScript, targeted ESLint,
and diff checks pass. Synthetic fault tests do not prove native file durability or
deployed authorization. No deployment, alias, account, device, or production action
occurred. The new unique Preview remains approval-gated; no further local feature
expansion is needed before that verification.

The bounded acceptance sequence is: reviewer sign-in/refresh and scoped bootstrap;
one rich daily log with replay/readback; one small synthetic photo with upload and
finalize replay; one RFI and one Submittal with UUID replay/content-conflict checks;
record detail and one-record PDF; safe nonexistent/cross-project denial checks.
Keep tokens, signed upload URLs, and PDF bodies out of output. A nonexistent-project
denial must not be reported as proof of actual cross-project isolation. Retain any
new synthetic records/files and record their IDs; no automatic deletion is approved.

Do not run `verify-mobile-staging.mjs` unchanged: it targets the older custom host,
rotates an automation password, and deletes rows using a linked SQL connection.
The reviewer verifier's optional recovery-email flag must stay off. Reuse its
sign-in/no-store assertions only; do not change other device sessions.

1. Inspect current staging columns, foreign keys, grants, and RLS before assuming
   the checked-in Phase 1 fixture describes today's database. The local bootstrap
   requires project budget fields and RFI/Submittal/Punch/EarthCam tables that the
   original fixture alone does not contain.
2. Verify derived camera/create capability flags and project/team visibility with
   synthetic membership. Do not weaken unknown/denied capability handling.
3. Complete the richer daily-log readback contract: temperature, wind, location,
   personnel, equipment, and work items are sent during creation but omitted from
   the current bootstrap/native detail. Verify parent-authorized child-table reads
   and numeric column limits before accepting the round trip.
4. Verify RFI/Submittal UUID replay, database numbering triggers, current-role
   authorization, and the member/admin behavior of record creation, options,
   detail, and PDF joins. Local passing tests do not establish deployed RLS.
5. Verify exact-parent attachment lookup and Storage signing policies. Existing
   daily-log photo policy evidence does not prove RFI/Submittal attachment access.
6. Build and deploy only after those contracts are known; then exercise synthetic
   creation/readback, duplicate delivery, and denied/cross-project requests against
   the exact unique preview. Record IDs and results without credentials.

## Offline classification and acceptance limits

- Daily logs/photos: **offline draft/queue**, preserving client IDs, idempotency,
  server reauthorization, and parent-before-photo ordering.
- Cached project/team/record text: **offline read-only**.
- RFI/Submittal text forms: **offline draft, online-only submission**.
- PDF/attachment retrieval and live camera playback: **online-only**.

## Readback fix — locally verified and now deployed in the Preview backend

- Added optional, allowlisted daily-log temperature, wind, GPS, personnel,
  equipment, and work-item readback to the domain contract, authenticated bootstrap,
  and native detail screen. Older cached payloads remain readable and explicitly
  label unavailable fields instead of pretending they are empty.
- Queue conversion rejects temperature/quantity overflow or excess precision
  before the database could round or reject it. The original raw draft input and
  identity remain unchanged. No outbox or storage architecture was added.
- `npm run test:mobile`: **275 passing** (domain 27, offline 5, API client 10,
  native client 188, mobile API 42, links 3), including 25 additional tests.
- Root `npx tsc --noEmit`, mobile typecheck, targeted lint, and diff checks pass.
- `npm run build -- --webpack` passes. Existing middleware/Edge-runtime warnings
  remain; this is a local compatibility build, not deployment to production.

These local/synthetic-transport checks are supplemented by the database acceptance
and Preview deployment checks above, not by a new native-device run. No new phone
installation, Expo upload, or store action occurred. The native readback screen
change still needs the next internal build. Full web parity, signed-in staging
HTTP round-trip verification, device acceptance, and release readiness remain open.

Step 1's operational classification is **online-only deployment/verification**.
Existing daily-log/photo **offline draft/queue**, cached **offline read-only**
views, and RFI/Submittal **offline drafts with online-only submission** are unchanged.

Reference checks: [Supabase API security](https://supabase.com/docs/guides/api/securing-your-api)
and the [explicit Data API grants change](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically).
These informed the approved explicit grants and scoped RLS verification.
