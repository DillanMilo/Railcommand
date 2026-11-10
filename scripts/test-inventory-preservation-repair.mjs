// Synthetic local PostgreSQL only. Never connects to a hosted database.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
const name = `railcommand-repair-test-${randomUUID()}`;
const db = 'railcommand_release_review';
const docker = args => execFileSync('docker', args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
const endpoint = process.env.DOCKER_HOST || JSON.parse(docker(['context', 'inspect']))[0].Endpoints.docker.Host;
assert.match(endpoint, /^(unix:\/\/|npipe:\/\/)/);
const sql = (body, database = db) => execFileSync('docker', ['exec', '-i', name, 'psql', '-X', '-U', 'postgres', '-d', database, '-Atq', '-v', 'ON_ERROR_STOP=1'], { input: body, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
const repair = readFileSync(new URL('./release/reviewed-assignment-repair.local.sql', import.meta.url), 'utf8');
let manifest, mapping;
const prefix = `BEGIN; SET LOCAL railcommand.review_mode='local-copy';`;
const missing = randomUUID(), project = randomUUID(), absentProject = randomUUID(), approvedMember = randomUUID();
try {
  docker(['run', '--pull=never', '-d', '--name', name, '--network', 'none', '--memory', '384m', '--tmpfs', '/var/lib/postgresql/data', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:17']);
  for (let i = 0; i < 160; i++) {
    try { sql('SELECT 1', 'postgres'); break; } catch { await new Promise(r => setTimeout(r, 100)); }
  }
  sql(`CREATE DATABASE ${db}`, 'postgres');
  sql(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE TABLE public.profiles(id uuid PRIMARY KEY);
    CREATE TABLE public.projects(id uuid PRIMARY KEY);
    CREATE TABLE public.project_members(project_id uuid,profile_id uuid);
    INSERT INTO public.profiles VALUES ('${approvedMember}');
    INSERT INTO public.project_members VALUES ('${project}','${approvedMember}');
    INSERT INTO public.projects VALUES ('${project}');
    CREATE TABLE public.punch_list_items(id uuid PRIMARY KEY, project_id uuid, assigned_to uuid NOT NULL, description text, status text, updated_at timestamptz DEFAULT now());
    INSERT INTO public.punch_list_items(id, project_id, assigned_to, description, status)
    SELECT gen_random_uuid(), CASE WHEN n<=12 THEN '${project}'::uuid ELSE '${absentProject}'::uuid END, '${missing}', 'Synthetic item '||n, 'open' FROM generate_series(1,24) n;
    ALTER TABLE public.punch_list_items ADD CONSTRAINT project_fk FOREIGN KEY(project_id) REFERENCES public.projects(id) NOT VALID;
    ALTER TABLE public.punch_list_items ADD CONSTRAINT actor_fk FOREIGN KEY(assigned_to) REFERENCES public.profiles(id) NOT VALID;
    CREATE TABLE public.activity_log(id int, project_id uuid, description text);
    INSERT INTO public.activity_log SELECT n,'${absentProject}','Preserve original history '||n FROM generate_series(1,21) n;
    CREATE FUNCTION public.touch_item() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=clock_timestamp();RETURN NEW;END $$;
    CREATE TRIGGER touch_item BEFORE UPDATE ON public.punch_list_items FOR EACH ROW EXECUTE FUNCTION public.touch_item();`);
  const originals = JSON.parse(sql('SELECT json_agg(to_jsonb(p) ORDER BY id) FROM public.punch_list_items p'));
  const quote = s => "'"+s.replaceAll("'", "''")+"'";
  manifest = `CREATE TEMP TABLE expected_assignment_rows(id uuid PRIMARY KEY,before_row jsonb) ON COMMIT DROP;INSERT INTO expected_assignment_rows VALUES ${originals.map(r => `('${r.id}',${quote(JSON.stringify(r))}::jsonb)`).join(',')};`;
  mapping = `CREATE TEMP TABLE approved_assignment_targets(id uuid PRIMARY KEY,profile_id uuid,approval_reference text) ON COMMIT DROP;INSERT INTO approved_assignment_targets SELECT id,'${approvedMember}'::uuid,'synthetic-owner-confirmation' FROM public.punch_list_items WHERE project_id='${project}';`;
  const before = sql(`SELECT md5(jsonb_agg(to_jsonb(a) ORDER BY id)::text) FROM public.activity_log a`);
  assert.throws(() => sql(repair)); // absent transaction/manifest/mode: deny
  assert.equal(sql(`SELECT to_regnamespace('inventory_release_review') IS NULL`), 't');
  // If the missing user becomes valid, do not replace their assignment.
  assert.throws(() => sql(`${prefix}${manifest}${mapping} INSERT INTO public.profiles VALUES ('${missing}');${repair}COMMIT;`));
  assert.equal(sql('SELECT count(*) FROM public.profiles'), '1');
  assert.equal(sql('SELECT count(*) FROM public.punch_list_items WHERE assigned_to IS NOT NULL'), '24');
  // Partial or edited manifests fail and roll back even the new journal schema.
  assert.throws(() => sql(`${prefix}${manifest}${mapping} DELETE FROM expected_assignment_rows WHERE id=(SELECT id FROM expected_assignment_rows LIMIT 1);${repair}COMMIT;`));
  assert.equal(sql(`SELECT to_regnamespace('inventory_release_review') IS NULL`), 't');
  assert.throws(() => sql(`${prefix}${manifest}${mapping} UPDATE expected_assignment_rows SET before_row=jsonb_set(before_row,'{description}','"changed"');${repair}COMMIT;`));
  assert.equal(sql(`SELECT to_regnamespace('inventory_release_review') IS NULL`), 't');
  assert.throws(() => sql(`${prefix}${manifest}CREATE TEMP TABLE approved_assignment_targets(id uuid PRIMARY KEY,profile_id uuid,approval_reference text) ON COMMIT DROP;${repair}COMMIT;`));
  assert.throws(() => sql(`${prefix}${manifest}${mapping}INSERT INTO approved_assignment_targets SELECT id,'${approvedMember}'::uuid,'synthetic-owner-confirmation' FROM public.punch_list_items WHERE project_id='${absentProject}';${repair}COMMIT;`));
  assert.throws(() => sql(`${prefix}${manifest}${mapping}INSERT INTO approved_assignment_targets VALUES('${randomUUID()}','${approvedMember}','synthetic-owner-confirmation');${repair}COMMIT;`));
  assert.throws(() => sql(`${prefix}${manifest}${mapping}UPDATE approved_assignment_targets SET approval_reference='';${repair}COMMIT;`));
  assert.throws(() => sql(`${prefix}${manifest}${mapping}DELETE FROM public.project_members;${repair}COMMIT;`));
  assert.throws(() => sql(`${prefix}${manifest}${mapping}UPDATE approved_assignment_targets SET profile_id='${randomUUID()}';${repair}COMMIT;`));
  // A failure after the update must roll back assignments and journal together.
  assert.throws(() => sql(`${prefix}${manifest}${mapping}${repair}SELECT 1/0;COMMIT;`));
  assert.equal(sql(`SELECT to_regnamespace('inventory_release_review') IS NULL`), 't');
  assert.equal(sql(`SELECT count(*) FROM public.punch_list_items WHERE assigned_to='${missing}'`), '24');
  sql(`${prefix}${manifest}${mapping}${repair}COMMIT;`);
  assert.equal(sql(`SELECT count(*) FROM public.punch_list_items WHERE assigned_to='${approvedMember}'`), '12');
  assert.equal(sql('SELECT count(*) FROM inventory_release_review.assignment_corrections'), '12');
  assert.equal(sql(`SELECT count(*) FROM inventory_release_review.assignment_corrections WHERE before_row->>'assigned_to'='${missing}' AND after_row->>'assigned_to'='${approvedMember}' AND before_row-'assigned_to'-'updated_at'=after_row-'assigned_to'-'updated_at'`), '12');
  assert.equal(sql(`SELECT md5(jsonb_agg(to_jsonb(a) ORDER BY id)::text) FROM public.activity_log a`), before);
  const journalDigest = sql('SELECT md5(jsonb_agg(to_jsonb(j) ORDER BY item_id)::text) FROM inventory_release_review.assignment_corrections j');
  sql(`${prefix}${manifest}${mapping}${repair}COMMIT;`);
  assert.equal(sql('SELECT md5(jsonb_agg(to_jsonb(j) ORDER BY item_id)::text) FROM inventory_release_review.assignment_corrections j'), journalDigest);
  for (const role of ['anon','authenticated','service_role']) {
    assert.equal(sql(`SELECT has_schema_privilege('${role}','inventory_release_review','USAGE')`), 'f');
    assert.throws(() => sql(`SET ROLE ${role}; SELECT * FROM inventory_release_review.assignment_corrections`));
  }
  for (const statement of ['DELETE FROM inventory_release_review.assignment_corrections','UPDATE inventory_release_review.assignment_corrections SET reason=reason','TRUNCATE inventory_release_review.assignment_corrections']) assert.throws(() => sql(statement));
  // Normal constraints still reject any fresh broken project/user references.
  assert.throws(() => sql(`INSERT INTO public.punch_list_items VALUES(gen_random_uuid(),'${project}','${missing}','bad user','open',now())`));
  assert.throws(() => sql(`INSERT INTO public.punch_list_items VALUES(gen_random_uuid(),'${absentProject}','${approvedMember}','bad project','open',now())`));
  assert.equal(sql(`SELECT count(*) FROM public.punch_list_items`), '24');
  assert.equal(sql(`SELECT count(*) FROM public.activity_log`), '21');
  console.log('PASS: guards, stale/newly valid input, atomic rollback, 12 explicitly approved reassignments, missing-project/empty-map denial, exact rerun, append-only evidence, application denial, original history and future FK protection.');
} finally { try { docker(['rm','-f',name]); } catch {} }
