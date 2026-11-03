/* eslint-disable @typescript-eslint/no-require-imports */
// Real picker/hook with synthetic account/API boundaries; no live records or writes.
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const {build}=require('esbuild');
const {chromium,webkit}=require('playwright');
const A='10000000-0000-4000-8000-000000000001',B='10000000-0000-4000-8000-000000000002';
(async()=>{
 const compiled=await build({stdin:{contents:`import React,{useState} from 'react';import{createRoot}from'react-dom/client';import Picker from './src/components/daily-logs/PhotoLibraryPicker';import{FixtureProvider}from'@/components/providers/ProjectProvider';
 function App(){const[session,setSession]=useState({isDemo:false,currentUserId:'one',projectId:'${A}'});const[offline,setOffline]=useState(false);const[photos,setPhotos]=useState([]);window.session=(projectId,user='one')=>setSession({isDemo:false,currentUserId:user,projectId});window.offline=setOffline;window.photos=photos;window.addCamera=()=>setPhotos(p=>[...p,{id:'camera',caption:'camera draft',file:new File(['camera'],'camera.jpg'),preview:'/pixel'}]);return <FixtureProvider.Provider value={session}><Picker projectId={session.projectId} logDate="2026-10-20" photos={photos} onPhotosChange={setPhotos} isOffline={offline}/><output>{photos.map(p=>p.caption).join(',')}</output></FixtureProvider.Provider>};createRoot(document.getElementById('root')).render(<App/>);`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'browser',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'session',setup(b){b.onResolve({filter:/^@\/components\/providers\/ProjectProvider$/},()=>({path:'session',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({resolveDir:process.cwd(),contents:"import{createContext,useContext}from'react';export const FixtureProvider=createContext({});export const useProject=()=>useContext(FixtureProvider);"}));}}]});
 const cssDir=path.join(process.cwd(),'.next/static/css');
 const css=fs.readdirSync(cssDir).filter(n=>n.endsWith('.css')).map(n=>fs.readFileSync(path.join(cssDir,n),'utf8')).join('\n');
 const server=http.createServer((req,res)=>{if(req.url==='/app.js'){res.setHeader('Content-Type','text/javascript');res.end(compiled.outputFiles[0].contents);}else if(req.url==='/app.css'){res.setHeader('Content-Type','text/css');res.end(css);}else {res.setHeader('Content-Type','text/html');res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"><div id="root"></div><script src="/app.js"></script>');}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{for(const [engine,width] of [[chromium,1280],[webkit,390]]){
 const browser=await engine.launch({headless:true});try{
 const context=await browser.newContext({viewport:{width,height:844}});const page=await context.newPage();let failure=0,held=null,hold=false,downloadFailure=false;const calls=[];const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/workspace/**',async route=>{
  const url=new URL(route.request().url());assert.equal(url.searchParams.get('page'),'cursor');calls.push(url);
  if(hold){hold=false;await new Promise(r=>held=r);}
  if(failure){const status=failure;failure=0;return route.fulfill({status,json:{error:'Synthetic read failed'}});}
  const offset=url.searchParams.has('cursor')?12:0;
  const project=url.pathname.includes(B)?'B':'A';
  const data=Array.from({length:12},(_,i)=>({id:`30000000-0000-4000-8000-${String(offset+i+1).padStart(12,'0')}`,file_name:`${project}-${offset+i}.jpg`,caption:`${project} caption ${offset+i}`,file_url:'/pixel',signed_url:'/pixel',file_type:'image/jpeg',file_size:100,photo_category:'standard',created_at:'2026-10-20T12:00:00Z',captured_at:null}));
  await route.fulfill({json:{data,nextCursor:offset?null:{createdAt:'2026-10-20T12:00:00Z',id:data.at(-1).id}}});
 });
 await page.route('**/pixel',route=>{if(downloadFailure&&route.request().resourceType()==='fetch'){downloadFailure=false;return route.fulfill({status:503,body:'Synthetic interrupted download'});}return route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=','base64')});});
 await page.goto(`http://127.0.0.1:${server.address().port}`);
 await page.getByRole('button',{name:'A caption 0',exact:false}).first().waitFor();
 assert.equal(calls.length,1,'initial load must not drain all pages');assert.equal(await page.getByRole('img').count(),12);
 await page.getByRole('button',{name:/A caption 0/}).first().click();
 failure=503;await page.getByRole('button',{name:'Load more photos',exact:true}).click();await page.getByRole('alert').waitFor();
 assert.equal(await page.getByRole('button',{name:/A caption 0/}).first().getAttribute('aria-pressed'),'true');
 hold=true;await page.getByRole('button',{name:'Retry loading photos'}).click();
 for(let n=0;!held&&n<500;n++)await new Promise(r=>setTimeout(r,10));assert.ok(held);
 await page.evaluate(()=>window.offline(true));await page.getByText(/Photo-library selection needs/).waitFor();held();
 await page.evaluate(()=>window.offline(false));await page.getByRole('button',{name:/A caption 12/}).waitFor();assert.equal(await page.getByRole('img').count(),24);
 await page.getByRole('button',{name:/A caption 12/}).click();
 await page.evaluate(()=>window.offline(true));await page.getByText(/Photo-library selection needs/).waitFor();
 const before=calls.length;await page.evaluate(()=>window.offline(false));await page.getByRole('button',{name:/Add 2 selected photos/}).waitFor();assert.equal(calls.length,before,'reconnect must not fetch an extra page');
 // Concurrent camera input survives asynchronous library downloads.
 await page.evaluate(()=>window.addCamera());downloadFailure=true;await page.getByRole('button',{name:/Add 2 selected photos/}).click();await page.getByText(/Could not download/).waitFor();assert.equal(await page.evaluate(()=>window.photos.length),1,'failed download leaves parent input intact');await page.getByRole('button',{name:/Add 2 selected photos/}).click();await page.waitForFunction(()=>window.photos.length===3);
 assert.deepEqual(await page.evaluate(()=>window.photos.map(p=>p.caption)),['camera draft','A caption 0','A caption 12']);
 assert.equal(await page.getByRole('button',{name:/A caption 0/}).count(),0,'added source photos excluded');
 // Account/project change cannot receive an old delayed response.
 hold=true;held=null;await page.evaluate(id=>window.session(id),B);await page.waitForFunction(()=>document.body.textContent.includes('Loading recent'));
 for(let n=0;!held&&n<500;n++)await new Promise(r=>setTimeout(r,10));assert.ok(held,'delayed request arrived');
 await page.evaluate(id=>window.session(id,'two'),A);await page.getByRole('button',{name:/A caption 1/}).first().waitFor();held();
 await page.waitForTimeout(100);assert.equal(await page.getByRole('img',{name:/B caption/}).count(),0);
 assert.deepEqual(await page.evaluate(()=>window.photos.map(p=>p.caption)),['camera draft','A caption 0','A caption 12']);
 const layout=await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));assert.ok(layout.scroll<=layout.width+1,'no horizontal overflow');
 if(process.env.RAILCOMMAND_E2E_SCREENSHOT_DIR){fs.mkdirSync(process.env.RAILCOMMAND_E2E_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.RAILCOMMAND_E2E_SCREENSHOT_DIR,`picker-${width}.png`),fullPage:true});}
 assert.deepEqual(errors,[]);console.log(`${engine.name()} ${width}px: progressive reads, cross-page selections, retry, reconnect, captions, concurrent camera input and stale-account responses passed`);
 await context.close();
 }finally{await browser.close();}}
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
