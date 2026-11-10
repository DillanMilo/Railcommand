// Isolated PostgreSQL only: validate the pre-migration rollout window and no-op
// behavior after the final authorization RPCs exist. Never accepts a hosted URL.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
const name = `railcommand-finance-bridge-${randomUUID()}`;
const docker = args => execFileSync('docker', args, { encoding:'utf8', stdio:['pipe','pipe','pipe'] }).trim();
const endpoint = process.env.DOCKER_HOST || JSON.parse(docker(['context','inspect']))[0].Endpoints.docker.Host;
assert.match(endpoint,/^(unix:\/\/|npipe:\/\/)/);
const sql = input => execFileSync('docker',['exec','-i',name,'psql','-X','-h','127.0.0.1','-U','postgres','-d','postgres','-Atq','-v','ON_ERROR_STOP=1'],{input,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
const bridge = readFileSync(new URL('../supabase/migrations/20261103152824_inventory_finance_rollout_bridge.sql',import.meta.url),'utf8');
const org=randomUUID(), foreignOrg=randomUUID(), project=randomUUID(), other=randomUUID();
const people=Object.fromEntries(['manager','engineer','superintendent','owner','foreman','contractor','inspector','outsider','foreign','admin'].map(k=>[k,randomUUID()]));
const as=(actor,query)=>sql(`set role authenticated; set request.jwt.claim.sub='${people[actor]??''}'; ${query}`);
try {
 docker(['run','--detach','--name',name,'--env','POSTGRES_HOST_AUTH_METHOD=trust','postgres:17']);
 let ready=false;
 for(let i=0;i<100;i++) { try{docker(['exec',name,'pg_isready','-h','127.0.0.1','-U','postgres']);ready=true;break;}catch{await new Promise(r=>setTimeout(r,100));} }
 assert.ok(ready,'PostgreSQL not ready');
 sql(`create role authenticated; create role anon; create schema auth;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated,anon;
 create table projects(id uuid primary key,organization_id uuid,budget_total numeric,budget_spent numeric);
 create table milestones(id uuid primary key,project_id uuid,budget_planned numeric,budget_actual numeric,percent_complete numeric);
 create table profiles(id uuid primary key,organization_id uuid,role text);
 create table project_members(project_id uuid,profile_id uuid,project_role text);
 insert into projects values('${project}','${org}',200000,1000),('${other}','${foreignOrg}',999999,999);
 insert into milestones values('${randomUUID()}','${project}',10000,5000,50),('${randomUUID()}','${other}',99999,999,1);
 ${Object.entries(people).map(([role,id])=>`insert into profiles values('${id}','${role==='foreign'?foreignOrg:org}','${role==='admin'?'admin':'member'}');`).join('\n')}
 ${Object.entries(people).filter(([role])=>role!=='outsider').map(([role,id])=>`insert into project_members values('${project}','${id}','${['foreign','admin'].includes(role)?'manager':role}');`).join('\n')}
 grant select on projects,milestones,profiles,project_members to authenticated;
 alter table projects enable row level security;
 create policy membership on projects for select to authenticated using(exists(select 1 from project_members m where m.project_id=projects.id and m.profile_id=auth.uid()));
 alter table milestones enable row level security;
 create policy membership on milestones for select to authenticated using(exists(select 1 from project_members m where m.project_id=milestones.project_id and m.profile_id=auth.uid()));`);
 const before=sql('select md5(string_agg(t::text,\'|\' order by id)) from projects t');
 sql(bridge);
 for(const role of ['manager','engineer','superintendent','owner','admin']) {
  assert.equal(as(role,`select budget_total from project_finance('${project}')`),'200000');
  assert.equal(as(role,`select budget_planned from milestone_finance('${project}')`),'10000');
  assert.equal(as(role,`select count(*) from project_finance('${other}')`),'0');
 }
 for(const role of ['foreman','contractor','inspector','outsider','foreign','anonymous']) {
  assert.equal(as(role,`select count(*) from project_finance('${project}')`),'0');
  assert.equal(as(role,`select count(*) from milestone_finance('${project}')`),'0');
 }
 assert.equal(sql("select has_function_privilege('anon','project_finance(uuid)','execute')"),'f');
 assert.equal(sql("select has_function_privilege('anon','milestone_finance(uuid)','execute')"),'f');
 assert.equal(sql("select has_column_privilege('authenticated','projects','budget_total','select')"),'t');
 assert.equal(sql('select md5(string_agg(t::text,\'|\' order by id)) from projects t'),before);
 // An existing final implementation must retain both its body and privileges.
 sql(`create or replace function public.project_finance(p_project_id uuid) returns table(id uuid,budget_total numeric,budget_spent numeric) language sql stable security definer set search_path='' as $$ select null::uuid,null::numeric,null::numeric where false $$;`);
 const definitions=sql("select pg_get_functiondef('project_finance(uuid)'::regprocedure)||pg_get_functiondef('milestone_finance(uuid)'::regprocedure)");
 sql(bridge);
 assert.equal(sql("select pg_get_functiondef('project_finance(uuid)'::regprocedure)||pg_get_functiondef('milestone_finance(uuid)'::regprocedure)"),definitions);
 assert.equal(sql("select has_function_privilege('anon','project_finance(uuid)','execute')"),'f');
 console.log('PASS finance rollout bridge: legacy authorized roles, field/foreign/nonmember/anonymous denials, RLS, unchanged rows/grants, repeat delivery and final-RPC preservation.');
} finally {
 try{docker(['rm','--force','--volumes',name]);}catch{/* Only this generated disposable container. */}
}
