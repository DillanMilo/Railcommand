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
  // Model the initial live deployment window: the old application keeps its
  // original grants while the new application can call the preparation RPCs.
  sql('grant select on public.projects,public.milestones,public.profiles to authenticated');
  const rolloutBridge = readFileSync(new URL('../supabase/migrations/20261103152824_inventory_finance_rollout_bridge.sql', import.meta.url), 'utf8');
  sql(rolloutBridge);
  assert.equal(Number(as('pm', `select budget_total from public.projects where id='${ids.project}'`)), 130000);
  assert.equal(Number(as('pm', `select budget_total from public.project_finance('${ids.project}')`)), 130000);
  assert.equal(as('foreman', `select count(*) from public.project_finance('${ids.project}')`), '0');
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

  sql(readFileSync(new URL('../supabase/migrations/20261029192357_inventory_profile_access.sql',import.meta.url),'utf8'));
  sql(readFileSync(new URL('../supabase/migrations/20261105160000_inventory_delivered_purchase_price.sql',import.meta.url),'utf8'));
  assert.equal(command('pm',{action:'assign',leadId:ids.lead,pmId:ids.pm}).ok,true);
  const legacyCommand={action:'opening',materialCode:'LEGACY',material:'Legacy ties',yard:'Old yard',quantity:100,source:'Original receipt',inspectionAccepted:true,readiness:'ready'};
  const oldOp=randomUUID(), legacy=command('pm',legacyCommand,oldOp);assert.equal(legacy.ok,true);
  const oldReviewToken=sql(`select inventory_private.token('${ids.project}','${legacy.lotId}')`);
  const tables=['inventory_materials','inventory_lots','inventory_movements','inventory_requests','inventory_counts','inventory_cost_revisions','inventory_events','inventory_receipts'];
  const preserved=tables.map(t=>({t,cols:JSON.parse(sql(`select json_agg(column_name order by ordinal_position) from information_schema.columns where table_schema='public' and table_name='${t}'`)),rows:null}));
  const fingerprint=x=>sql(`select coalesce(json_agg(r order by r::text),'[]'::json) from (select jsonb_build_array(${x.cols.map(c=>`"${c}"`).join(',')}) r from public.${x.t}) q`);
  for(const t of preserved)t.rows=fingerprint(t);
  sql(readFileSync(new URL('../supabase/migrations/20261105221954_inventory_catalogue_units_receiving.sql',import.meta.url),'utf8'));
  for(const t of preserved)assert.equal(fingerprint(t),t.rows,`original values ${t.t}`);
  assert.equal(sql(`select inventory_private.token('${ids.project}','${legacy.lotId}')`),oldReviewToken,'pre-upgrade review token remains valid');
  assert.deepEqual(command('pm',legacyCommand,oldOp),legacy,'pre-upgrade operation replays exactly');
  let s=read('pm');assert.equal(s.catalogue[0].catalogueVersion,1);assert.equal(s.catalogue[0].unit,'each');
  assert.equal(s.finance.policy.annual_rate,.05);assert.equal(s.finance.policy.threshold_amount,50000);
  assert.equal(read('lead').canReceive,true);assert.equal(read('lead').finance,undefined);assert.equal(read('foreman').canReceive,false);
  const fuel={code:'DIESEL-US',name:'Dyed diesel - US gallons',unit:'us_gallon',category:'fuel'};
  assert.equal(command('foreman',{action:'catalogue_add',...fuel}).code,'catalogue_management_denied');
  assert.equal(command('lead',{action:'catalogue_add',...fuel}).code,'catalogue_management_denied');
  assert.equal(command('outsider',{action:'catalogue_add',...fuel}).code,'denied');
  const add=command('pm',{action:'catalogue_add',...fuel});assert.equal(add.ok,true,JSON.stringify(add));
  assert.equal(command('pm',{action:'catalogue_add',...fuel,code:' diesel-us '}).code,'material_code_exists_review_specification');
  assert.equal(command('pm',{action:'catalogue_add',...fuel,code:'OTHER',name:'Dyed  diesel - US gallons'}).code,'material_name_exists_reuse_or_clarify_specification');
  assert.equal(command('pm',{action:'catalogue_add',...fuel,code:'BAD-UNIT',unit:'gallon'}).code,'invalid_catalogue_item');
  const receive={action:'opening',materialId:add.materialId,yard:'Tank A',quantity:250.125,source:'FUEL-RECEIPT-1',receivedAt:'2026-11-01',inspectionAccepted:true};
  assert.equal(command('foreman',receive).code,'opening_denied');
  assert.equal(command('pm',{...receive,materialId:randomUUID()}).code,'choose_approved_material');
  assert.equal(command('pm',{...receive,quantity:1.1234}).code,'invalid_quantity_for_material_unit');
  assert.equal(command('lead',{...receive,inspectionAccepted:false}).code,'inspection_acceptance_required');
  const receiptId=randomUUID(),received=command('lead',receive,receiptId);assert.equal(received.ok,true,JSON.stringify(received));
  assert.deepEqual(command('lead',receive,receiptId),received);
  assert.equal(command('lead',receive).code,'receipt_already_recorded_review_existing_stock');
  assert.equal(command('pm',{...legacyCommand,materialCode:'TYPO'}).code,'choose_approved_material');
  const legacyMaterial=read('pm').catalogue.find(m=>m.code==='LEGACY');
  assert.equal(command('pm',{...receive,materialId:legacyMaterial.id,quantity:1.5,source:'FRACTIONAL-TIES'}).code,'invalid_quantity_for_material_unit');
  s=read('pm');const l=s.lots.find(l=>l.id===received.lotId);assert.equal(l.balance,250.125);assert.equal(l.unit,'us_gallon');assert.equal(l.material_code,'DIESEL-US');
  assert.equal(command('lead',{action:'count',lotId:l.id,lotVersion:1,quantity:250.125,reason:'Tank gauge'}).ok,true);
  assert.equal(command('lead',{action:'count',lotId:l.id,lotVersion:1,quantity:250.1251,reason:'Too precise'}).code,'invalid_quantity_for_material_unit');
  const request=command('foreman',{action:'submit',lotId:l.id,lotVersion:1,quantity:10.125,workLocation:'Machine A',reason:'Synthetic test'});assert.equal(request.ok,true,JSON.stringify(request));
  assert.equal(command('foreman',{action:'submit',lotId:l.id,lotVersion:1,quantity:1.0001,workLocation:'Machine A',reason:'Too precise'}).code,'invalid_quantity_for_material_unit');
  const row={code:'BOLT-1',name:'Track bolt 1 inch',category:'hardware',unit:'each',quantity:12,yard:'Shelf A',source:'OPEN-BOLT-1',inspectionAccepted:true,receivedAt:'2026-11-01'};
  const batch={action:'catalogue_import',importReference:'OPENING-001',rows:[row]};
  const op=randomUUID(), imported=command('pm',batch,op);assert.equal(imported.ok,true,JSON.stringify(imported));assert.equal(imported.lotIds.length,1);
  assert.deepEqual(command('pm',batch,op),imported);
  assert.equal(command('pm',batch).alreadyImported,true);
  assert.equal(command('pm',{...batch,importReference:'DIFFERENT-REF'}).alreadyImported,true);
  assert.equal(command('pm',{...batch,rows:[{...row,quantity:13}]}).code,'import_reference_has_different_rows');
  const counts=()=>sql(`select (select count(*) from inventory_lots)||':'||(select count(*) from inventory_materials)||':'||(select count(*) from inventory_movements)`);
  const before=counts();
  assert.equal(command('pm',{action:'catalogue_import',importReference:'BAD',rows:[{code:'ATOMIC-NEW',name:'Should roll back',unit:'each',category:'other'}, {...fuel,unit:'litre'}]}).code,'material_code_exists_review_specification');
  assert.equal(counts(),before,'whole batch rolls back including first material');
  assert.equal(command('lead',batch).code,'catalogue_management_denied');
  // No direct table-write or helper execution rights; normal RLS reads remain scoped.
  for(const f of ['catalogue_item(uuid,jsonb,boolean)','receive_stock(uuid,uuid,uuid,jsonb)','valid_quantity(numeric,text,boolean)'])assert.equal(sql(`select has_function_privilege('authenticated','inventory_private.${f}','execute')`),'f');
  assert.equal(as('outsider',`select count(*) from inventory_materials where project_id='${ids.project}'`),'0');
  assert.throws(()=>as('foreman',`insert into inventory_materials(project_id,code,name) values('${ids.project}','UNAPPROVED','Denied')`));
  // Release fractional stock using the same distinct-person approval and funded-source gates.
  const components=Object.fromEntries(['log','mill','trucking','treating','drying','creosote','rail_car','install_labour','inspection','carrying_cost','disposal'].map(k=>[k,{amount:null,status:'awaiting_wendy',source:''}]));
  assert.equal(command('pm',{action:'cost',lotId:l.id,lotVersion:1,costVersion:1,pricingMode:'breakdown',components}).code,'delivered_price_required_for_this_material');
  assert.equal(command('pm',{action:'cost',lotId:l.id,lotVersion:1,costVersion:1,pricingMode:'delivered',purchasePrice:{amount:1000,status:'actual',source:'Fuel invoice'},components,sourceKey:'FUEL-ALREADY-FUNDED',funding:'funded',source:'Existing project allocation'}).ok,true);
  // Earlier request pinned an older finance revision: explicitly revise, never silently approve stale evidence.
  let req=read('pm').requests.find(r=>r.id===request.requestId);
  const revised=command('foreman',{action:'revise',lotId:l.id,lotVersion:1,requestId:req.id,expectedVersion:req.version,quantity:10.125});assert.equal(revised.ok,true);
  req=read('pm').requests.find(r=>r.id===req.id);
  assert.equal(command('pm',{action:'authorize',lotId:l.id,lotVersion:1,requestId:req.id,expectedVersion:req.version}).code,'authorization_order_or_assignment_denied');
  const verified=command('lead',{action:'verify',lotId:l.id,lotVersion:1,requestId:req.id,expectedVersion:req.version});assert.equal(verified.ok,true,JSON.stringify(verified));
  const release=command('pm',{action:'authorize',lotId:l.id,lotVersion:1,requestId:req.id,expectedVersion:verified.version});assert.equal(release.ok,true,JSON.stringify(release));assert.equal(release.balance,240);
  assert.equal(read('foreman').finance,undefined);

  const sc=randomUUID();sql(`insert into profiles(id,organization_id,role) values('${sc}','${ids.org}','member');insert into project_members values('${ids.project}','${sc}','engineer',true),('${ids.project}','${ids.admin}','manager',true);update projects set budget_total=1000000,budget_spent=0 where id='${ids.project}'`);
  assert.equal(command('admin',{action:'supply_chain_assign',expectedVersion:0,supplyChainId:sc}).ok,true);
  const year=Number(sql("select extract(year from current_date)::integer"));
  function setupContract(key,amount=0){
    assert.equal(command('pm',{action:'contract',contractKey:key,name:key,startDate:`${year}-01-01`}).ok,true);
    const cid=sql(`select id from inventory_contracts where contract_key='${key}'`);
    assert.equal(command('pm',{action:'baseline',contractId:cid,periodYear:year,currency:'USD',expectedVersion:0,amount,evidence:'Synthetic external baseline excludes every tracked purchase',verifiedExcludesTrackedSources:true}).ok,true);return cid;
  }
  function purchase(key,amount,cid){
    const received=command('lead',{...receive,quantity:100.5,source:key});assert.equal(received.ok,true);
    assert.equal(command('pm',{action:'cost',lotId:received.lotId,lotVersion:1,costVersion:1,components,pricingMode:'delivered',purchasePrice:{amount,status:'actual',source:key},sourceKey:key,funding:'new',incrementalAmount:amount,source:key,contractId:cid,periodYear:year,currency:'USD'}).ok,true);
    const req=command('foreman',{action:'submit',lotId:received.lotId,lotVersion:1,quantity:.5,workLocation:'Synthetic machine',reason:'Test fuel issue'});assert.equal(req.ok,true);
    assert.equal(command('lead',{action:'verify',requestId:req.requestId,lotVersion:1,expectedVersion:1}).ok,true);
    return {lotId:received.lotId,requestId:req.requestId};
  }
  const exact=purchase('EXACT-50K',50000,setupContract('EXACT-50K'));
  assert.equal(command('pm',{action:'authorize',requestId:exact.requestId,lotVersion:1,expectedVersion:2}).ok,true);
  assert.equal(read('pm').requests.find(r=>r.id===exact.requestId).state,'posted');
  const splitContract=setupContract('SPLIT-REVIEW');
  const first=purchase('SPLIT-A',30000,splitContract);
  assert.equal(command('pm',{action:'authorize',requestId:first.requestId,lotVersion:1,expectedVersion:2}).ok,true);
  const second=purchase('SPLIT-B',25000,splitContract);
  let annual=read('pm').finance.annual.find(a=>a.lotId===second.lotId).evaluation;
  assert.equal(annual.forecast,55000);assert.equal(annual.requiresSupplyChain,true);assert.equal(annual.likelySplit,true);
  const scOp=randomUUID();assert.equal(command('pm',{action:'authorize',requestId:second.requestId,lotVersion:1,expectedVersion:2},scOp).ok,true);
  assert.equal(read('pm').requests.find(r=>r.id===second.requestId).state,'awaiting_supply_chain');
  assert.equal(read('pm').lots.find(l=>l.id===second.lotId).balance,100.5,'PM alone cannot release over-threshold fuel');
  assert.equal(command('pm',{action:'supply_chain',requestId:second.requestId,lotVersion:1,expectedVersion:3}).code,'supply_chain_order_or_assignment_denied');
  const final={action:'supply_chain',requestId:second.requestId,lotVersion:1,expectedVersion:3};
  assert.equal(command(sc,final).ok,true);assert.equal(read('pm').lots.find(l=>l.id===second.lotId).balance,100);
  // Parallel duplicate imports with different operation identities still create one lot.
  const race={action:'catalogue_import',importReference:'CONCURRENT',rows:[{...row,code:'CONCURRENT',name:'Concurrent import stock',source:'CONCURRENT-RECEIPT'}]};
  const runAsync=(op)=>new Promise((resolve,reject)=>{
    const proc=spawn('docker',['exec','-i',name,'psql','-X','-U','postgres','-Atq','-v','ON_ERROR_STOP=1']);let out='',err='';
    proc.stdout.on('data',b=>out+=b);proc.stderr.on('data',b=>err+=b);proc.on('close',code=>code?reject(new Error(err)):resolve(JSON.parse(out.trim())));
    proc.stdin.end(`set role authenticated;set request.jwt.claim.sub='${ids.pm}';select inventory_execute('${ids.project}','${op}','${JSON.stringify(race)}');`);
  });
  const raced=await Promise.all([runAsync(randomUUID()),runAsync(randomUUID())]);assert.ok(raced.every(r=>r.ok));assert.equal(raced.filter(r=>r.alreadyImported).length,1);
  assert.equal(sql(`select count(*) from inventory_lots l join inventory_materials m on m.id=l.material_id where m.code='CONCURRENT'`),'1');
  const normalizeReplay=command('pm',{...race,importReference:'CONCURRENT-ALIAS',rows:[{...race.rows[0],code:' concurrent ',name:' Concurrent import stock ',quantity:12.000}]});
  assert.equal(normalizeReplay.alreadyImported,true);
  console.log('PASS upgraded rules: exactly $50k, >$50k distinct SC before release, split flags, fractional issues and concurrent/canonical CSV dedup.');
  console.log('PASS catalogue DB: additive preservation; role/RLS/helper denials; approved selection; fixed units/fractions; receipt replay; CSV atomicity, duplicate/reference safety; fractional ordered approval/release; unchanged 5%/$50k defaults.');
} finally { if(created) docker(['rm','--force','--volumes',name]); }
