// In-memory Postgres only. Never connects to a remote database or reads credentials.
// PGLITE_MODULE can point to an isolated installation of @electric-sql/pglite@0.5.8.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
const { PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const migration = readFileSync(process.env.SECURITY_MIGRATION_UNDER_TEST || new URL('../supabase/migrations/20260922194359_scope_global_search_profiles.sql', import.meta.url), 'utf8');
const uid = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const pid = n => `10000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const keys = ['daily_logs', 'matched_profiles', 'milestones', 'punch_list', 'rfis', 'submittals'];

test('global search limits all result groups to authorized projects', async t => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as
      $$select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid$$;
    grant usage on schema public, auth to anon, authenticated, service_role;
    create table public.profiles(id uuid primary key, full_name text);
    create table public.project_members(project_id uuid, profile_id uuid);
    create table public.submittals(id uuid, project_id uuid, number text, title text, spec_section text, status text, submitted_by uuid, description text);
    create table public.rfis(id uuid, project_id uuid, number text, subject text, status text, assigned_to uuid, question text, answer text);
    create table public.punch_list_items(id uuid, project_id uuid, number text, title text, location text, description text, status text, assigned_to uuid, resolution_notes text);
    create table public.daily_logs(id uuid, project_id uuid, log_date date, work_summary text, created_by uuid, safety_notes text);
    create table public.milestones(id uuid, project_id uuid, name text, status text, description text);
    insert into public.profiles values
      ('${uid(1)}','Needle Caller'), ('${uid(2)}','Needle Teammate'),
      ('${uid(3)}','Needle Outsider'), ('${uid(4)}','Needle Other Project'),
      ('${uid(5)}','Needle No Membership');
    insert into public.project_members values
      ('${pid(1)}','${uid(1)}'), ('${pid(1)}','${uid(2)}'),
      ('${pid(2)}','${uid(3)}'), ('${pid(3)}','${uid(1)}'), ('${pid(3)}','${uid(4)}');
  `);
  for (let n = 1; n <= 3; n++) {
    await db.query('insert into public.submittals(id,project_id,title) values ($1,$2,$3)', [uid(n),pid(n),'Needle']);
    await db.query('insert into public.rfis(id,project_id,subject) values ($1,$2,$3)', [uid(n),pid(n),'Needle']);
    await db.query('insert into public.punch_list_items(id,project_id,title) values ($1,$2,$3)', [uid(n),pid(n),'Needle']);
    await db.query('insert into public.daily_logs(id,project_id,work_summary) values ($1,$2,$3)', [uid(n),pid(n),'Needle']);
    await db.query('insert into public.milestones(id,project_id,name) values ($1,$2,$3)', [uid(n),pid(n),'Needle']);
  }
  const tables = ['profiles','project_members','submittals','rfis','punch_list_items','daily_logs','milestones'];
  // SECURITY DEFINER functions must filter correctly even when they bypass RLS.
  for (const table of tables) await db.exec(`alter table public.${table} enable row level security`);
  const snapshot = async () => {
    const result = {};
    for (const table of tables) result[table] = (await db.query(`select * from public.${table}`)).rows;
    return result;
  };
  const before = await snapshot();
  await t.test('migration and reapplication preserve all fixture rows', async () => {
    await db.exec(migration); await db.exec(migration);
    assert.deepEqual(await snapshot(), before);
  });
  const search = async (sub, projects, query='Needle', role='authenticated') => {
    await db.exec('begin');
    try {
      await db.query("select set_config('request.jwt.claim.sub',$1,true)", [sub || '']);
      await db.exec(`set local role ${role}`);
      const result = (await db.query('select public.global_search($1,$2::uuid[],10) as result', [query,projects])).rows[0].result;
      assert.deepEqual(Object.keys(result).sort(), keys);
      return result;
    } finally { await db.exec('rollback'); }
  };
  const expectScope = (result, profiles, projects) => {
    assert.deepEqual(result.matched_profiles.map(p => p.id).sort(), profiles.sort());
    for (const p of result.matched_profiles) assert.deepEqual(Object.keys(p).sort(), ['full_name','id']);
    for (const key of keys.filter(k => k !== 'matched_profiles')) {
      assert.deepEqual(result[key].map(r => r.project_id).sort(), projects.sort());
    }
  };
  await t.test('own and teammate results remain available without outsider profiles', async () => {
    expectScope(await search(uid(1), [pid(1)]), [uid(1),uid(2)], [pid(1)]);
  });
  await t.test('forged project IDs cannot expand visibility', async () => {
    expectScope(await search(uid(1), [pid(1),pid(2)]), [uid(1),uid(2)], [pid(1)]);
  });
  await t.test('legitimate multi-project searches remain compatible without duplicate profiles', async () => {
    expectScope(await search(uid(1), [pid(1),pid(3)]), [uid(1),uid(2),uid(4)], [pid(1),pid(3)]);
  });
  await t.test('another caller sees only their own project', async () => {
    expectScope(await search(uid(3), [pid(1),pid(2)]), [uid(3)], [pid(2)]);
  });
  for (const [name, sub, projects] of [
    ['non-member',uid(5),[pid(1)]], ['unauthorized projects',uid(1),[pid(2)]],
    ['no identity',null,[pid(1)]], ['empty project list',uid(1),[]], ['null project list',uid(1),null],
  ]) await t.test(`${name} receives the existing empty response shape`, async () => {
    expectScope(await search(sub, projects), [], []);
  });
  await t.test('empty or wildcard search cannot enumerate outsider profiles', async () => {
    expectScope(await search(uid(1), [pid(1)], ''), [uid(1),uid(2)], [pid(1)]);
    expectScope(await search(uid(1), [pid(1)], '%'), [uid(1),uid(2)], [pid(1)]);
  });
  await t.test('removed membership immediately removes access', async () => {
    await db.query('delete from public.project_members where profile_id=$1 and project_id=$2', [uid(1),pid(1)]);
    expectScope(await search(uid(1), [pid(1)]), [], []);
    await db.query('insert into public.project_members values ($1,$2)', [pid(1),uid(1)]);
  });
  await t.test('anonymous caller cannot execute the RPC', async () => {
    await assert.rejects(search(null,[pid(1)],'Needle','anon'), e => e.code === '42501');
  });
  await t.test('search calls leave every fixture record intact', async () => {
    // Compare canonical row sets; membership was restored above in a different order.
    const canonical = rows => Object.fromEntries(Object.entries(rows).map(([k,v]) => [k,v.map(x=>JSON.stringify(x)).sort()]));
    assert.deepEqual(canonical(await snapshot()), canonical(before));
  });
});
