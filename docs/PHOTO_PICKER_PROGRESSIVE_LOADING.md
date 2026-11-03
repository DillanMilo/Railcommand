# Progressive daily-log photo library

## Measurement before switching readers

`node scripts/measure-photo-picker.cjs` runs the unchanged legacy action and the
existing paginated reader against the same 1,000-photo synthetic Supabase fixture.
No production records, credentials or writes are used. Results:

| Initial read | Backend requests excluding auth | Signed paths | Returned rows | JSON bytes |
| --- | ---: | ---: | ---: | ---: |
| Legacy collection | 7 | 1,000 | 1,000 | 740,460 |
| First cursor page | 3 | 12 | 12 | 8,886 |

Initial JSON is 98.8% smaller in this fixture. This measures request work and
serialized bytes, not production elapsed time or a guaranteed page-load gain.
The audit's production photo-route tail cannot identify the picker separately.
Next production validation: compare authenticated Server-Timing query/signing/total
and response bytes on the picker request for representative project sizes.

## Implementation and platform impact

- **User-visible change:** new/edit daily-log photo library loads 12 recent photos,
  then appends pages through Load more photos. Report-date photos sort first among
  loaded pages; older photos remain reachable. Images load lazily.
- **Web:** PhotoLibraryPicker uses the existing private cursor endpoint. Already
  loaded rows stay visible while another page loads or fails. Selection is by
  attachment ID, deduplicated across pages and excluded after adding to the form.
  Downloads append to the latest parent input, preserving concurrent camera input
  and captions. Late responses cannot populate a different account/project; late
  downloads cannot modify a different project/date or unmounted form.
- **Mobile:** the online in-app Workspace uses this same component and API.
  Chromium desktop and WebKit at 390px exercise the actual component/hook with
  synthetic account/API boundaries. Native Field tools do not use this picker;
  their bundled code, camera, queues and drafts are unchanged. Browser WebKit is
  not physical iPhone/Android WebView acceptance.
- **Shared API/domain/database:** no changes. Existing cursor transport rechecks
  authentication/membership and RLS; no-store responses stay out of public caches.
  The legacy array endpoint and released `/api/mobile/v1` contracts remain intact.
- **Offline classification:** library browsing/downloading is **online-only**.
  The existing offline notice remains. Going offline aborts pending page reads;
  loaded pages and checked IDs remain in component memory and reconnect resumes
  unfinished reads. It does not drain additional pages on reconnect. Failed
  downloads preserve selected IDs and parent photos for retry.
- **Draft/queue behavior:** no storage/schema/serialization changes. Existing
  drafts, outboxes, idempotency identities and sign-out cleanup are unchanged.
  Browsing selections are ephemeral as before; this change does not promise they
  survive form closure/restart. Existing form draft persistence remains owned by
  its existing workflow. No private records enter localStorage/Cache Storage.
- **Permissions/conflicts:** server authorization remains mandatory per page;
  denied reads clear library rows. No record mutation or conflict policy changes.
- **Cross-platform writes:** not applicable; this change only changes library
  reads. Existing photo upload/finalization code remains intact.

## Verification and rollout

- `npm run build`, `npx tsc --noEmit`, focused ESLint.
- `npm run test:project-photos`: 25 tests.
- Workspace collection and public-cache tests: 8 tests.
- `scripts/e2e-photo-library.cjs`: desktop Chromium 1280px, WebKit 390px;
  initial page bounds, cross-page selections, retry, mid-request disconnection,
  reconnect, failed download, captions, concurrent camera input, stale
  account/project responses and horizontal overflow. Requires Playwright and
  esbuild available to Node, a built `.next/static/css`, and installed browsers.
  External Playwright can be supplied through NODE_PATH without dependency changes.
- No deployment or native build performed. A web release will update the online
  Workspace after refresh; no native bundled update is required for this picker.
  Rollback is reverting the component/hook change; no persisted-data migration.
- Gaps: authenticated staging timing/browser trace and physical iPhone/Android
  Workspace file/connection checks remain unverified. Synthetic checks do not
  establish live backend latency, device acceptance or broader offline readiness.

## Release review — November 3, 2026

Focused source review found no blocking findings: pagination uses existing RLS and
membership checks; each response is scoped/cancelled; checked IDs survive appends
and connection transitions; parent photos/captions append from the latest state;
stale downloads are discarded and unsuccessful previews released. No application
routes, auth protections, migrations, native Field storage or queue code changed.
The reviewed base matches live production `b4e77374` / deployment
`dpl_yBsiNYs3yFrapcM9RUFmjFQ2jerx` (rollback target). The release uses the same
canonical web origin for desktop/mobile browser and native online Workspace.
Native Field persistence remains unchanged. Physical device checks are still a gap,
not a required new native build. Deployment outcome will be recorded in the PR
and automation memory after verification.
