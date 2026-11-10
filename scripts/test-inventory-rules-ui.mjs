// Actual production web and native React components. Native primitives/Expo/session
// are explicit browser adapters; synthetic shared HTTP transport is NOT DB/RLS proof.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
const root=process.cwd(),dir=mkdtempSync(join(tmpdir(),'tia-rules-ui-'));
const users={foreman:randomUUID(),lead:randomUUID(),pm:randomUUID(),admin:randomUUID(),engineer:randomUUID(),sc:randomUUID()},projectId=randomUUID(),lotId=randomUUID(),contractId=randomUUID(),requestId=randomUUID();
const receipts=new Map(),commands=[];
const cost={id:randomUUID(),lot_id:lotId,version:2,components:Object.fromEntries(['log','mill','trucking','treating','drying','creosote','rail_car','install_labour','inspection','carrying_cost','disposal'].map((k,i)=>[k,{amount:i<7?(i===0?17000:8500):null,status:'actual',source:'Synthetic source'}])),exposure_id:'exposure',created_at:'2026-03-02'};
const policy={organization_id:randomUUID(),version:1,annual_rate:0.05,threshold_amount:50000,currency:'USD',period_convention:'contract_year',spend_basis:'approved_commitments_plus_proposed',source:'Wendy-confirmed 2026-10-21',created_by:null,created_at:'2026-03-02'};
const annual={state:'complete',contractId,periodYear:2026,periodStart:'2026-01-01',periodEndExclusive:'2027-01-01',currency:'USD',sourceId:'purchase-2',sourceKey:'new-purchase',committed:30000,incremental:30000,forecast:60000,requiresSupplyChain:true,eligibleSupplyChain:true,likelySplit:true,policy,baseline:{version:1,amount:0},sources:[{sourceId:'purchase-1',sourceKey:'prior-purchase',amount:30000,evidence:'Synthetic prior purchase evidence',projectId:'other-project',requestId:'prior-request',actorId:users.pm,createdAt:'2026-02-01'}],proposedSource:{sourceId:'purchase-2',sourceKey:'new-purchase',amount:30000,evidence:'Synthetic proposed purchase evidence',projectId,actorId:users.pm}};
const request={id:requestId,number:1,lot_id:lotId,requester_id:users.foreman,quantity:10,work_location:'Synthetic milepost',reason:'Track maintenance',state:'verified',version:2,revision:1,verifier_id:users.lead,approver_id:null,created_at:'2026-03-02'};
const finance={policy,policyHistory:[{...policy}],contracts:[{id:contractId,contract_key:'SHARED-CONTRACT',name:'Synthetic organization contract',start_date:'2024-01-01'}],baselines:[],contractSources:[],annual:[{lotId,evaluation:annual}],supplyChainAssignment:{actor_id:users.sc,version:1},approvalEvidence:[],budget:{base:1000000,spent:0,adjusted:1000000,postedNewExposure:0,changeOrders:[]},costs:[cost],sources:[{id:'exposure',source_key:'new-purchase',funding:'new',amount:30000,source:'Synthetic proposed purchase evidence',milestone_id:null,change_order_id:null}],milestones:[],configuration:null,evaluation:'incomplete_awaiting_wendy'};
function snapshot(actor){return {projectId,asOf:'2026-03-02T12:00:00Z',canManage:['pm','admin'].includes(actor),actors:Object.entries(users).map(([role,id])=>({id,name:role,role})),assignments:{lead_id:users.lead,pm_id:users.pm,version:1},lots:[{id:lotId,project_id:projectId,material:'Synthetic ties',yard:'North yard',balance:request.state==='posted'?990:1000,opening_quantity:1000,version:request.state==='posted'?2:1,readiness:'ready',inspection_accepted:true,received_at:'2026-01-01',age_source:'Accepted receipt',drying_min_months:4,drying_max_months:10,condition:'aged',latestCount:null}],requests:[request],events:[],denials:[],...(['pm','sc','admin'].includes(actor)?{finance:{...finance,canConfigurePolicy:actor==='admin',canManageAccess:actor==='admin',canApproveSupplyChain:actor==='sc'}}:{})};}
const nativeStub=`import React from 'react';const flat=s=>Array.isArray(s)?Object.assign({},...s):s;export const View=({children,style})=><div style={flat(style)}>{children}</div>;export const ScrollView=View;export const Text=({children})=><span>{children}</span>;export const TextInput=({accessibilityLabel,value,onChangeText,editable})=><input aria-label={accessibilityLabel} value={value} disabled={editable===false} onChange={e=>onChangeText?.(e.target.value)}/>;export const Pressable=({children,onPress,disabled,accessibilityRole,accessibilityLabel,accessibilityState})=><button role={accessibilityRole} aria-label={accessibilityLabel} aria-checked={accessibilityState?.checked} disabled={disabled} onClick={onPress}>{children}</button>;export const StyleSheet={create:x=>x};export const AppState={addEventListener:()=>({remove(){}})};`;

