import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, it } from 'mocha';
import ts from 'typescript';
import * as paths from '../attachments-shared';
function load(file: string, deps: Record<string, unknown>) {
  const exports: Record<string, any> = {};
  runInNewContext(ts.transpileModule(readFileSync(new URL(file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,crypto,console,Date,require:(name:string)=>{if(!(name in deps))throw new Error(name);return deps[name];}});
  return exports;
}
const id='10000000-0000-4000-8000-000000000001';
const input={clientId:id,projectId:'project',entityId:'log',entityType:'daily_log',storagePath:'project/daily_log/log/file.jpg',bucket:'project-photos',fileName:'file.jpg',fileType:'image/jpeg',fileSize:5,photoCategory:'standard'};
function metadataHarness(options:{existing?:Record<string,unknown>; ambiguous?:boolean; forbidden?:boolean}={}) {
  let row=options.existing; let inserts=0; let removals=0;
  const db={storage:{from:()=>({getPublicUrl:(path:string)=>({data:{publicUrl:'https://storage.test/'+path}}),remove:()=>{removals++;throw new Error('Unexpected storage delete');}})},from:()=>{
    let inserted=false; let value:Record<string,unknown>={};
    const q={select:()=>q,eq:()=>q,insert:(data:Record<string,unknown>)=>{inserts++;inserted=true;value=data;return q;},maybeSingle:async()=>({data:options.forbidden?null:row??null,error:null}),single:async()=>{
      assert.ok(inserted);
      if(row)return {data:null,error:{code:'23505',message:'Duplicate receipt'}};
      if(options.forbidden)return {data:null,error:{code:'42501',message:'Permission denied'}};
      row=value; return options.ambiguous?{data:null,error:{code:'504',message:'Response lost'}}:{data:row,error:null};
    }};return q;
  }};
  const action=load('../actions/attachments.ts',{'@/lib/supabase/server':{createClient:async()=>db},'next/cache':{revalidatePath:()=>{}},'./permissions-helper':{getAuthenticatedUser:async()=>({user:{id:'owner'}})},'@/lib/attachments-shared':paths,'@/lib/permissions':{ACTIONS:{}}}).recordAttachment;
  return {action,counts:()=>({inserts,removals}),row:()=>row};
}
describe('attachment receipt recovery',()=>{
  it('reconciles a committed insert after a lost response without deleting uploaded bytes',async()=>{
    const h=metadataHarness({ambiguous:true}); const first=await h.action(input); assert.equal(first.success,true);
    const again=await h.action(input); assert.equal(again.success,true); assert.deepEqual(h.counts(),{inserts:1,removals:0}); assert.equal(h.row()?.id,id);
  });
  it('cannot adopt or overwrite another owner/project receipt',async()=>{
    for(const different of [{uploaded_by:'other'},{project_id:'other'},{entity_id:'other'},{file_url:'https://other.test/file'}]) {
      const row={id,uploaded_by:'owner',project_id:'project',entity_id:'log',entity_type:'daily_log',file_url:'https://storage.test/'+input.storagePath,file_size:5,file_type:'image/jpeg',...different};
      const h=metadataHarness({existing:row}); assert.ok((await h.action(input)).error);assert.equal(h.counts().removals,0);assert.deepEqual(h.row(),row);
    }
  });
  it('rejects mismatched paths/buckets and preserves bytes after a denied receipt',async()=>{
    for(const patch of [{storagePath:'other/daily_log/log/file.jpg'},{bucket:'project-documents'},{clientId:'invalid'}]) { const h=metadataHarness();assert.ok((await h.action({...input,...patch})).error);assert.equal(h.counts().inserts,0); }
    const denied=metadataHarness({forbidden:true});assert.ok((await denied.action(input)).error);assert.equal(denied.counts().removals,0);
  });
});
function clientHarness() {
  let owner='owner';let loseReceipt=true;let compressions=0;let uploaded=false;
  const uploads:string[]=[];const receipts:Record<string,unknown>[]=[];const stored=new Map<string,Record<string,unknown>>();
  const db={auth:{getUser:async()=>({data:{user:{id:owner}},error:null})},storage:{from:()=>({upload:async(path:string)=>{uploads.push(path);const duplicate=uploaded;uploaded=true;return {error:duplicate?{message:'The resource already exists',statusCode:'409'}:null};}})}};
  const fn=load('../attachment-upload-retry.ts',{'@/lib/actions/attachments':{recordAttachment:async(record:Record<string,unknown>)=>{receipts.push(record);stored.set(String(record.clientId),record);if(loseReceipt){loseReceipt=false;return {error:'Response lost; receipt uncertain'};}return {success:true,data:stored.get(String(record.clientId))};}},'@/lib/supabase/client':{createClient:()=>db},'@/lib/attachments-shared':paths,'@/lib/compressImage':{compressImage:async(file:File)=>{compressions++;return new File([file],'compressed.jpg',{type:'image/jpeg'});}}}).uploadFileWithReceipt;
  return {fn,uploads,receipts,stored,compressions:()=>compressions,setOwner:(value:string)=>{owner=value;}};
}
describe('page-lifetime upload identity',()=>{
  it('retries the same object and metadata identity after an uncertain response, including compressed-file reuse',async()=>{
    const h=clientHarness(); const values={file:new File(['hello'],'original.jpg',{type:'image/jpeg'}),category:'standard',projectId:'project',entityType:'daily_log',entityId:'log'};
    assert.ok((await h.fn(values)).error); const accepted=await h.fn(values);assert.equal(accepted.success,true);
    assert.equal(h.uploads[0],h.uploads[1]);assert.equal(h.receipts[0].clientId,h.receipts[1].clientId);assert.equal(h.stored.size,1);assert.equal(h.compressions(),1);
    assert.equal((await h.fn({...values,file:accepted.data.file})).success,true);assert.equal(h.stored.size,1);assert.equal(h.compressions(),1);
  });
  it('partitions a selected file by user and parent rather than reusing another scope receipt',async()=>{
    const h=clientHarness();const values={file:new File(['hello'],'original.pdf',{type:'application/pdf'}),category:'document',projectId:'project',entityType:'daily_log',entityId:'log'};
    await h.fn(values);await h.fn({...values,entityId:'second-log'});h.setOwner('other');await h.fn(values);
    assert.equal(new Set(h.receipts.map(row=>row.clientId)).size,3);assert.equal(new Set(h.uploads).size,3);
  });
});
