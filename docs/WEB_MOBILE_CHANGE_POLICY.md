# Web and mobile change policy

Every RailCommand change must assess both the web app and native mobile app before
implementation. Read this file together with AGENTS.md. Matching functionality,
data meaning and permissions are required; layouts can adapt to each platform.
A Markdown checklist is a development/review rule, not automatic code conversion
or a guarantee that every contributor or tool will follow it.

## Change workflow

1. Record the affected web screens, mobile screens, shared domain/API contracts,
   backend routes and database objects. For each platform say: changed, already
   covered by shared code, or not applicable with a reason. Do not silently omit
   mobile from a web task (or web from a mobile task).
2. Classify offline behavior using AGENTS.md. Document what survives disconnection,
   app restart and sign-out, and what happens to queued work after an upgrade.
3. Put common validation, types and business rules in existing shared domain/API
   packages or server services when possible. Reuse authenticated server operations
   and the same authorized production records. Do not build a second live data store
   or duplicate business rules independently in web and native UI.
4. Implement every applicable platform change in the same change set or linked
   changes. A shared feature is not complete until both sides are implemented and
   verified. An intentional platform gap must be explicit in the task/PR, with its
   reason, user-visible limitation, follow-up and release dependency. A web-only
   marketing-page edit can simply say mobile is not applicable.
5. Verify the full flow using synthetic records in a designated test environment or
   explicitly authorized demo project: web create/edit -> mobile refresh; mobile
   create/edit -> web refresh; same account/project identity and permissions. Cover
   denied access, retry/idempotency and concurrent changes where relevant. Never
   use real field records as disposable test fixtures.
6. Run relevant shared/backend and platform tests, TypeScript and builds. For native
   lifecycle, permissions, recording, files or offline changes, include physical
   device checks on the supported release platforms. Record untested platforms as
   pending rather than passed. Documentation-only changes need link/content review,
   not application rebuilds.
7. State the rollout: backend/web deployment, mobile build(s), tester assignment,
   compatibility evidence and rollback. Verify availability rather than equating
   uploaded with installed or tested. Record outcomes in the PR or durable handoff.

## Release compatibility and live data

Installed mobile apps cannot all update at once. Backend changes must continue to
accept supported older clients and their persisted queued payloads. Prefer additive
API/schema evolution and tolerant readers. Breaking changes need versioning or a
staged migration with a tested rollback and explicit handling of older outboxes.
Never solve a sync failure by purging the queue, silently merging/overwriting live
records, assigning a different project/date, or changing an idempotency identity.
Revalidate authentication, membership and RLS on every server-side operation.

Shared data does not mean every screen refreshes instantly: assess subscriptions,
cache invalidation and foreground/manual refresh on both platforms. Show truthful
pending, failed, conflicted and synchronized states.

A backend-only change can reach compatible installed apps through the API. Native
UI, bundled logic, plugins and permissions normally need a new signed mobile build
and TestFlight/Play distribution. The current Expo app has no configured OTA update
mechanism; do not promise an automatic mobile code update after a web deployment.

## Current source locations — verify before deployment

As recorded in the September 16 release handoff:

| Area | Location / branch | Responsibility |
| --- | --- | --- |
| Web/offline development | Repository root, `codex/offline-foundation-day-1` | Contains separate in-progress changes; not the verified mobile backend release source |
| Native app and shared packages | `.mobile-recovery/candidate`, `codex/mobile-beta-20260910` | `apps/mobile`, `packages/domain`, `packages/api-client` |
| Released web/mobile backend | `.mobile-recovery/live-backend`, `codex/mobile-live-backend-20260916` | Web behavior and `/api/mobile/v1` routes |

These are temporary Git worktrees of one repository, not independently maintained
products. Read current Git/deployment state and the release handoffs; do not assume
main or the root checkout contains all deployed mobile routes. Before deploying any
web revision, verify it retains the currently released mobile API, authentication,
allowlist, RailBot and sync behavior. Prefer integrating reviewed changes into one
canonical release branch through a reviewed merge; never deploy the root's unrelated
uncommitted work wholesale. Branch consolidation is an outstanding follow-up, not
completed by adding this policy. Keep this policy and AGENTS.md in the canonical
repository, and carry them through active release branches while split work remains.

## Impact record template

Use the PR template; for work without a PR, include this in its durable handoff:

- User-visible change:
- Web impact and implementation:
- Mobile impact and implementation (or reason not applicable):
- Shared API/domain/database impact:
- Offline classification and draft/queue upgrade behavior:
- Supported older mobile builds and compatibility evidence:
- Permissions, idempotency and conflict handling:
- Web -> mobile and mobile -> web verification:
- Tests/builds/device checks passed; checks still pending:
- Deployment/build/assignment IDs and rollback:
- Deliberate gaps and linked follow-ups:

## Open acceptance items (September 17, 2026)

- User reports RailBot working after internal build 300008. This is user confirmation,
  not blanket acceptance of every dictation/offline/device scenario.
- User screenshot confirms two September 16 daily logs remain conflicted because
  a log already exists for the same project/date. No photos are queued. Do not mark
  those entries delivered because the banner also shows a last-sync time.
- Still decide whether the product supports multiple separate logs per project/day
  or one shared daily log. Preserve the two device entries until a deliberate
  recovery workflow is implemented and verified; do not remove the live uniqueness
  constraint or rewrite field data based solely on this documentation task.
- External beta review/privacy requirements and broader device acceptance remain
  tracked in the mobile release handoffs. Do not infer general field readiness from
  an internal TestFlight assignment.