const uiStub=`import React from 'react';export const Screen=({children})=><main>{children}</main>;export const Card=({children})=><section>{children}</section>;export const SectionTitle=({children})=><h2>{children}</h2>;export const PageHeading=({title,detail})=><header><h1>{title}</h1><p>{detail}</p></header>;export const StatusBanner=({title,detail})=><div role="status">{title} {detail}</div>;export const PrimaryButton=({title,onPress,disabled})=><button disabled={disabled} onClick={onPress}>{title}</button>;export const SecondaryButton=PrimaryButton;export const uiStyles={input:{},muted:{}};`;
const harness=`import React from 'react';import{createRoot}from'react-dom/client';import{InventoryWorkspace}from'${root}/src/app/(app)/projects/[id]/inventory/InventoryWorkspace';import NativeInventory from '${root}/apps/mobile/src/app/inventory';import*as drafts from'${root}/src/lib/inventory/drafts';import{openOfflineDatabase}from'${root}/src/lib/offline/storage';export const actor=new URL(location.href).searchParams.get('actor')||'pm';export const userId=${JSON.stringify(users)}[actor];export const projectId=${JSON.stringify(projectId)};export const current=()=>true;const call=async(params='',body)=>{const r=await fetch('/synthetic?actor='+actor+params,body?{method:'POST',body:JSON.stringify(body)}:{});return r.json();};export const api={readInventory:()=>call(),executeInventory:(p,operationId,command)=>call('',{operationId,command}),inventoryReceipt:async(p,id)=>({receipt:(await call('&operationId='+id)).receipt})};export const store={readDraft:(u,p)=>drafts.readInventoryDraft(u,p),saveDraft:drafts.saveInventoryDraft,deleteDraft:(u,p)=>drafts.removeInventoryDraft(u,p),cache:(u,s)=>drafts.cacheInventory(u,s),readCache:(u,p)=>drafts.readCachedInventory(u,p)};window.testRules={drafts,openOfflineDatabase,userId,projectId};const transport={read:()=>api.readInventory(projectId),execute:(id,c)=>api.executeInventory(projectId,id,c),receipt:async id=>(await api.inventoryReceipt(projectId,id)).receipt};createRoot(document.getElementById('root')).render(new URL(location.href).searchParams.get('platform')==='native'?<NativeInventory/>:<InventoryWorkspace userId={userId} projectId={projectId} transport={transport}/>);`;
const glue=`import{userId,projectId,current,api,store}from'tia-harness';export const useAuth=()=>({session:{user:{id:userId}},sessionRevision:1,isSessionCurrent:current});export const useMobileData=()=>{const[o,set]=React.useState(navigator.onLine);React.useEffect(()=>{const f=()=>set(navigator.onLine);addEventListener('online',f);addEventListener('offline',f);return()=>{removeEventListener('online',f);removeEventListener('offline',f)}},[]);return{activeProjectId:projectId,online:o}};export const mobileApiForUser=()=>api;export const inventoryStore=store;`;
await build({stdin:{contents:harness,resolveDir:root,sourcefile:'tia-harness.tsx',loader:'tsx'},bundle:true,alias:{react:root+'/node_modules/react','react-dom':root+'/node_modules/react-dom'},platform:'browser',format:'iife',outfile:join(dir,'ui.js'),jsx:'automatic',tsconfig:join(root,'tsconfig.json'),define:{'process.env.NODE_ENV':'"production"','process.env.NEXT_PUBLIC_SUPABASE_URL':'"https://synthetic.invalid"','process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY':'"synthetic-public-key"'},loader:{'.css':'css'},plugins:[{name:'explicit-native-browser-adapters',setup(b){
// Keep the full current Inventory screen real. Only platform primitives, app
// session/transport and native file sharing are explicit browser adapters.
b.onResolve({filter:/^@\/components\/inventory-/},a=>({path:root+'/apps/mobile/src/components/'+a.path.split('/').at(-1)+'.tsx'}));
b.onResolve({filter:/^\.\/ui$/},a=>a.importer.includes('/apps/mobile/')?{path:'@/components/ui',namespace:'synthetic-native'}:undefined);
b.onResolve({filter:/^@\/lib\/native-inventory-export$/},a=>({path:a.path,namespace:'native-export-adapter'}));
b.onLoad({filter:/.*/,namespace:'native-export-adapter'},()=>({contents:'export async function shareNativeInventoryCsv(){throw new Error("Native share sheet is outside this browser test");}',loader:'js'}));
b.onResolve({filter:/^(react-native|expo-crypto|@\/components\/ui|@\/providers\/auth-provider|@\/providers\/mobile-data-provider|@\/lib\/api|@\/lib\/offline-store|@\/theme|tia-harness|@\/components\/inventory-confirmed-rules)$/},a=>{if(a.path==='@/components/inventory-confirmed-rules')return{path:root+'/apps/mobile/src/components/inventory-confirmed-rules.tsx'};return{path:a.path,namespace:'synthetic-native'}});b.onLoad({filter:/.*/,namespace:'synthetic-native'},a=>({contents:a.path==='react-native'?nativeStub:a.path==='@/components/ui'?uiStub:a.path==='expo-crypto'?'export const randomUUID=()=>crypto.randomUUID();':a.path==='@/theme'?'export const colors={};':a.path==='tia-harness'?harness.slice(0,harness.indexOf('window.testRules')):`import React from'react';${glue}`,loader:'tsx',resolveDir:root}));}}],logLevel:'silent'});
const server=createServer(async(req,res)=>{const u=new URL(req.url,'http://localhost'),actor=u.searchParams.get('actor')||'pm';if(u.pathname==='/synthetic'){let data;if(req.method==='POST'){let body='';for await(const c of req)body+=c;const {operationId:id,command:c}=JSON.parse(body);commands.push({actor,c});data={ok:true};if(c.action==='policy'){assert.equal(c.expectedVersion,'1');policy.version=2;policy.annual_rate=Number(c.annualRate);policy.threshold_amount=Number(c.thresholdAmount);policy.source=c.source;finance.policyHistory.push({...policy});}if(c.action==='authorize'){request.state='awaiting_supply_chain';request.approver_id=users.pm;request.version++;}if(c.action==='supply_chain'){request.state='posted';request.version++;}receipts.set(actor+id,data);}else data=u.searchParams.has('operationId')?{receipt:receipts.get(actor+u.searchParams.get('operationId'))??null}:snapshot(actor);res.setHeader('content-type','application/json');res.end(JSON.stringify(data));return;}if(u.pathname==='/ui.js'||u.pathname==='/ui.css'){res.setHeader('content-type',u.pathname.endsWith('.js')?'text/javascript':'text/css');res.end(readFileSync(join(dir,u.pathname.slice(1))));return;}res.setHeader('content-type','text/html');res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/ui.css"><div id="root"></div><script src="/ui.js"></script>');});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;const browser=await chromium.launch({headless:true,executablePath:process.env.TIA_CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});const context=await browser.newContext({viewport:{width:390,height:844}});const errors=[];context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
try{
 const openRules=async(page,native=false)=>{
  await page.getByRole(native?'radio':'button',{name:native?'Inventory section: Material costs':'Material costs',exact:true}).click();
  if(!(await page.getByText('Contract approvals & organization rules',{exact:true}).isVisible()))
   await page.getByText(native?'Show organization rules and contracts':'Organization rules & contracts',{exact:true}).click();
  await page.getByText('Contract approvals & organization rules',{exact:true}).waitFor();
 };
 const web=await context.newPage();await web.goto(origin+'/?actor=admin');await openRules(web);
 assert.match(await web.locator('body').innerText(),/5% annual capital carrying/);
 assert.match(await web.locator('body').innerText(),/Likely split purchases/);
 await web.getByText('Organization defaults',{exact:true}).click();
 await web.getByLabel('Annual carrying rate (fraction per year: 0.05 = 5%)',{exact:true}).fill('0.06');
 await web.getByLabel('Policy change evidence',{exact:true}).fill('Synthetic current-account policy change');
 await web.getByRole('button',{name:'Save organization defaults online',exact:true}).click();
 await web.getByText(/6% annual capital carrying/).waitFor({state:'attached'});
 await openRules(web);
 await web.getByText(/6% annual capital carrying/).waitFor();
 const pm=await context.newPage();await pm.goto(origin+'/?actor=pm');await openRules(pm);
 assert.equal(await pm.getByText('Organization defaults',{exact:true}).count(),0);
 assert.equal(await pm.getByText('Project cost viewing access',{exact:true}).count(),0);
 const native=await context.newPage();await native.goto(origin+'/?platform=native&actor=pm');await openRules(native,true);
 await native.getByText(/6% annual capital carrying/).waitFor();
 await native.getByRole('radio',{name:'Inventory section: Requests & approvals',exact:true}).click();
 await native.getByRole('button',{name:'Authorize & post release',exact:true}).click();
 await native.getByText(/Awaiting Supply Chain approval/).waitFor();
 assert.equal(request.state,'awaiting_supply_chain');
 const sc=await context.newPage();await sc.goto(origin+'/?platform=native&actor=sc');
 await sc.getByRole('radio',{name:'Inventory section: Requests & approvals',exact:true}).click();
 await sc.getByRole('button',{name:'Supply Chain authorize & post release',exact:true}).click();
 await sc.getByText(/Approved for release/).waitFor();
 await web.getByRole('button',{name:'Requests & approvals',exact:true}).click();
 await web.getByRole('button',{name:'Refresh',exact:true}).click();
 await web.getByText(/Approved for release/).waitFor();
 for(const platform of ['web','native']){
  const f=await context.newPage();await f.goto(origin+'/?actor=foreman&platform='+platform);
  await f.getByText('Stock by lot',{exact:true}).waitFor();
  assert.equal(await f.getByRole(platform==='native'?'radio':'button',{name:platform==='native'?'Inventory section: Material costs':'Material costs',exact:true}).count(),0);
  const body=await f.locator('body').innerText();
  assert.doesNotMatch(body,/USD|50000|60000|annual_rate|558.90|670.68|Likely split|Synthetic current-account policy change|Supply Chain authorize/);
  assert.equal(await f.getByRole('button',{name:'Supply Chain authorize & post release'}).count(),0);
  const raw=await f.evaluate(async()=>{const t=window.testRules,db=await t.openOfflineDatabase(t.userId);return new Promise((resolve,reject)=>{const tx=db.transaction(['records','drafts'],'readonly');const results=[];for(const n of ['records','drafts']){const q=tx.objectStore(n).getAll();q.onsuccess=()=>results.push(...q.result);}tx.oncomplete=()=>resolve(JSON.stringify(results));tx.onerror=()=>reject(tx.error);});});
  assert.doesNotMatch(raw,/50000|60000|Synthetic current-account policy change|annual_rate|Likely split/);
 }
 await context.setOffline(true);
 await native.getByRole('radio',{name:'Inventory section: Material costs',exact:true}).waitFor({state:'hidden'});
 await context.setOffline(false);
 await native.getByRole('radio',{name:'Inventory section: Material costs',exact:true}).waitFor();
 assert.equal(commands.filter(x=>x.c.action==='policy').length,1);
 assert.deepEqual(commands.filter(x=>['authorize','supply_chain'].includes(x.c.action)).map(x=>x.actor),['pm','sc']);
 assert.deepEqual(errors,[]);
 console.log('PASS actual current web/native React screens through explicit browser-native adapters: organization policy edit/readback, split warning, distinct PM then Supply Chain release, native-to-web visibility, field DOM/raw IndexedDB finance omission and offline cost controls. Transport and native sharing are synthetic; DB and physical acceptance remain separate.');

}finally{await context.close();await browser.close();await new Promise(r=>server.close(r));rmSync(dir,{recursive:true,force:true});}
