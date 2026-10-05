import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe,it } from 'mocha';
import ts from 'typescript';
const log={id:'log',project_id:'project',created_by:'owner',log_date:'2026-09-17',weather_temp:75,weather_conditions:'Clear',weather_wind:'',work_summary:'Original',safety_notes:'',geo_tag:null,personnel:[],equipment:[],work_items:[]};
type EditArgs={p_expected:typeof log; p_payload:typeof log};
type EditResult={success?:boolean;error?:string};
function harness(code?:string){
 const calls:Array<{name:string;args:EditArgs}>=[];let activity=0;
 const query={select:()=>query,eq:()=>query,single:async()=>({data:log,error:null})};
 const db={from:()=>query,rpc:async(name:string,args:EditArgs)=>{calls.push({name,args});return {data:{id:'log',project_id:'project'},error:code?{code}:null};}};
 const deps:Record<string,unknown>={'next/cache':{revalidatePath:()=>{}},'@/lib/supabase/server':{createClient:async()=>db},'@/lib/permissions':{ACTIONS:{}},'./permissions-helper':{getAuthenticatedUser:async()=>({user:{id:'owner'}}),checkPermission:async()=>({allowed:true}),logActivity:async()=>{activity++;}}};
 const exports={} as {updateDailyLog:(project:string,id:string,input:typeof log & {expected?:typeof log})=>Promise<EditResult>};runInNewContext(ts.transpileModule(readFileSync(new URL('../actions/daily-logs.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:(name:string)=>deps[name],crypto});
 return {update:exports.updateDailyLog,calls,activity:()=>activity};
}
describe('atomic daily-log edit adapter',()=>{
 it('passes the originally loaded baseline and all edited rows in one RPC',async()=>{const h=harness();const result=await h.update('project','log',{...log,work_summary:'Edited',expected:log});assert.equal(result.success,true);assert.equal(h.calls.length,1);assert.equal(h.calls[0].name,'update_daily_log_checked');assert.equal(h.calls[0].args.p_expected.work_summary,'Original');assert.equal(h.calls[0].args.p_payload.work_summary,'Edited');});
 it('fails safely for older forms without a baseline',async()=>{const h=harness();assert.match((await h.update('project','log',log)).error!,/Reload/);assert.equal(h.calls.length,0);});
 it('reports stale edits without acknowledging a save or creating activity',async()=>{const h=harness('40001');assert.match((await h.update('project','log',{...log,expected:log})).error!,/Nothing was overwritten/);assert.equal(h.activity(),0);});
 it('does not acknowledge a failed child transaction',async()=>{const h=harness('22P02');assert.match((await h.update('project','log',{...log,expected:log})).error!,/entries are still here/);assert.equal(h.activity(),0);});
});
