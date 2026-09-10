import { readFileSync } from 'node:fs';
const base = new URL('../supabase/recovery/', import.meta.url);
const read = name => readFileSync(new URL(name, base), 'utf8');
const refs = JSON.parse(read('staging-guard-reference-20260909.json'));
const rpcRefs = JSON.parse(read('staging-function-reference-20260909.json'));
const path = refs.definitions.find(x => x.name === 'project_from_path');
if (!path || path.security_definer) throw new Error('Invoker path guard required');
const policy = readFileSync(new URL('../supabase/migrations/20260824185152_mobile_daily_log_photo_storage_policies.sql', import.meta.url), 'utf8');
let fixture = read('local-photo-policy-smoke.sql');
const migrationMode=process.argv.includes('--migration');
if (process.argv.includes('--staging-table-rls') || migrationMode) {
 const policies=JSON.parse(read('staging-sync-policy-reference-20260909.json')).policies
  .filter(p=>!['profiles','project_members'].includes(p.tablename)||p.cmd==='SELECT');
 const quote=s=>'"'+s.replaceAll('"','""')+'"';
 const ddl=[...new Set(policies.map(p=>p.tablename))].map(t=>`alter table public.${quote(t)} enable row level security;`).join('\n')+'\n'+policies.map(p=>
  `create policy ${quote(p.policyname)} on public.${quote(p.tablename)} as ${p.permissive} for ${p.cmd} to authenticated${p.qual?' using ('+p.qual+')':''}${p.with_check?' with check ('+p.with_check+')':''};`).join('\n');
 // Earlier trigger-only note-edit test deliberately has no table RLS. The actual
 // staging attachments table has no permissive UPDATE policy. Run RPC test here.
 const first=fixture.indexOf('do $$');
 const second=fixture.indexOf('do $$',first+5);
 fixture=fixture.slice(0,first)+fixture.slice(second);
 fixture=fixture.replace('set local role authenticated;',()=>read('local-staging-access-helpers.sql')+'\n'+ddl+'\nset local role authenticated;');
}
if(migrationMode) {
 const quote=s=>'"'+s.replaceAll('"','""')+'"';
 const storagePolicies=JSON.parse(read('staging-table-policy-reference-20260909.json')).schema.policies
  .filter(p=>p.schemaname==='storage'&&p.policyname.startsWith('rc_project_object_'));
 const ddl=storagePolicies.map(p=>`create policy ${quote(p.policyname)} on storage.objects as RESTRICTIVE for ${p.cmd} to authenticated${p.qual?' using ('+p.qual+')':''}${p.with_check?' with check ('+p.with_check+')':''};`).join('\n');
 fixture=fixture.replace('create role authenticated nologin;','create role authenticated nologin;\ncreate role anon nologin;');
 const start=fixture.indexOf('create policy candidate_write');
 const end=fixture.indexOf('insert into public.profiles',start);
 fixture=fixture.slice(0,start)+ddl+'\n'+fixture.slice(end);
 const migration=readFileSync(new URL('../supabase/migrations/20260909204413_staging_admin_photo_compatibility.sql',import.meta.url),'utf8');
 fixture=fixture.replace('set local role authenticated;',()=>"select set_config('railcommand.target_project','rxuvchdqbzvovqijvfhx',true);\n"+migration+'\nset local role authenticated;');
}
process.stdout.write(fixture
 .replace('-- FUNCTIONS', () => migrationMode ? refs.definitions.map(x=>x.definition+';').join('\n') : path.definition+';\n'+read('admin-daily-log-candidate.sql')+'\n'+refs.definitions.filter(x=>['can_write_object','is_project_member','assert_stored_object','check_daily_log_attachment'].includes(x.name)).map(x=>x.definition+';').join('\n')+'\n'+read('admin-photo-write-candidate.sql')+'\n'+read('admin-photo-read-candidate.sql'))
 .replace('-- RPC_FUNCTIONS', () => rpcRefs.definitions.filter(x=>x.name.startsWith('sync_daily_log')).map(x=>x.definition+';').join('\n'))
 .replace('-- BASELINE_POLICIES', () => policy));
