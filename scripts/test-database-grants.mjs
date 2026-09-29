// Isolated PostgreSQL only: no .env, remote URLs, Supabase CLI links or real records.
// Requires a local Docker daemon. The disposable container has no network/ports,
// and its database is on tmpfs; cleanup runs on both success and failure.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { checkSql } from './check-database-grants.mjs';
const root = new URL('..', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const name = `railcommand-grants-${randomUUID()}`;
const docker = args => execFileSync('docker', args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
const endpoint = process.env.DOCKER_HOST || JSON.parse(docker(['context', 'inspect']))[0].Endpoints.docker.Host;
assert.match(endpoint, /^(unix:\/\/|npipe:\/\/)/, 'Grant tests require a LOCAL Docker daemon');
let created = false;
let database = 'postgres';
function sql(text) {
  return execFileSync('docker', ['exec', '-i', name, 'psql', '-X', '-h', '127.0.0.1', '-U', 'postgres', '-d', database, '-Atq', '-v', 'ON_ERROR_STOP=1'], {
    input: `\\set VERBOSITY verbose\n${text}`, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'],
  }).trim();
}
const profile = '10000000-0000-4000-8000-000000000001';
const outsider = '10000000-0000-4000-8000-000000000002';
const project = '20000000-0000-4000-8000-000000000001';
const otherProject = '20000000-0000-4000-8000-000000000002';
const org = '30000000-0000-4000-8000-000000000001';
function asRole(role, query, user = profile) {
  return sql(`begin; set local role ${role}; set local request.jwt.claim.sub = '${user}'; ${query}; rollback;`);
}
function denied(role, query, user = profile) {
  assert.throws(() => asRole(role, query, user), e => /42501/.test(String(e.stderr)), query);
}
const fixture = `
create extension pgcrypto;
create schema auth;
create function auth.uid() returns uuid language sql stable as
  $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create function auth.role() returns text language sql stable as $$select current_user::text$$;
create function auth.jwt() returns jsonb language sql stable as $$select '{}'::jsonb$$;
grant usage on schema public, auth to anon, authenticated, service_role;
create table public.organizations(id uuid primary key);
create table public.profiles(id uuid primary key, organization_id uuid, email text, role text);
create table public.projects(id uuid primary key, organization_id uuid);
create table public.project_members(project_id uuid, profile_id uuid, project_role text, can_edit boolean, unique(project_id,profile_id));
create table public.milestones(id uuid primary key);
create table public.daily_logs(id uuid primary key);
create function public.update_updated_at() returns trigger language plpgsql as $$begin new.updated_at=now(); return new; end$$;
create schema storage;
create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects(id uuid primary key, bucket_id text, name text);
create function storage.foldername(text) returns text[] language sql as $$select string_to_array($1,'/')$$;
grant select on public.profiles, public.projects, public.project_members to authenticated;
insert into public.organizations values('${org}');
insert into public.profiles values('${profile}','${org}','member@example.invalid','manager'),('${outsider}','${org}','outsider@example.invalid','member');
insert into public.projects values('${project}','${org}'),('${otherProject}','${org}');
insert into public.project_members values('${project}','${profile}','manager',true);
create table public.existing_grant_canary(id integer);
grant select on public.existing_grant_canary to anon;
insert into public.existing_grant_canary values(17);
`;
const legacyFiles = [
  '2026-04-06_project_invitations.sql', '2026-04-10_safety_incidents.sql',
  '2026-04-12_change_orders.sql', '2026-04-13_modifications.sql',
  '2026-04-13_weekly_reports.sql', '2026-04-14_project_documents.sql',
  '2026-04-14_qcqa_reports.sql', '2026-04-15_demo_accounts.sql',
  '2026-04-28_lock_down_demo_credentials.sql', '2026-06-15_earthcam_integration.sql',
].map(f => `docs/migrations/${f}`);
const currentFiles = [
  '20260623184000_earthcam_embeds.sql', '20260707153000_email_events.sql',
  '20260730170000_up_weekly_reporting_foundation.sql', '20260804224500_user_notifications.sql',
  '20260903221812_production_mobile_bridge_foundation.sql',
].map(f => `supabase/migrations/${f}`);
const files = [...legacyFiles, ...currentFiles];
const createdTables = [...new Set(files.flatMap(f => checkSql(read(f)).tables))];
try {
  docker(['run', '--detach', '--name', name, '--network', 'none', '--tmpfs', '/var/lib/postgresql/data', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:17']);
  created = true;
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try { docker(['exec', name, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres']); ready = true; break; }
    catch { await new Promise(resolve => setTimeout(resolve, 200)); }
  }
  assert.ok(ready, 'Disposable PostgreSQL did not become ready');
  sql('create role anon; create role authenticated; create role service_role bypassrls;');
  // Rebuild twice to represent fresh preview provisioning and reset/replay. The
  // third scenario proves the patch does not revoke pre-existing legacy grants.
  for (const scenario of ['preview', 'reset', 'legacy_defaults']) {
    database = 'postgres';
    sql(`create database ${scenario}`);
    database = scenario;
    sql(fixture);
    // Use the real membership helper required by the UP reporting policies.
    sql(read('supabase/schema_snapshot.sql').match(/CREATE OR REPLACE FUNCTION "public"\."is_project_member"[\s\S]+?\$\$;/)[0]);
    if (scenario === 'legacy_defaults') sql('alter default privileges in schema public grant all on tables to anon, authenticated, service_role');
    else sql('alter default privileges in schema public revoke all on tables from anon, authenticated, service_role; alter default privileges in schema public revoke all on sequences from anon, authenticated, service_role');
    if (scenario !== 'legacy_defaults') {
      sql((read('supabase/schema_snapshot.sql').match(/ALTER DEFAULT PRIVILEGES[^;]+;/g) || []).join('\n'));
      sql('create table public.future_grant_canary(id integer); create sequence public.future_sequence_canary');
      for (const role of ['anon','authenticated','service_role']) {
        assert.equal(sql(`select has_table_privilege('${role}','public.future_grant_canary','select')`), 'f');
        assert.equal(sql(`select has_sequence_privilege('${role}','public.future_sequence_canary','usage')`), 'f');
      }
    }
    for (const file of files) {
      try { sql(read(file)); } catch (e) { throw new Error(`${scenario}: ${file}\n${e.stderr}`, { cause: e }); }
    }
    assert.equal(sql('select id from public.existing_grant_canary'), '17');
    assert.equal(sql("select has_table_privilege('anon','public.existing_grant_canary','select')"), 't');
    for (const table of createdTables) {
      assert.equal(sql(`select relrowsecurity from pg_class where oid='public.${table}'::regclass`), 't', `${table}: RLS`);
      assert.equal(sql(`select has_table_privilege('service_role','public.${table}','select')`), 't', `${table}: service read`);
      if (scenario !== 'legacy_defaults') for (const privilege of ['select', 'insert', 'update', 'delete']) {
        assert.equal(sql(`select has_table_privilege('anon','public.${table}','${privilege}')`), 'f', `${table}: anon ${privilege}`);
      }
    }
    for (const table of ['safety_incidents','change_orders','modifications','weekly_reports','project_documents','qcqa_reports','earthcam_embeds','earthcam_cameras','up_report_template_variants','project_up_report_configs','up_weekly_report_details']) {
      for (const privilege of ['select','insert','update','delete']) {
        assert.equal(sql(`select has_table_privilege('authenticated','public.${table}','${privilege}')`), 't', `${table}: ${privilege}`);
      }
    }
    // Ordinary app roles, not owner/service-role-only probes.
    sql(`insert into public.earthcam_embeds(project_id,label,url) values('${project}','fixture','https://share.earthcam.net/test')`);
    assert.equal(asRole('authenticated','select count(*) from public.earthcam_embeds'), '1');
    assert.equal(asRole('authenticated','select count(*) from public.earthcam_embeds', outsider), '0');
    denied('authenticated', `insert into public.earthcam_embeds(project_id,url) values('${otherProject}','https://share.earthcam.net/no')`);
    denied('authenticated', `insert into public.earthcam_embeds(project_id,url) values('${project}','https://share.earthcam.net/no')`, outsider);
    assert.equal(asRole('authenticated', "update public.earthcam_embeds set label='changed' returning label"), 'changed');
    assert.equal(asRole('authenticated', 'delete from public.earthcam_embeds returning label'), 'fixture');
    sql(`delete from public.project_members where profile_id='${profile}'`);
    assert.equal(asRole('authenticated','select count(*) from public.earthcam_embeds'), '0');
    denied('authenticated', `insert into public.earthcam_embeds(project_id,url) values('${project}','https://share.earthcam.net/revoked')`);
    sql(`insert into public.project_members values('${project}','${profile}','manager',true)`);
    sql(`insert into public.user_notifications(recipient_id,type,title,dedupe_key) values('${profile}','team_update','fixture','key')`);
    assert.equal(asRole('authenticated', 'select count(*) from public.user_notifications'), '1');
    assert.equal(asRole('authenticated', 'select count(*) from public.user_notifications', outsider), '0');
    assert.equal(asRole('authenticated', 'update public.user_notifications set read_at=now() returning read_at is not null'), 't');
    denied('authenticated', "update public.user_notifications set title='forged'");
    denied('authenticated', `insert into public.user_notifications(recipient_id,type,title,dedupe_key) values('${profile}','team_update','forged','other')`);
    for (const table of ['demo_accounts','demo_team_logins','email_events']) {
      if (scenario !== 'legacy_defaults' || table === 'email_events') denied('authenticated', `select * from public.${table}`);
      else assert.equal(asRole('authenticated', `select count(*) from public.${table}`), '0');
    }
    assert.equal(asRole('service_role', "insert into public.email_events(status) values('sent') returning status"), 'sent');
    assert.equal(asRole('authenticated', `insert into public.mobile_device_registrations(profile_id,expo_push_token,platform,app_profile) values('${profile}','synthetic-token','ios','staging') returning platform`), 'ios');
    denied('authenticated', `insert into public.mobile_device_registrations(profile_id,expo_push_token,platform,app_profile) values('${outsider}','synthetic-token','android','staging')`);
    denied('authenticated', `insert into public.account_deletion_requests(profile_id,client_request_id) values('${profile}',gen_random_uuid())`);
    if (scenario !== 'legacy_defaults') denied('anon', 'select * from public.earthcam_embeds');
    // Reapplying the idempotent EarthCam DDL preserves rows and authorization.
    sql(read(currentFiles[0]));
    sql(read('docs/migrations/2026-06-23_earthcam_embeds.sql'));
    assert.equal(asRole('authenticated','select label from public.earthcam_embeds'), 'fixture');
    console.log(`${scenario}: ${createdTables.length} created tables, explicit grants, RLS/role boundaries and existing-grant preservation passed.`);
  }
} finally {
  if (created) docker(['rm', '--force', name]);
}
