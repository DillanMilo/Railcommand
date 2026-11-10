// Actual web/native receiving components in a disposable browser with synthetic
// props; adapters model React Native controls, not physical-device acceptance.
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const root=process.cwd(),dir=mkdtempSync(join(tmpdir(),'rc-receiving-'));
const native=`import React from 'react';const style=s=>Array.isArray(s)?Object.assign({},...s):s;export const View=({children,style:s})=><div style={style(s)}>{children}</div>;export const Text=({children})=><span>{children}</span>;export const TextInput=({accessibilityLabel,value,onChangeText,editable})=><input aria-label={accessibilityLabel} value={value} disabled={editable===false} onChange={e=>onChangeText(e.target.value)}/>;export const Pressable=({children,onPress,disabled,accessibilityRole,accessibilityLabel,accessibilityState})=><button role={accessibilityRole} aria-label={accessibilityLabel} aria-checked={accessibilityState?.checked} disabled={disabled} onClick={onPress}>{children}</button>;`;
const ui=`import React from 'react';export const Card=({children})=><section>{children}</section>;export const SectionTitle=({children})=><h2>{children}</h2>;export const SecondaryButton=({title,onPress,disabled})=><button disabled={disabled} onClick={onPress}>{title}</button>;export const uiStyles={muted:{},input:{}};`;
const harness=`import React from 'react';import{createRoot}from'react-dom/client';import{InventorySetup as Web}from'${root}/src/app/(app)/projects/[id]/inventory/InventorySetup';import{InventorySetup as Native}from'${root}/apps/mobile/src/components/inventory-setup';
const s={canManage:true,canReceive:true,catalogue:[{id:'fuel',code:'DIESEL-US',name:'Synthetic diesel',unit:'us_gallon',category:'fuel'}],assignments:null,actors:[]};function App(){const[disabled,setDisabled]=React.useState(false),[calls,setCalls]=React.useState([]);const C=location.search.includes('native')?Native:Web;return <><button onClick={()=>setDisabled(x=>!x)}>Toggle offline</button><output aria-label="Command count">{calls.length}</output><pre aria-label="Last command">{JSON.stringify(calls.at(-1)??{})}</pre><C snapshot={s} view="stock" disabled={disabled} onClose={()=>{}} act={c=>setCalls(v=>[...v,c])}/></>;}createRoot(document.getElementById('root')).render(<App/>);`;
await build({stdin:{contents:harness,loader:'tsx',resolveDir:root,sourcefile:'receiving.tsx'},bundle:true,platform:'browser',format:'iife',outfile:join(dir,'ui.js'),jsx:'automatic',tsconfig:join(root,'tsconfig.json'),alias:{react:root+'/node_modules/react','react-dom':root+'/node_modules/react-dom'},plugins:[{name:'native-adapters',setup(b){b.onResolve({filter:/^(react-native|@\/theme|.*\/ui)$/},a=>({path:a.path,namespace:'native'}));b.onLoad({filter:/.*/,namespace:'native'},a=>({contents:a.path==='react-native'?native:a.path==='@/theme'?'export const colors={};':ui,loader:'tsx',resolveDir:root}));}}],logLevel:'silent'});
const server=createServer((req,res)=>{res.setHeader('content-type',req.url.startsWith('/ui.js')?'text/javascript':'text/html');res.end(req.url.startsWith('/ui.js')?readFileSync(join(dir,'ui.js')):'<!doctype html><meta name="viewport" content="width=device-width"><div id="root"></div><script src="/ui.js"></script>');});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
try{
 for(const platform of ['web','native']){
  const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port+'/?'+platform);
  if(platform==='web')await page.getByRole('combobox',{name:'Approved material',exact:true}).selectOption('fuel');
  else await page.getByRole('radio',{name:'Approved material: DIESEL-US · Synthetic diesel · US gal'}).click();
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.getByLabel('Quantity (US gal)',{exact:true}).fill('250.125');await page.getByLabel('Yard or storage location',{exact:true}).fill('Synthetic tank');
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.getByLabel('Receipt / inspection reference',{exact:true}).fill('RECEIPT-1');
  if(platform==='web')await page.getByRole('checkbox',{name:'Inspection accepted'}).check();else await page.getByRole('radio',{name:'Inspection accepted: Yes, inspection accepted'}).click();
  await page.getByRole('button',{name:'Back',exact:true}).click();await page.getByRole('button',{name:'Continue',exact:true}).click();
  assert.equal(await page.getByLabel('Command count').textContent(),'0','Continue/Back must never receive stock');
  assert.equal(await page.getByLabel('Receipt / inspection reference',{exact:true}).inputValue(),'RECEIPT-1');
  await page.getByRole('button',{name:'Toggle offline'}).click();assert.equal(await page.getByRole('button',{name:'Receive stock online'}).isEnabled(),false);
  assert.equal(await page.getByLabel('Receipt / inspection reference',{exact:true}).inputValue(),'RECEIPT-1');
  await page.getByRole('button',{name:'Toggle offline'}).click();await page.getByRole('button',{name:'Receive stock online'}).click();
  assert.equal(await page.getByLabel('Command count').textContent(),'1');const c=JSON.parse(await page.getByLabel('Last command').textContent());assert.equal(c.quantity,250.125);assert.equal(c.materialId,'fuel');assert.equal(c.inspectionAccepted,true);assert.equal(c.material,undefined);assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS actual web/native receiving: three steps, fixed US gallon quantity, Back/Continue never save, offline disables writes/preserves input, explicit receive sends one approved-material command.');
} finally{await browser.close();await new Promise(r=>server.close(r));rmSync(dir,{recursive:true,force:true});}
