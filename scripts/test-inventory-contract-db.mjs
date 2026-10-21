// Real disposable PostgreSQL. No hosted URL, secrets, production data, or exposed port.
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
const name = `railcommand-inventory-${randomUUID()}`;
const docker = (args) =>
  execFileSync("docker", args, {
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  }).trim();
const endpoint =
  process.env.DOCKER_HOST ||
  JSON.parse(docker(["context", "inspect"]))[0].Endpoints.docker.Host;
assert.match(endpoint, /^(unix:\/\/|npipe:\/\/)/);
function sql(s) {
  return execFileSync(
    "docker",
    [
      "exec",
      "-i",
      name,
      "psql",
      "-X",
      "-h",
      "127.0.0.1",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-Atq",
      "-v",
      "ON_ERROR_STOP=1",
    ],
    { input: s, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
  ).trim();
}
const ids = Object.fromEntries(
  [
    "org",
    "project",
    "foreign",
    "foreman",
    "lead",
    "pm",
    "owner",
    "outsider",
    "admin",
  ].map((k) => [k, randomUUID()]),
);
const as = (user, s) =>
  sql(
    `set role authenticated; set request.jwt.claim.sub='${ids[user] ?? user}'; ${s}`,
  );
function command(user, command, operation = randomUUID()) {
  return JSON.parse(
    as(
      user,
      `select public.inventory_execute('${ids.project}','${operation}','${JSON.stringify(command).replaceAll("'", "''")}'::jsonb)`,
    ),
  );
}
const read = (user) =>
  JSON.parse(as(user, `select public.inventory_read('${ids.project}')`));
const snapshot = readFileSync(
  new URL("../supabase/schema_snapshot.sql", import.meta.url),
  "utf8",
);
const ddl = (table) =>
  snapshot.match(
    new RegExp(
      'CREATE TABLE IF NOT EXISTS "public"\\."' +
        table +
        '" \\([\\s\\S]+?\\n\\);',
    ),
  )[0];
let created = false;
try {
  docker([
    "run",
    "--detach",
    "--name",
    name,
    "--network",
    "none",
    "--tmpfs",
    "/var/lib/postgresql/data",
    "-e",
    "POSTGRES_HOST_AUTH_METHOD=trust",
    "postgres:17",
  ]);
  created = true;
  for (let i = 0; i < 100; i++) {
    try {
      docker(["exec", name, "pg_isready", "-h", "127.0.0.1", "-U", "postgres"]);
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  sql(`create role anon; create role authenticated; create role service_role bypassrls;
 create table public.activity_log(project_id uuid,entity_type text,description text);
 create schema auth; create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth,public to authenticated,anon,service_role;
 create table public.organizations(id uuid primary key);
 insert into public.organizations values('${ids.org}');
 create table public.profiles(id uuid primary key,organization_id uuid,role text,full_name text,email text);
 ${ddl("projects")}
 alter table public.projects add primary key(id);
 create table public.project_members(project_id uuid,profile_id uuid,project_role text,can_edit boolean);
 ${ddl("milestones")}
 alter table public.milestones add primary key(id);
 ${ddl("change_orders")}
 alter table public.change_orders add primary key(id);
 alter table public.change_orders enable row level security;
 grant select on public.change_orders to authenticated;
 create policy fixture_co_members on public.change_orders for select to authenticated using(true);
 insert into public.projects(id,organization_id,budget_total,budget_spent,name,start_date,target_end_date,created_by) values('${ids.project}','${ids.org}',130000,126000,'Synthetic inventory project',current_date,current_date,'${ids.pm}'),('${ids.foreign}','${randomUUID()}',99999,0,'Foreign synthetic project',current_date,current_date,'${ids.pm}');
 ${["foreman", "lead", "pm", "owner", "outsider", "admin"].map((u) => `insert into public.profiles(id,organization_id,role) values('${ids[u]}','${ids.org}','${u === "admin" ? "admin" : "member"}');`).join("\n")}
 ${["foreman", "lead", "pm", "owner"].map((u) => `insert into public.project_members values('${ids.project}','${ids[u]}','${u === "lead" ? "inspector" : u === "pm" ? "manager" : u}',true);`).join("\n")}`);
  sql(
    `create function auth.role() returns text language sql stable as $$select current_user::text$$;grant select on public.project_members to authenticated;alter table public.projects enable row level security;alter table public.milestones enable row level security;drop policy fixture_co_members on public.change_orders;`,
  );
  sql(
    snapshot.match(
      /CREATE OR REPLACE FUNCTION "public"\."is_project_member"[\s\S]+?\$\$;/,
    )[0],
  );
  for (const name of [
    "projects_select",
    "Project members can read milestones",
    "Members can read change orders",
  ])
    sql(
      snapshot.match(new RegExp('CREATE POLICY "' + name + '"[\\s\\S]+?;'))[0],
    );
  const migration = readdirSync(
    new URL("../supabase/migrations/", import.meta.url),
  ).find((f) => f.endsWith("_inventory_phase_one.sql"));
  sql(
    readFileSync(
      new URL(`../supabase/migrations/${migration}`, import.meta.url),
      "utf8",
    ),
  );
  sql(readFileSync(new URL("../supabase/migrations/20261020172309_inventory_operation_settlement.sql", import.meta.url), "utf8"));
  sql(readFileSync(new URL("../supabase/migrations/20261021170501_inventory_confirmed_contract_rules.sql", import.meta.url), "utf8"));
  const year = Number(sql("select extract(year from current_date)::integer"));
  ids.sc = randomUUID(); ids.project2 = randomUUID();
  sql(`insert into public.profiles(id,organization_id,role) values('${ids.sc}','${ids.org}','member');
    insert into public.projects(id,organization_id,budget_total,budget_spent,name,start_date,target_end_date,created_by) values('${ids.project2}','${ids.org}',10000000,0,'Synthetic same-contract second project',current_date,current_date,'${ids.pm}');
    update public.projects set budget_total=10000000,budget_spent=0 where id='${ids.project}';
    insert into public.project_members values('${ids.project}','${ids.sc}','engineer',true);
    insert into public.project_members select '${ids.project2}',profile_id,project_role,can_edit from public.project_members where project_id='${ids.project}';`);
  const at = (p,u,c,id=randomUUID()) => JSON.parse(as(u,`select public.inventory_execute('${p}','${id}','${JSON.stringify(c).replaceAll("'","''")}'::jsonb)`));
  const snap = (p=ids.project,u='pm') => JSON.parse(as(u,`select public.inventory_read('${p}')`));
  for(const p of [ids.project,ids.project2]) {
    assert.equal(at(p,'pm',{action:'assign',leadId:ids.lead,pmId:ids.pm}).ok,true);
    assert.equal(at(p,'pm',{action:'supply_chain_assign',expectedVersion:0,supplyChainId:ids.sc}).ok,true);
  }
  assert.equal(snap().finance.policy.annual_rate,0.05);
  assert.equal(snap().finance.policy.threshold_amount,50000);
  assert.match(snap().finance.policy.source,/Wendy-confirmed 2026-10-21/);
  const newOrg=randomUUID(); sql(`insert into public.organizations values('${newOrg}')`);
  assert.equal(sql(`select annual_rate from public.inventory_org_policy where organization_id='${newOrg}'`),'0.05');
  assert.equal(sql(`select inventory_private.anniversary('2024-02-29',2025)`),'2025-02-28');
  assert.equal(sql(`select inventory_private.anniversary('2024-02-29',2028)`),'2028-02-29');
  assert.equal(sql(`select inventory_private.contract_period_start('2024-02-29','2025-02-27')`),'2024-02-29');
  assert.equal(sql(`select inventory_private.contract_period_start('2024-02-29','2025-02-28')`),'2025-02-28');
  assert.equal(sql(`select inventory_private.contract_period_start('2024-02-29','2026-01-01')`),'2025-02-28');
  assert.equal(sql(`select inventory_private.contract_period_start('2024-07-15','2026-07-14')`),'2025-07-15');
  assert.equal(sql(`select inventory_private.contract_period_start('2024-07-15','2026-07-15')`),'2026-07-15');
  const allNull=Object.fromEntries(['log','mill','trucking','treating','drying','creosote','rail_car','install_labour','inspection','carrying_cost','disposal'].map(k=>[k,{amount:null,status:'awaiting_wendy',source:''}]));
  function contract(key,baseline=0,start=`${year-1}-01-01`) {
    assert.equal(at(ids.project,'pm',{action:'contract',contractKey:key,name:'Synthetic '+key,startDate:start}).ok,true);
    const id=snap().finance.contracts.find(c=>c.contract_key===key).id;
    if(baseline!==null) assert.equal(at(ids.project,'pm',{action:'baseline',contractId:id,periodYear:year,currency:'USD',expectedVersion:0,amount:baseline,evidence:'Manually verified synthetic external approvals; excludes ALL sources tracked here',verifiedExcludesTrackedSources:true}).ok,true);
    return id;
  }
  function lot(p,key,amount,cid,options={}) {
    const opened=at(p,'pm',{action:'opening',materialCode:'TIE',material:'Ties',yard:'Synthetic '+key,quantity:1000,source:'Synthetic acceptance',inspectionAccepted:true,receivedAt:`${year}-01-01`});assert.equal(opened.ok,true,JSON.stringify(opened));
    const c={action:'cost',lotId:opened.lotId,lotVersion:1,costVersion:1,components:allNull,sourceKey:key,funding:'new',source:'Synthetic purchase '+key,incrementalAmount:amount,contractId:cid,periodYear:year,currency:'USD',...options};
    const saved=at(p,'pm',c);assert.equal(saved.ok,true,JSON.stringify(saved));return opened.lotId;
  }
  function request(p,l) {
    const q=at(p,'foreman',{action:'submit',lotId:l,lotVersion:1,quantity:10,workLocation:'Synthetic milepost',reason:'Synthetic operational field reason'});assert.equal(q.ok,true,JSON.stringify(q));
    const v=at(p,'lead',{action:'verify',requestId:q.requestId,expectedVersion:1,lotVersion:1});assert.equal(v.ok,true,JSON.stringify(v));return q.requestId;
  }
  const authorize=(p,q,version=2,u='pm')=>at(p,u,{action:u==='sc'?'supply_chain':'authorize',requestId:q,expectedVersion:version,lotVersion:1});
  function state(p,id){return snap(p).requests.find(x=>x.id===id).state;}
  const cid=contract('PRIOR-30K',30000),l=lot(ids.project,'new-25k',25000,cid),q=request(ids.project,l);
  assert.equal(authorize(ids.project,q).ok,true);assert.equal(state(ids.project,q),'awaiting_supply_chain');
  assert.equal(sql(`select balance from public.inventory_lots where id='${l}'`),'1000');
  assert.equal(at(ids.project,'pm',{action:'supply_chain',requestId:q,expectedVersion:3,lotVersion:1}).code,'supply_chain_order_or_assignment_denied');
  assert.equal(authorize(ids.project,q,3,'sc').ok,true);assert.equal(state(ids.project,q),'posted');
  assert.equal(sql(`select balance from public.inventory_lots where id='${l}'`),'990');
  assert.equal(sql(`select count(*) from public.inventory_approval_evidence where request_id='${q}'`),'4');
  for(const [key,amount,waiting] of [['EXACT',50000,false],['CENT-OVER',50000.01,true]]) {
    const c=contract(key),l=lot(ids.project,key,amount,c),q=request(ids.project,l);
    assert.equal(authorize(ids.project,q).ok,true);assert.equal(state(ids.project,q),waiting?'awaiting_supply_chain':'posted');
  }
  const missing=contract('UNRECONCILED',null),ml=lot(ids.project,'missing-baseline',100,missing),mq=request(ids.project,ml);
  assert.equal(authorize(ids.project,mq).code,'contract_reconciliation_required');
  assert.equal(snap().finance.annual.find(a=>a.lotId===ml).evaluation.state,'reconciliation_required');
  const absent=lot(ids.project,'no-contract',100,''),aq=request(ids.project,absent);assert.equal(authorize(ids.project,aq).code,'contract_reconciliation_required');
  const foreignYear=lot(ids.project,'prior-year',100,cid,{periodYear:year-1}),fq=request(ids.project,foreignYear);assert.equal(authorize(ids.project,fq).code,'contract_reconciliation_required');
  const cad=lot(ids.project,'different-currency',100,cid,{currency:'CAD'}),cq=request(ids.project,cad);assert.equal(authorize(ids.project,cq).code,'contract_reconciliation_required');
  const funded=lot(ids.project,'funded',999999,'',{funding:'funded'}),fundedQ=request(ids.project,funded);assert.equal(authorize(ids.project,fundedQ).ok,true);
  assert.equal(snap().finance.annual.find(a=>a.lotId===funded).evaluation.incremental,0);
  // Source reuse across projects is one immutable financial identity and one commitment.
  const dc=contract('DEDUP'),d1=lot(ids.project,'same-purchase',30000,dc),d2=lot(ids.project2,'same-purchase',30000,dc);
  const dq1=request(ids.project,d1);assert.equal(authorize(ids.project,dq1).ok,true);
  const dq2=request(ids.project2,d2);assert.equal(authorize(ids.project2,dq2).ok,true);
  assert.equal(sql(`select count(*) from public.inventory_contract_commitments c join public.inventory_contract_sources s on s.id=c.source_id where s.contract_id='${dc}'`),'1');
  const da=snap(ids.project2).finance.annual.find(a=>a.lotId===d2).evaluation;assert.equal(da.committed,30000);assert.equal(da.incremental,0);assert.equal(da.likelySplit,false);assert.equal(snap(ids.project2).finance.budget.postedNewExposure,0);
  // Real concurrent cross-project final transactions. Org lock forces the second
  // transaction to observe changed aggregate and require explicit rebase/reapproval.
  const rc=contract('PARALLEL'),r1=lot(ids.project,'race-30a',30000,rc),r2=lot(ids.project2,'race-30b',30000,rc),rq1=request(ids.project,r1),rq2=request(ids.project2,r2);
  function connection(p,q,id,hold=false) {
    const cmd={action:'authorize',requestId:q,expectedVersion:2,lotVersion:1};
    const input=`begin;set role authenticated;set request.jwt.claim.sub='${ids.pm}';select public.inventory_execute('${p}','${id}','${JSON.stringify(cmd)}');${hold?'select pg_sleep(1);':''}commit;`;
    const proc=spawn('docker',['exec','-i',name,'psql','-X','-h','127.0.0.1','-U','postgres','-d','postgres','-Atq','-v','ON_ERROR_STOP=1']);let out='',err='';proc.stdout.on('data',b=>out+=b);proc.stderr.on('data',b=>err+=b);proc.stdin.end(input);
    return {done:new Promise((resolve,reject)=>proc.on('close',code=>code===0?resolve(out):reject(new Error(err))))};
  }
  const raceOperation=randomUUID(),first=connection(ids.project,rq1,raceOperation,true);
  for(let i=0;i<100;i++){if(Number(sql("select count(*) from pg_stat_activity where wait_event='PgSleep'"))>0)break;await new Promise(r=>setTimeout(r,10));if(i===99)throw new Error('first transaction never reached precommit barrier');}
  const second=connection(ids.project2,rq2,randomUUID());const results=await Promise.all([first.done,second.done]);
  assert.equal(JSON.parse(results[0].split('\n')[0]).ok,true);assert.equal(JSON.parse(results[1].split('\n')[0]).code,'review_changed_rebase_required');
  assert.equal(state(ids.project2,rq2),'verified');assert.equal(sql(`select balance from public.inventory_lots where id='${r2}'`),'1000');
  assert.equal(at(ids.project2,'foreman',{action:'revise',requestId:rq2,expectedVersion:2,lotVersion:1}).ok,true);
  assert.equal(at(ids.project2,'lead',{action:'verify',requestId:rq2,expectedVersion:3,lotVersion:1}).ok,true);
  const ra=snap(ids.project2).finance.annual.find(a=>a.lotId===r2).evaluation;
  assert.equal(ra.forecast,60000);assert.equal(ra.requiresSupplyChain,true);assert.equal(ra.likelySplit,true);assert.equal(ra.sources.length,1);
  assert.equal(authorize(ids.project2,rq2,4).ok,true);assert.equal(state(ids.project2,rq2),'awaiting_supply_chain');assert.equal(authorize(ids.project2,rq2,5,'sc').ok,true);
  const sourceRows=sql(`select count(*) from public.inventory_contract_sources where contract_id='${rc}'`);assert.equal(sourceRows,'2');
  const receipt=at(ids.project,'pm',{action:'authorize',requestId:rq1,expectedVersion:2,lotVersion:1},raceOperation);assert.equal(receipt.ok,true);
  assert.equal(at(ids.project,'pm',{action:'authorize',requestId:rq1,expectedVersion:9,lotVersion:1},raceOperation).code,'operation_conflict');
  assert.equal(sql(`select count(*) from public.inventory_movements where request_id='${rq1}'`),'1');
  // Policy and baseline changes invalidate pending approvals; history is immutable.
  const pc=contract('POLICY'),pl=lot(ids.project,'policy-purchase',100,pc),pq=request(ids.project,pl);
  const beforePolicy=snap().finance.policy.version;
  assert.equal(at(ids.project,'foreman',{action:'policy',expectedVersion:beforePolicy,annualRate:0.04,thresholdAmount:60000,currency:'USD',source:'unauthorized'}).code,'configuration_denied');
  assert.equal(at(ids.project,'pm',{action:'policy',expectedVersion:beforePolicy,annualRate:0.04,thresholdAmount:60000,currency:'USD',source:'Synthetic explicit organization policy edit'}).ok,true);
  assert.equal(authorize(ids.project,pq).code,'review_changed_rebase_required');assert.equal(snap().finance.policyHistory.length,2);
  assert.equal(at(ids.project,'pm',{action:'policy',expectedVersion:beforePolicy,annualRate:0.04,thresholdAmount:60000,currency:'USD',source:'stale'}).code,'stale_policy');
  const bl=lot(ids.project,'baseline-revision-purchase',100,pc),bq=request(ids.project,bl);
  assert.equal(at(ids.project,'pm',{action:'baseline',contractId:pc,periodYear:year,currency:'USD',expectedVersion:1,amount:200,evidence:'Updated externally reconciled baseline excluding tracked sources',verifiedExcludesTrackedSources:true}).ok,true);
  assert.equal(authorize(ids.project,bq).code,'review_changed_rebase_required');
  // Current membership revalidation, scoped assignments, and no administrative bypass.
  assert.equal(at(ids.project,'pm',{action:'supply_chain_assign',expectedVersion:1,supplyChainId:ids.pm}).code,'distinct_eligible_supply_chain_required');
  sql(`update public.project_members set can_edit=false where project_id='${ids.project}' and profile_id='${ids.sc}'`);
  const deniedC=contract('REVOKED',60000),deniedL=lot(ids.project,'revoked-approver',1,deniedC),deniedQ=request(ids.project,deniedL);
  assert.equal(authorize(ids.project,deniedQ).code,'supply_chain_assignment_required');
  assert.equal(at(ids.project,'admin',{action:'policy',expectedVersion:2,annualRate:0.04,thresholdAmount:60000,currency:'USD',source:'forged admin'}).code,'denied');
  assert.equal(at(ids.foreign,'pm',{action:'contract',contractKey:'foreign',name:'Foreign probe',startDate:'2020-01-01'}).code,'denied');
  assert.equal(at(ids.project,'pm',{action:'contract',contractKey:'missing-start',name:'Cannot supply missing start'}).code,'invalid_input');
  const privateTables=['inventory_org_policy','inventory_contracts','inventory_contract_baselines','inventory_contract_sources','inventory_exposure_contracts','inventory_contract_commitments','inventory_supply_chain_assignments','inventory_approval_evidence'];
  for(const table of privateTables){assert.throws(()=>as('pm',`select * from public.${table}`),/permission denied/);assert.throws(()=>as('pm',`delete from public.${table}`),/permission denied/);assert.equal(sql(`select has_table_privilege('anon','public.${table}','select')`),'f');assert.equal(sql(`select relrowsecurity from pg_class where oid='public.${table}'::regclass`),'t');}
  assert.throws(()=>sql(`update public.inventory_org_policy set annual_rate=0`),/Append-only/);
  assert.equal(sql(`select has_function_privilege('anon','public.inventory_execute(uuid,uuid,jsonb)','execute')`),'f');
  assert.equal(sql(`select has_function_privilege('authenticated','inventory_private.annual(uuid,uuid)','execute')`),'f');
  const field=JSON.stringify(snap(ids.project,'foreman'));for(const text of ['annual_rate','threshold_amount','forecast','Synthetic purchase','reconciled baseline','likelySplit','inventory_org_policy'])assert.ok(!field.includes(text),text);
  const never=randomUUID();const settled=JSON.parse(as('pm',`select public.inventory_settle('${ids.project}','${never}')`));assert.equal(settled.code,'operation_not_applied');
  assert.equal(at(ids.project,'pm',{action:'policy',expectedVersion:2,annualRate:0.03,thresholdAmount:55000,currency:'USD',source:'Late delivery'},never).code,'operation_conflict');
  console.log('PASS real PostgreSQL confirmed rules: defaults/history, strict cents, contract years/leap days, baseline/currency holds, distinct Supply Chain, cross-project race/rebase, source dedup/split evidence, permissions/immutability/privacy and settlement');
} finally { if(created) docker(['rm','--force',name]); }
