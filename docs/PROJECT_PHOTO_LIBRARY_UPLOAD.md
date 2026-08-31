# Project photo library selection

## Scope and offline classification

**Offline draft/queue.** Photos & Media has separate camera and existing-photo
controls. One selected photo is optimized locally, then a confirmation shows its
upload size. Confirmed photos enter the authenticated user's existing IndexedDB
outbox and blob store atomically. Foreground sync submits them when connectivity
is verified. No automatic upload occurs when confirmation is cancelled.

The currently loaded Photos page can queue while disconnected. The neutral
`/offline.html` restart fallback remains unchanged: it cannot select new standalone
project photos or display this gallery. Already queued photos survive a restart
and resume when the authenticated app can open online. This is not full offline
project work. No authenticated HTML, API response, signed URL, or photo is added
to public service-worker Cache Storage or global localStorage.

The project must already exist. There is no child-parent creation dependency for
these attachments. Sign-out includes them in the existing pending-work check and
two-step discard flow. Browser storage failure leaves the candidate in memory,
shows a clear error and retry/discard controls, and warns before page unload;
it cannot promise persistence if the browser denies storage. The original file
on the phone is never modified. Cancellation discards only the selection.

## Bandwidth safeguards

- One photo per selection; source files larger than 25 MiB rejected before decoding.
- Standard photos resized to at most 1600 pixels for the first optimization pass,
  with 1280/1024-pixel fallback passes if needed. Files already under the existing
  compressor's 200 KiB threshold may retain original dimensions.
- Hard **500 KiB (512,000 bytes)** post-compression cap in client and server.
  Failed/unsupported decoding cannot silently upload a large original. JPEG/PNG/
  WebP output only; unsupported HEIC needs a JPEG export from the device.
- Thermal/radiometric workflows and daily-log limits are unchanged. This control
  is for standard photos; retain originals for fine detail or evidentiary use.
- At most 20 standalone project photos pending in a user's device outbox. This
  bounds local bursts to roughly 10 MiB; it is not a daily or account quota.
- Gallery renders 12 photos per page with native lazy loading. No paid image
  transformation service or generated thumbnail bucket is enabled. Legacy photos
  are unchanged. Reuse the same signed URL in grid and lightbox instead of adding
  a nonfunctional `width` query that creates a separate cache entry.
- The 500 KiB server-action file is forwarded to Supabase Storage. This is an
  existing Vercel + Supabase route; no new paid services or plan changes.

At the maximum new-file size, 100 photos add about 51.2 MB of storage. Every full
network retrieval still consumes bandwidth. These controls reduce per-photo
usage and avoid eager downloads of the entire gallery; they do **not** enforce
Supabase's account-wide storage/egress quotas or guarantee staying on Free.
Current billing-cycle egress and Vercel usage must be checked before production
release. The earlier read-only inventory was approximately 268 MB stored across
all buckets, with 170 existing photos averaging about 1 MB. Storage accumulates;
monthly bandwidth resets. Repeated views and other features share allowances.

## Retry, identity, permissions, and conflict handling

Each selection has a client UUID and `project-photo:<UUID>` idempotency key.
Server handling validates the actor against the current authenticated user,
rechecks project membership on every delivery, validates actual file length/type
and image signature, and inserts through the authenticated RLS client. It uses
the existing attachments primary key and per-user idempotency unique index.
No new SQL migration, service-role access, or server-assigned entity number is
needed. Membership policy matches the existing standalone attachment workflow.

The storage path includes project, user, operation UUID, and a SHA-256 content
hash. Uploads never upsert. A repeat finalized delivery returns success before
uploading again. If storage succeeded but the row was not committed, retry reuses
the same object. Concurrent inserts converge on the same primary key. Different
content under an existing operation UUID fails visibly and never replaces a row.
This is an append-only operation, so no server `updated_at` baseline is needed.

Retries reuse the existing exponential backoff and eight-attempt limit. Failures
retain the operation and blob for Sync Center. Successful local completion removes
the blob, operation, and adds history atomically. An uncertain insert response
never deletes the storage object, since another committed row might reference it.

## Validation and release follow-ups

Automated coverage in `src/lib/offline/project-photo.test.ts` exercises size/type
boundaries, server signature checks, authentication, cross-user delivery,
permission revocation, repeated success, failure before/after attachment commit,
changed payload conflicts, and stable bounded retries. The stateful backend double
is not a substitute for live RLS/device tests. Existing offline and daily-log
photo regression suites are also required.

Release checklist (tracked here; do not describe unchecked items as verified):

- [ ] Actual iPhone/iPad and Android camera vs library selection, including HEIC.
- [ ] Real authenticated queue/reload/reconnect and quota-pressure test on devices.
- [x] Live RLS test for revoked membership and concurrent duplicate submission (2026-08-31).
- [ ] Confirm current organization billing-cycle egress and Vercel usage headroom.
- [ ] Deploy only reviewed changes, excluding unrelated work already in this checkout.
- [ ] Keep the repository's `OFFLINE_ALPHA_ACCEPTANCE.md` physical-device gate intact.

