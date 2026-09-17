import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, it } from 'mocha';
import ts from 'typescript';
import * as paths from '../attachments-shared';

type Row=Record<string,unknown>;
function harness(options:{denied?:boolean; wrongScope?:boolean; noDelete?:boolean; signFailure?:boolean}={}) {
  const photo={id:'photo',project_id:'project',entity_id:'log',entity_type:'daily_log',uploaded_by:'owner',file_type:'image/jpeg',photo_category:'standard',file_url:'https://db.test/storage/v1/object/public/project-photos/project/daily_log/log/photo.jpg'};
  let deleted=false; let storageDeletes=0;
  const filters:Record<string,unknown>={};
  const query={select:()=>query,eq:(k:string,v:unknown)=>{filters[k]=v;return query;},
    maybeSingle:async()=>({data:options.wrongScope?null:photo,error:null}),
    order:async()=>({data:[{...photo},{...photo,id:'other',file_url:photo.file_url.replace('photo.jpg','other.jpg')}],error:null}),
    delete:()=>{deleted=true;return query;},
    then:(resolve:(value:{data:Row[];error:null})=>unknown)=>Promise.resolve({data:options.noDelete?[]:[{id:'photo'}],error:null}).then(resolve),
  };
  const db={from:()=>query,storage:{from:()=>({remove:async()=>{storageDeletes++;throw new Error('Must not delete stored bytes');},createSignedUrls:async()=>options.signFailure?{error:{message:'disconnected'},data:null}:{error:null,data:[{path:'project/daily_log/log/other.jpg',signedUrl:'https://signed.test/other'},{path:'project/daily_log/log/photo.jpg',signedUrl:'https://signed.test/photo'}]}})}};
  const exports={} as typeof import('../actions/attachments');
  const deps:Record<string,unknown>={'@/lib/supabase/server':{createClient:async()=>db},'next/cache':{revalidatePath:()=>{}},'./permissions-helper':{getAuthenticatedUser:async()=>({user:{id:'owner'}}),checkPermission:async()=>({allowed:!options.denied,error:options.denied?'Permission denied':undefined})},'@/lib/attachments-shared':paths,'@/lib/permissions':{ACTIONS:{DAILY_LOG_UPDATE:'update',PHOTO_DELETE:'delete'}}};
  runInNewContext(ts.transpileModule(readFileSync(new URL('../actions/attachments.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:(name:string)=>deps[name]});
  return {actions:exports,filters,deleted:()=>deleted,storageDeletes:()=>storageDeletes};
}
describe('DFR saved photo management',()=>{
  it('removes only the exact DFR attachment without deleting its stored bytes',async()=>{
    const h=harness();assert.equal((await h.actions.removeDailyLogPhoto('photo','project','log')).success,true);
    assert.deepEqual(h.filters,{id:'photo',project_id:'project',entity_type:'daily_log',entity_id:'log'});assert.equal(h.storageDeletes(),0);assert.equal(h.deleted(),true);
  });
  it('rechecks permissions and refuses another report scope',async()=>{
    for(const options of [{denied:true},{wrongScope:true}]){const h=harness(options);assert.ok((await h.actions.removeDailyLogPhoto('photo','project','log')).error);assert.equal(h.deleted(),false);assert.equal(h.storageDeletes(),0);}
  });
  it('does not report success when RLS removes zero rows',async()=>{
    const h=harness({noDelete:true});assert.ok((await h.actions.removeDailyLogPhoto('photo','project','log')).error);assert.equal(h.storageDeletes(),0);
  });
  it('keeps every attachment visible when preview signing fails',async()=>{
    const h=harness({signFailure:true});const result=await h.actions.getAttachmentsWithSignedUrls('daily_log','log');
    assert.equal(result.success,true);assert.equal(result.data?.length,2);assert.ok(result.data?.every(p=>p.signed_url_error && !p.signed_url));
  });
  it('matches signed previews by object path, independent of returned order',async()=>{
    const result=await harness().actions.getAttachmentsWithSignedUrls('daily_log','log');
    assert.equal(result.data?.[0].signed_url,'https://signed.test/photo');assert.equal(result.data?.[1].signed_url,'https://signed.test/other');
  });
});
