# Daily log usability and PDF behavior

## Offline classification

- On the current production branch, daily-log creation is **online-only**. If a
  connection drops, entered fields and selected phone photos remain in the open
  form and the UI instructs the user to reconnect before submitting. Closing the
  page is not an offline persistence guarantee. The offline-rollout branch adds
  the user-scoped IndexedDB draft and idempotent daily-log/photo outbox.
- Reusing a previously synchronized Photos & Media item is **online-only**. A
  current private signed URL is required; the picker says so when disconnected,
  and photos already selected for the draft remain preserved locally.
- PDF export and device PDF sharing with embedded private photos are
  **online-only**. Signed URLs are refreshed when export begins and fetched with
  `no-store`; no project record or authenticated response is added to the public
  service-worker cache.

## Product behavior

- Work Performed is the primary free-form field for ad hoc and quantity-based
  reporting.
- Personnel, equipment, and measured quantities begin empty and are explicitly
  optional. Personnel roles accept project-specific free text.
- The RailCommand photo picker shows report-date photos first, while still
  allowing other unused project photos to be selected.
- Daily-log PDFs embed supported JPEG and PNG attachments. On devices that
  support file sharing, Share PDF can pass the generated PDF to Mail or another
  installed app.
- The Content Security Policy permits only local `data:`/`blob:` fetches needed
  by the PDF renderer in addition to the existing same-origin and Supabase
  connections; it does not add another remote destination.

Saved project distribution lists and automatic report delivery are not part of
this change. They require a separately reviewed recipient-management and email
delivery feature; device sharing does not silently email anyone.

## Verification and release boundary

- The repeatable mobile-browser flow in
  `scripts/e2e-daily-log-usability.cjs` verifies an empty optional-count state,
  free-form personnel roles, the client-provided work narrative, phone photo
  upload, save/reopen, embedded-photo PDF generation, and the Web Share file
  contract at a 390 by 844 viewport.
- The generated PDF was rendered as an image and inspected for the narrative,
  embedded photo, caption, pagination, clipping, and overlap.
- PDF/photo unit tests, offline/security tests, TypeScript, focused lint, and a
  production build cover the automated regression boundary.
- Release acceptance still requires one authenticated staging smoke test for
  Supabase RLS, signed private-photo URLs, Storage upload/finalization, and the
  daily-log outbox RPC. It also requires physical iPhone/iPad and Android checks
  of the operating-system share sheet and the existing offline restart flows.
