# Phase 1 material-cost CSV export · 4 November 2026

User approved the small CSV addition to this beta, superseding only the original
Phase 3 cost-report export deferral. Retention, audit-history exports, XLSX formatting,
receiving imports and flag investigation ownership remain later scope.

## Implementation plan and impact

- Web: one Export CSV button in Material cost & budget review; browser download or existing native workspace share bridge. Plain rectangular CSV, UTF-8 BOM, CRLF, quoted/escaped cells; Excel opens it. No export configuration screen.
- Native: same button and report via the existing authenticated mobile API, then the OS Save/share sheet. App-owned temporary file is user-scoped and removed after sharing/failure. Saving a copy to Files is an explicit user action.
- Shared API/domain: shared cost-report serializer; additive GET `format=csv` on both existing inventory routes. Each request runs the existing authenticated/RLS inventory read anew and requires its finance projection. No new finance role or bypass.
- Database: no migrations, grants, RLS, policies or record writes. Reuse existing finance permissions and carrying calculations.
- Offline classification: **online-only**, because current cost permission and values must be revalidated. Explicit online helper text; no background retry or queue; network/permission failure leaves all forms/drafts untouched.
- Existing installed clients: old JSON GET/POST/receipt contracts unchanged. Native export UI needs a new signed build; no automatic installed-app update is claimed.
- Permissions/lifecycle: no export controls for operational-only readers; direct API denial without finance. Account/project change cancels file delivery; output is not put in offline databases, localStorage, service worker or shared caches.
- Report scope: current project budget figures plus accepted lots, per-lot/per-tie acquisition and installed subtotals, accrued capital carrying and itemized Wendy cost buckets with source/status. Budget currency is explicitly unconfirmed rather than inferred from material currency. Unknown prices remain blank. Full TCO remains incomplete; no subtotal is presented as a final lifecycle total. No raw approvals or audit export.
- No mutations, so export requires no idempotency keys or conflict resolution; each file is an as-of read. Retrying reads cannot duplicate stock or spending. Concurrency yields a fresh snapshot rather than editing existing data.

## Acceptance criteria

1. Authorized readers download/share one `.csv` from both UIs, with matching rows and an as-of timestamp.
2. Foreman/inventory-lead projections and revoked cost access cannot export, including direct GET calls.
3. Excel-safe escaping covers delimiters, quotes, multiline/Unicode text and formula prefixes; legitimate numeric zero/negative values remain numeric, missing values blank.
4. 5% carrying and source currency use existing shared calculations; budget currency remains unconfirmed. Export doesn't double-add entered carrying.
5. Offline/network/storage failures and account/project changes cannot discard a draft or share a late report with the next user; native temporary files are removed on success/cancellation/error.
6. Existing reads/receipts/POST operations remain compatible. Relevant tests, root build and root/native TypeScript pass.

Validation and local browser/device outcomes will be recorded below. No merge,
push, deployment or existing app installation is authorized in this change.

## Validation and local outcome

- `npm run test:inventory`: 28 passing, including finance denial/revocation, unchanged legacy read/receipt routing, CSV escaping/formula prefixes, 5% calculation/source currency, missing-vs-zero, network/scope cancellation and native-bridge sign-out cancellation.
- Root `npm run build`, `npx tsc --noEmit`, focused ESLint and `git diff --check`: pass. Existing Next middleware deprecation notice remains unrelated.
- Native `npx tsc --noEmit`, all 278 tests, and iOS/Android Expo bundle exports: pass. New native tests cover cleanup after partial writes, dismissed/failed sharing, offline/unavailable sharing, account/project switch and malformed reports.
- Real local backend/HTTP checks: all eight existing synthetic profiles tested through both `/api/inventory` and `/api/mobile/v1/inventory`. Admin, PM, assigned Supply Chain and owner currently have cost access and export successfully. Engineer, superintendent, foreman and inventory lead are denied (403); unauthenticated native API is 401. These are actual current grants on the local QA fixture, not new role grants. Only reads were issued to inventory/project records; no permission configuration was changed.
- Actual production web component: clicked Export CSV in the persistent local QA app and downloaded `material-costs-c1311731-86fb-41a9-8542-ff6e4fd10288-2026-11-04.csv`. Python's independent CSV reader verified UTF-8 BOM, 34 report rows, 17 columns, two lots and 0.05 rate. Screenshot evidence: `/Users/dillanmilosevich/Desktop/railcommand-tco-videos/review/csv-download.png`.
- Local runtime: seven web/shared source files were backed up under `Phase1Local/private/backups/20261104-csv-runtime` and updated in the existing persistent runtime. Its local routing/environment overlay was retained. An isolated extra preview was retired; no hosted backend was used. The tiny sign-in helper was used only for existing synthetic QA accounts.
- Web → native and native → web: both APIs return the same shared report format from the same authorized database. No new record writes or synchronization behavior to round-trip. Native delivery is implemented, unit-tested and bundled; **physical iOS/Android Save/share, background/sign-out and cancellation checks remain pending** with the next separate signed Phase1 build. Do not mark them device-verified or promise this button in the currently installed app.
- Release dependency: install an updated separate Phase1 development build, verify Save to Files/Excel and temporary-file cleanup, then follow the existing staged rollout. This round did not install, push, merge or deploy anything.
- Rollback: remove the additive button/API-client method and CSV GET branch; original read/receipt/write APIs and stored drafts remain compatible. Restore only the backed-up local runtime source files if needed; no database rollback exists or is required.

User work and data are protected: this change creates downloadable copies only.
Neither offline cache policy nor user/project drafts/outboxes were altered.
