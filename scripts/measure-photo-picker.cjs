/* eslint-disable @typescript-eslint/no-require-imports */
// Synthetic comparison of the actual legacy action and existing paginated reader.
// Measures work and JSON bytes, not production latency. No network or private records.
const {build}=require('esbuild');
const {createClient}=require('@supabase/supabase-js');
const assert=require('node:assert/strict');
(async()=>{
 const compiled=await build({stdin:{contents:`export {getProjectPhotos} from './src/lib/actions/photos'; export {getProjectPhotoPage} from './src/lib/project-photo-page-server';`,resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'cjs',packages:'external',plugins:[{name:'synthetic-client',setup(b){b.onResolve({filter:/^@\/lib\/supabase\/server$/},()=>({path:'client',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export const createClient=async()=>globalThis.fixtureClient;'}));}}]});
 const mod={exports:{}};new Function('require','module','exports',compiled.outputFiles[0].text)(require,mod,mod.exports);
 const project='10000000-0000-4000-8000-000000000001';
 const rows=Array.from({length:1000},(_,i)=>({id:`30000000-0000-4000-8000-${String(1000-i).padStart(12,'0')}`,project_id:project,entity_id:project,entity_type:'project_photo',file_name:`Photo ${i}.jpg`,file_url:`https://fixture.invalid/storage/v1/object/public/project-photos/${project}/${i}.jpg`,file_type:'image/jpeg',file_size:1000000,photo_category:'standard',created_at:'2026-10-20T12:00:00Z',caption:`Caption ${i}`}));
 for(const mode of ['legacy','progressive']){
  let reads=0,signed=0;
  const client=createClient('https://fixture.invalid','synthetic',{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async(input,init)=>{
   const req=new Request(input,init),url=new URL(req.url);reads++;
   if(url.pathname.endsWith('/project_members'))return Response.json({project_role:'foreman'});
   if(url.pathname.endsWith('/attachments'))return Response.json(rows.slice(0,Number(url.searchParams.get('limit'))));
   if(url.pathname.includes('/storage/')){const {paths}=await req.json();signed+=paths.length;return Response.json(paths.map(path=>({path,signedURL:`/object/sign/project-photos/${path}?token=synthetic`,error:null})));}
   return Response.json([]);
  }}});
  client.auth.getUser=async()=>({data:{user:{id:'fixture-user'}},error:null});globalThis.fixtureClient=client;
  const value=mode==='legacy'?await mod.exports.getProjectPhotos(project):(await mod.exports.getProjectPhotoPage(client,project,{category:'all',cursor:null})).page;
  assert.ok(value.data);assert.equal(value.data.length,mode==='legacy'?1000:12);
  console.log(JSON.stringify({mode,backendRequests:reads,signedPaths:signed,rows:value.data.length,responseBytes:Buffer.byteLength(JSON.stringify(mode==='legacy'?{data:value.data}:value))}));
 }
 delete globalThis.fixtureClient;
})().catch(e=>{console.error(e);process.exitCode=1;});
