# DFR photo repair — September 17, 2026

## Scope and implementation

Caleb reports missing photos, duplicates after re-adding, and no saved photos in the
DFR edit screen. His project, report date and affected client are still required to
identify the exact incident. The following reproducible source defects are repaired:

- Saved attachments load in both DFR detail and edit, with refresh and visible preview
  errors. Failed signed-URL requests no longer make a saved attachment look absent.
- Photo selection displays previews before GPS finishes. Concurrent selections keep
  both batches. Edit uploads on Save instead of automatically uploading and then
  attempting the same upload again during Save.
- New uploads use an account/project/report/category/content-scoped stable identity.
  Re-selecting the same bytes, including after page reload, reuses that identity;
  storage upload never overwrites bytes. Historical random-ID duplicates are unchanged.
- Authorized users can explicitly remove a photo from the exact DFR after confirmation.
  This removes only its attachment row, never stored bytes or another report's rows.
  Current project/edit permissions and RLS are rechecked. Zero-row deletes are errors.
- PDF export reloads attachment URLs and reports unavailable/unsupported photos instead
  of silently omitting them. Removing a photo resets a previously prepared share file.
  Downloaded PDFs do not change; users must export again. JPEG/PNG rendering is supported;
  other formats currently require a JPEG/PNG copy, with the stored original unchanged.

## Web/mobile impact and offline behavior

Web: the shared DFR pages, gallery, uploader, upload receipts and PDF exporter change.
Mobile: build 300009's online Workspace consumes these same deployed pages. Mirrored
web source in the native checkout receives the same changes without replacing its
existing offline guards or unrelated native code. Native Field tools remain separate.
API/domain: additive signed_url_error output and a scoped server action; no migration,
RLS/grant change, native endpoint removal or native request format change.
Installed clients: existing 300008 Field tools and pending native operations unchanged.
No queue purge, receipt reassignment, account reset or automatic conflict resolution.

Classification: **online-only** saved-photo refresh/removal and Workspace upload/PDF.
Selected files/open form survive a transient failed request while the page remains
mounted; they are not durable across browser/app termination. Native draft/queue
behavior is unchanged. No private records or signed URLs enter public SW caches.
No production field records are used as mutation fixtures. No historical duplicates
or photos are removed automatically by this rollout.

## Verification and release

- Initial backend full mobile/API + PDF suite: 301 passing tests. Includes stable
  content retry across fresh file/page contexts, account/report isolation, exact DFR
  removal scope, denied permission, RLS zero rows, preserved storage, signing failure
  and reordered responses, plus explicit PDF failures.
- Initial backend and candidate production builds + TypeScript checks passed.
- Final review added prepared-share invalidation, immediate photo-removal state,
  lightbox failure text, and mirrored PDF rendering. Final backend and candidate builds and TypeScript checks passed (exit 0).
- Final 301-test rerun passed; focused ESLint has no errors.
- Local visual check reported ERR_BLOCKED_BY_CLIENT; server logs also showed missing
  local public Supabase environment. Staged production-env demo detail/edit screens
  render, including Saved DFR photos and refresh controls. Physical iPhone acceptance
  remains pending; automated tests do not prove
  Caleb's incident or all field workflows resolved. No new database migration needed.
- Staged deployment dpl_36LoCT8KqjExbxukXS7GbMBpLhvX is READY from runtime commit
  8d78abd. Nine missing/forged-token and nonpilot auth checks passed with no-store.
  Promotion was rejected by automatic approval review: exact live-promotion approval
  is required while physical iPhone acceptance remains incomplete. User approval
  requested; no retry or workaround performed. Live remains on
  dpl_AH14LTcuJkBKqT7StPXdPwhysVgk (also the rollback target).
- CI 35251438295 caught the new action missing from the parity inventory. Added its
  online-only shared-workspace assessment without marking device acceptance passed;
  inventory now covers 127 actions. CI rerun 35251835975 passed on e710ade (runtime unchanged from 8d78abd).

## iPhone availability

Apple API readback confirms build 1.0.0 (300009), processing VALID, internal state
IN_BETA_TESTING. Build ID 325f0b2c-afdb-404b-872b-7c9100097331 is assigned to internal
group b92ba7eb-1a88-40ec-8af2-f38c499dee30 (RailCommand Private Beta), verified to contain
only dillanxx@gmail.com. EAS build da211cfc-a497-4c4f-87e3-70b92c052005; submission
b703435c-a98e-4f5c-a761-6c920f83b9c5. No external tester release inferred.

Dillan should update through TestFlight without uninstalling/signing out, then check
Workspace projects, an authorized test DFR/photo, export/share, and native queued-log
review. Physical restart/offline/device acceptance and external beta review remain
required. Docker, Xcode, Simulator and iPhone Mirroring need not stay open for this
cloud build/distribution or shared web update.

Browser verification used the isolated public demo on the staged URL: sign-in shell,
demo dashboard, DFR list, detail and edit rendered. The demo showed empty saved-photo
lists, so real attachment preview/removal and mobile upload/export still require
authorized test-account/device acceptance. No demo or live DFR was edited during
this check. Native build availability is verified; installation remains unconfirmed.
