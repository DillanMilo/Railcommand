// Local transport rehearsal only. No credentials, hosted URLs, existing containers,
// persisted volumes or published ports. This is NOT a production backup.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const name = `railcommand-backup-check-${randomUUID()}`;
const docker = (args, input) => execFileSync('docker', args, {
  input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'],
}).trim();
const endpoint = process.env.DOCKER_HOST || JSON.parse(docker(['context', 'inspect']))[0].Endpoints.docker.Host;
assert.match(endpoint, /^(unix:\/\/|npipe:\/\/)/, 'Local Docker required');
const sql = (db, input) => docker(['exec', '-i', name, 'psql', '-X', '-h', '127.0.0.1', '-U', 'postgres', '-d', db, '-Atq', '-v', 'ON_ERROR_STOP=1'], input);
const fingerprint = (db) => sql(db, `select jsonb_build_object(
 'rows',(select jsonb_agg(to_jsonb(t) order by id) from public.stock t),
 'members',(select jsonb_agg(to_jsonb(t) order by id) from public.members t),
 'acl',(select relacl::text from pg_class where oid='public.stock'::regclass),
 'rls',(select relrowsecurity from pg_class where oid='public.stock'::regclass),
 'policies',(select jsonb_agg(to_jsonb(p) order by policyname) from pg_policies p where schemaname='public'),
 'function',pg_get_functiondef('public.current_actor()'::regprocedure),
 'constraints',(select jsonb_agg(pg_get_constraintdef(oid) order by conname) from pg_constraint where conrelid='public.stock'::regclass),
 'history',(select jsonb_agg(to_jsonb(t) order by version) from supabase_migrations.schema_migrations t))`);
let created = false;
try {
  docker(['run', '--detach', '--name', name, '--network', 'none', '--tmpfs', '/var/lib/postgresql/data', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:17']);
  created = true;
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try { docker(['exec', name, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres']); ready = true; break; }
    catch { await new Promise(r => setTimeout(r, 100)); }
  }
  assert.ok(ready, 'PostgreSQL did not start');
  sql('postgres', 'create role authenticated; create database backup_source; create database restore_check;');
  sql('backup_source', `create schema supabase_migrations;
    create table supabase_migrations.schema_migrations(version text primary key,name text);
    insert into supabase_migrations.schema_migrations values('20261110','synthetic_only');
    create table public.members(id integer primary key,organization_id integer);
    insert into public.members values(1,10),(2,20),(3,null);
    create table public.stock(id uuid primary key,member_id integer references public.members(id),quantity numeric(12,3) check(quantity>=0),evidence jsonb not null);
    insert into public.stock values('00000000-0000-4000-8000-000000000001',1,250.125,'{"receipt":"Synthetic only","status":"pending"}');
    create function public.current_actor() returns integer language sql stable set search_path='' as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::integer$$;
    revoke all on function public.current_actor() from public; grant execute on function public.current_actor() to authenticated;
    grant select on public.stock to authenticated;
    alter table public.stock enable row level security;
    create policy member_read on public.stock for select to authenticated using(member_id=public.current_actor());`);
  const before = fingerprint('backup_source');
  // pg_dump takes its own consistent read-only snapshot. Archive includes schema,
  // data, constraints, policies, ACLs, functions and migration history together.
  docker(['exec', '-e', 'PGOPTIONS=-c default_transaction_read_only=on', name, 'pg_dump', '-h', '127.0.0.1', '-U', 'postgres', '-d', 'backup_source', '--format=custom', '--file=/tmp/synthetic.dump']);
  docker(['exec', name, 'pg_restore', '--list', '/tmp/synthetic.dump']);
  docker(['exec', name, 'pg_restore', '-h', '127.0.0.1', '-U', 'postgres', '-d', 'restore_check', '--single-transaction', '--exit-on-error', '/tmp/synthetic.dump']);
  assert.equal(fingerprint('restore_check'), before, 'Restored rows/schema/ACLs/history differ');
  assert.equal(fingerprint('backup_source'), before, 'Backup changed its source');
  assert.equal(sql('restore_check', `set role authenticated;set request.jwt.claim.sub='1';select quantity from public.stock`), '250.125');
  assert.equal(sql('restore_check', `set role authenticated;set request.jwt.claim.sub='2';select count(*) from public.stock`), '0');
  assert.throws(() => sql('restore_check', `set role authenticated;delete from public.stock`), /permission denied/);
  // Confirm the candidate no longer tightens legacy grants/policies during rollout.
  const initial = readFileSync(new URL('../supabase/migrations/20261020161326_inventory_phase_one.sql', import.meta.url), 'utf8');
  assert.ok(!/revoke\s+select\s+on\s+public\.(projects|milestones|change_orders)/i.test(initial));
  assert.ok(!/create policy inventory_(co|activity)_finance_boundary/i.test(initial));
  console.log(JSON.stringify({status:'passed',scope:'synthetic local backup/restore rehearsal only',fingerprintSha256:createHash('sha256').update(before).digest('hex'),productionBackupCaptured:false,checks:['consistent custom archive','rows/UUIDs/fractional quantities/JSON','membership organization/null values','ACL/RLS/function/constraint/migration history','authorized read/nonmember denial/write denial','source unchanged']}, null, 2));
} finally {
  if (created) docker(['rm', '--force', '--volumes', name]);
}
