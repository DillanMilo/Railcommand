# Mobile production safety boundary

Last updated: 2026-08-20

## Non-negotiable invariant

Mobile development, automated testing, beta testing, and store review must not
mutate, expose, copy, or interrupt live RailCommand user data.

## Isolation baseline

The mobile worktree has a dedicated Supabase project, Vercel project/deployment,
and Firebase project. A fail-closed mobile environment identity guard verifies
their immutable identifiers and rejects the known production projects and
origins before a mobile build or staging deployment.

This branch was created in an isolated worktree from committed revision
`2a1958b9056db10826a1db9b06e6cf459ca688d7`. It does not contain or modify the
uncommitted work in the primary working tree.

## Resource isolation

Mobile development requires dedicated non-production resources:

- Separate Supabase project with a distinct project reference
- Separate database, Auth users, Storage buckets, RLS policies, and redirect URLs
- Separate Vercel staging project or an equivalently isolated deployment target
- Separate APNs development configuration and Firebase development project
- Separate email sender/sink that cannot contact real customers
- Separate observability project/environment if crash reporting is introduced
- Separate restricted API keys for optional services such as OpenAI, Resend, and
  EarthCam; omit integrations from the spike unless required

Production exports, restored production backups, real customer email addresses,
real project photos, and copied access tokens are prohibited in staging. Seed
only synthetic organizations, projects, users, logs, and attachments.

## Credential boundary

- A mobile bundle may contain only intended public/publishable client values.
- Supabase service-role or secret keys are prohibited in mobile source, build
  variables, JavaScript bundles, native resources, logs, and crash reports.
- App Store Connect keys, APNs private keys, Android upload keystores, Firebase
  server credentials, and signing passwords remain in an approved secret store.
- No credential is shared between staging and production.
- Frontend authorization is never trusted. Every mobile mutation is authenticated
  and authorized again by the server/RLS at synchronization time.

## Build-time environment guard

The `npm run mobile:env:check` build check fails unless all of these are true:

1. `MOBILE_BUILD_PROFILE` is explicitly `development` or `staging` for local
   and beta builds.
2. The configured Supabase URL contains the approved staging project reference.
3. The configured application API URL is the approved staging origin.
4. No service-role/secret/admin credential is present.
5. The bundle/package ID is `io.railcommand.app.dev` outside a controlled release
   build.
6. Production builds require a separate, explicit release job and human approval.

The guard is covered by `npm run test:mobile-env`. Its committed example values
are placeholders only; actual staging and production-denylist identifiers belong
in ignored local configuration and managed deployment secrets.

Do not infer environment from a branch name, hostname substring, or `NODE_ENV`
alone. Match explicit immutable project/origin identifiers.

## Database and backend change policy

- No database command is run against production during Phase 0 or the Phase 1
  spike.
- Schema experiments run locally or on staging first.
- New tables in an exposed schema must have explicit Data API grants where
  required and RLS before client access. Supabase's 2026 Data API exposure change
  means new tables cannot be assumed to be automatically available.
- Security-definer RPCs require explicit authenticated-user, membership,
  permission, input, idempotency, and ownership checks; execution is revoked from
  unintended roles.
- Migrations receive local/staging verification and a separate production change
  request. Creating a migration file does not authorize production application.
- Store review and beta accounts use staging until a deliberate production
  release-candidate exercise is approved.

## Offline safety

- Private offline records remain in a database partitioned by authenticated user.
- Public Cache Storage remains static-only; it never contains authenticated HTML,
  API/Supabase responses, signed URLs, or project records.
- Draft/outbox operations retain client UUIDs and idempotency keys.
- Foreground sync is the correctness path; background execution is optional.
- Permission and membership are revalidated when queued work reaches staging or,
  after release approval, production.
- Losing connectivity, closing the app, restarting the device, token expiry,
  storage pressure, and sign-out must not silently delete entered work.
- User A -> B -> A isolation is tested on both native platforms before release.

## Deployment boundary

- Phase 0 produces documentation, permanent store/identifier reservations, and
  isolated staging resources only.
- Phase 1 produces development builds only.
- No `vercel --prod`, production Supabase link/push, production store submission,
  production APNs/FCM send, DNS change, or live feature flag is authorized by the
  mobile program unless the user separately approves that exact release action.
- Store records and permanent identifiers are external state; the approved Apple
  and Google reservations are complete. Neither record has been submitted for
  review or connected to a production build.
- Existing web CI, cron schedules, environment variables, and deployment settings
  remain unchanged.

## Required evidence before any production-connected test

- Staging physical-device acceptance passes.
- `npm run build`, `npx tsc --noEmit`, relevant web/offline tests, and new mobile
  tests pass.
- Release bundle inspection finds no forbidden credentials or debug endpoints.
- The target project reference and API origin are printed in a redacted release
  summary and reviewed by a human.
- Database migrations, if any, have rollback/forward-fix plans and staging proof.
- A production backup/recovery check is current.
- A named release owner approves the exact build, identifiers, backend targets,
  and rollout size.

## Stop conditions

Stop immediately if a mobile build resolves to a production URL during local or
beta work, a service-role value appears in a client process, a test account maps
to a real person/customer, a migration target is ambiguous, or a queued test
operation appears in live data. Preserve evidence, revoke exposed credentials if
needed, and investigate before continuing.
