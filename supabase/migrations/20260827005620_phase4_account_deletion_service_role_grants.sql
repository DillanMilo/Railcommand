-- Phase 4 server-only account-deletion privileges.
--
-- The deletion request RPC writes the user-owned request and audit event as the
-- authenticated caller. The Next.js server then revokes sessions and records a
-- system audit event, while the protected finalizer reads and updates requests.
-- RLS bypass alone does not grant table privileges, so the server role needs the
-- narrow operations exercised by those two paths.

begin;

grant select, update on table public.account_deletion_requests to service_role;
grant select, insert on table public.account_deletion_audit to service_role;

commit;