Later operational follow-up: inspect/clean unreferenced objects left by permanent
finalization denial, only after proving no attachment references them; evaluate
account-wide admission quotas and stored thumbnails if real usage warrants it.
Never silently delete field photos to recover quota.

### Local verification result (2026-08-31)

- Production build passed with network access for the existing Google Fonts.
  The initial sandbox build failed only on those font downloads.
- `npx tsc --noEmit`, focused ESLint, and `git diff --check` passed.
- Offline suite: 49 passing, including 9 new project-photo cases.
- Daily-log photo suite: 3 passing.
- Desktop browser, isolated local demo: both buttons rendered; library input had
  no `capture` attribute and allowed one file; camera retained `environment`.
  A 2,881,743-byte synthetic PNG was converted to JPEG; the gallery/lightbox
  displayed `IMG_1234.jpeg` at 453.3 KiB. No browser errors were recorded during
  the selection/upload check. The synthetic image never went to production.
- Production-mode localhost correctly rejected unknown country. The existing
  development-mode demo worked using its canonical `localhost` origin.
- Mobile viewport verification was interrupted by a browser disconnect. Do not
  count it as a mobile pass. Actual phone/IndexedDB/reconnect/RLS checks above
  remain outstanding.
- No production deployment, plan change, or migration was performed. Existing
  unrelated checkout changes were preserved.

### Isolated release acceptance (2026-08-31)

The release candidate is on `codex/client-photo-library-release`, based on
upstream offline revision `a540fd1`, which incorporates current main and the
latest draft/session safety fixes. Do not deploy the original dirty checkout.
This candidate still depends on the offline alpha; its physical-device gate
must pass before merging into main. No gate was waived.

- Production compilation (`npm run build` with preview environment), standalone
  TypeScript, focused ESLint, and diff whitespace validation passed.
- 99 offline tests and 5 photo/PDF tests passed on this integrated candidate.
  New runtime IndexedDB tests verify per-user isolation, successful blob cleanup,
  atomic rollback of synchronous quota failure, and the concurrent pending cap.
- `scripts/project-photo-acceptance.ts` exercised the real authenticated backend
  with a temporary non-human account in the isolated Offline Acceptance Test
  Project. Three concurrent deliveries plus a repeat produced one attachment and
  one 68-byte synthetic PNG. Changed bytes were rejected. Revoked membership
  blocked both repeat and new delivery. Fixture records and storage were cleaned.
  The admin credential is used only for fixture setup/cleanup; the application
  upload itself uses the authenticated QA user's client and live RLS.
- Vercel's existing **Pro** team dashboard, billing cycle Aug 1–Sep 1, showed
  approximately **100 GB / 1 TB Fast Data Transfer**, $7.66 of $20 included usage
  credit consumed, and $0 on-demand charges. These are team-wide figures, not
  just RailCommand. The plan was already Pro; nothing was upgraded.
- Production Supabase remains **Free**. Monthly uncached/cached egress is still
  unverified: Chrome needs production account sign-in and the in-app session
  belongs only to the separate Mobile Staging organization. Its 113 MB usage
  does not establish production headroom. Storage inventory is not bandwidth.

Dashboard links: [production Supabase usage](https://supabase.com/dashboard/org/ffzboakthmscpmrhafnv/usage)
and [Vercel team usage](https://vercel.com/dillans-projects-f662840b/~/usage).
Usage may lag by an hour; recheck immediately before production release.

### Physical phone handoff

Use the isolated preview and a QA project/account, not customer field work.
Record device model, OS/browser version, preview deployment, date, and evidence
for each result. Repeat on iPhone/iPad Safari/PWA and Android Chrome/PWA.

1. Open Photos & Media online. Test Take Photo and Choose Existing Photo with an
   ordinary photo and an iPhone HEIC. Confirm the optimized size is <=500 KiB;
   unsupported HEIC must give an explicit error without uploading the original.
2. With that page already loaded, switch off Wi-Fi and cellular data. Choose and
   confirm a photo. It must say Saved on this device and appear in Sync Center.
3. Force-close the browser/PWA and restart the device while still offline.
   Confirm the neutral fallback behaves as documented; it cannot add new gallery
   photos. Reconnect and reopen the authenticated app. The pending photo must
   upload exactly once. Repeat while interrupting/reconnecting the network.
4. With pending work, attempt sign-out and cancel. The photo must remain queued.
   Test the explicit discard flow only with synthetic QA work. Confirm account
   switching never exposes the previous user's stored work.
5. On a storage-constrained test device, confirm the pressure warning and explicit
   quota failure. Keep the page open and original file intact; retry after freeing
   space. No half-queued operation may remain.
6. Generate a daily-log PDF: empty/zero Personnel Headcount and Equipment Count
   must display `-`; positive counts and other real zero values must be unchanged.

Also complete every applicable daily-log alpha row in
`docs/OFFLINE_ALPHA_ACCEPTANCE.md`; these photo checks do not replace that gate.
PDF dash formatting is offline-capable presentation logic, but remote photos in
a PDF can still require connectivity.
