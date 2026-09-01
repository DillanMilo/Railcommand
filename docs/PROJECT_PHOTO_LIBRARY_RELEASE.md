# Project photo library release

## Offline classification

**Online-only.** Taking or choosing a standalone project photo requires a verified
connection. The controls are disabled while the browser reports offline. If the
connection drops during upload, the optimized candidate remains in memory with
explicit retry and discard controls and a page-close warning; the original file
on the device is unchanged. Closing the app can discard that retry candidate, so
the UI tells the user to keep the original. No private data is added to Cache
Storage or global localStorage. The existing installable fallback is unchanged.

## Bandwidth controls

- Separate camera and saved-photo inputs; one file per selection.
- Standard images are compressed locally to at most 500 KiB. Source files over
  25 MiB and unsupported output are rejected rather than uploaded unchanged.
- The gallery loads 12 photos per page with lazy decoding and reuses one signed
  URL for the grid and lightbox.
- No paid image transformation service, plan change, or migration is included.

Production Supabase was already at 10.472 GB / 5 GB uncached egress on
2026-09-01. These controls reduce new gallery traffic but cannot restore Free-tier
headroom or guarantee future usage. Monitor the fresh billing cycle and audit
existing egress separately. A 5 GB monthly target is roughly 167 MB/day.

## Release validation

Automated server tests cover size/type/signature validation, actor and current
membership checks, repeated and concurrent idempotent delivery, uncertain insert
recovery, changed-content conflicts, and session failure. Production build,
TypeScript, focused lint, and the existing photo/PDF suite are required before
deployment. Physical iPhone/iPad and Android camera/library checks remain a
tracked follow-up; do not describe those devices as verified until completed.

The Daily Log PDF change is display-only and **offline-capable**: zero or missing
Personnel Headcount and Equipment Count render as `-`; positive counts and other
real zero values remain unchanged.
