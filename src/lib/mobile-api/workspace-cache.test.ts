import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe,it } from 'mocha';
type WorkerEvent={request?:{url:string;method:string;mode:string};respondWith?:(response:Promise<unknown>)=>void;waitUntil?:(promise:unknown)=>void};
describe('workspace public cache boundary',()=>{
 function worker(fail=false){
  const events:Record<string,(event:WorkerEvent)=>void>={};const puts:string[]=[];const removed:string[]=[];
  runInNewContext(readFileSync(new URL('../../../public/sw.js',import.meta.url),'utf8'),{URL,Set,Promise,self:{location:{origin:'https://railcommand.io'},addEventListener:(type:string,fn:(event:WorkerEvent)=>void)=>{events[type]=fn;},skipWaiting:()=>{},clients:{claim:()=>{}}},fetch:async()=>{if(fail)throw new Error('offline');return {ok:true,type:'basic',clone:()=>({})};},caches:{keys:async()=>['railcommand-v2','unrelated-app'],delete:async(key:string)=>{removed.push(key);},match:async(key:unknown)=>key==='/offline.html'?'neutral offline page':undefined,open:async()=>({put:async(req:{url:string})=>{puts.push(req.url);},addAll:async(paths:string[])=>{assert.ok(!paths.includes('/dashboard'));}})}});
  return {events,puts,removed};
 }
 it('does not intercept or cache private API, auth, project/RSC or signed storage reads',()=>{
  const h=worker();
  for(const url of ['https://railcommand.io/api/mobile/v1/bootstrap','https://railcommand.io/projects/a?_rsc=private','https://railcommand.io/auth/mobile-session','https://db.supabase.co/storage/v1/object/sign/private?token=secret']){
   let intercepted=false;h.events.fetch({request:{url,method:'GET',mode:'cors'},respondWith:()=>{intercepted=true;}});assert.equal(intercepted,false,url);
  }assert.equal(h.puts.length,0);
 });
 it('returns only the neutral page when authenticated navigation fails offline',async()=>{
  const h=worker(true);let result:unknown;
  h.events.fetch({request:{url:'https://railcommand.io/projects/private',method:'GET',mode:'navigate'},respondWith:(value:Promise<unknown>)=>{result=value;}});
  assert.equal(await result,'neutral offline page');assert.equal(h.puts.length,0);
 });
 it('removes legacy RailCommand caches without deleting other applications caches',async()=>{
  const h=worker();let pending:unknown;h.events.activate({waitUntil:(value:unknown)=>{pending=value;}});await pending;assert.deepEqual(h.removed,['railcommand-v2']);
 });
});
