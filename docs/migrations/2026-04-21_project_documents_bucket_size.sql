-- =============================================================================
-- Migration: Raise project-documents bucket per-file size limit to 100 MB
-- Date:      2026-04-21
--
-- PURPOSE: Typical construction docs (full plan sets, DWG drawings, geotech
--          reports, SWPPP plans) routinely exceed the previous 10 MB cap.
--          100 MB covers the vast majority of real project files without
--          requiring users to compress anything.
--
-- HOW TO APPLY:
--   Supabase Dashboard -> SQL Editor -> New query -> paste -> Run.
--   Safe to re-run (idempotent UPDATE / INSERT ... ON CONFLICT).
--
-- NOTE: Client-side (FileUpload.tsx), server-side (actions/attachments.ts),
--       and Next.js server-action bodySizeLimit (next.config.ts) are already
--       bumped to 100 MB in the matching code deploy. This migration raises
--       the storage-layer ceiling to match.
-- =============================================================================

-- Ensure bucket exists (no-op if already created manually in Dashboard)
insert into storage.buckets (id, name, public, file_size_limit)
values ('project-documents', 'project-documents', true, 104857600)  -- 100 MB
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit;

-- Reload PostgREST schema cache
notify pgrst, 'reload schema';
