import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const QA_A_EMAIL = 'railcommand-mobile-owner@creativecurrents.test';
const QA_B_EMAIL = 'railcommand-mobile-user-b@creativecurrents.test';
const AUTOMATION_EMAIL = 'railcommand-mobile-automation@creativecurrents.test';
const QA_B_ID = '6bb26880-b5dd-4f54-8787-25f9280f8c10';
const AUTOMATION_ID = '6bb26880-b5dd-4f54-8787-25f9280f8c11';
const PROJECT_ID = '20000000-0000-4000-8000-000000000001';
const ORGANIZATION_ID = '10000000-0000-4000-8000-000000000001';

function password(label) {
  return `Rc-${label}-${randomBytes(9).toString('base64url')}!9`;
}

function escapeSql(value) {
  return value.replaceAll("'", "''");
}

const qaAPassword = password('DeviceA');
const qaBPassword = password('DeviceB');
const automationPassword = password('Automation');
const supabaseWorkdir = process.env.MOBILE_SUPABASE_WORKDIR ?? process.cwd();
const expectedProjectRef = process.env.MOBILE_EXPECTED_SUPABASE_PROJECT_REF;
const linkedProjectRef = readFileSync(
  resolve(supabaseWorkdir, 'supabase/.temp/project-ref'),
  'utf8',
).trim();

if (!expectedProjectRef || linkedProjectRef !== expectedProjectRef) {
  throw new Error('Refusing to provision outside the expected RailCommand Mobile Staging project');
}

const sql = `
do $$
begin
  if to_regclass('mobile_staging.fixture_manifest') is null
     or not exists (
       select 1 from mobile_staging.fixture_manifest
       where fixture_key = 'qa-project'
         and synthetic_name = 'Synthetic US Track Renewal'
     )
     or not exists (
       select 1 from mobile_staging.fixture_manifest
       where fixture_key = 'qa-owner'
         and synthetic_email = '${QA_A_EMAIL}'
     ) then
    raise exception 'Refusing to provision outside RailCommand Mobile Staging';
  end if;
end;
$$;

do $$
begin
  update auth.users
  set encrypted_password = extensions.crypt('${escapeSql(qaAPassword)}', extensions.gen_salt('bf')),
      email_confirmed_at = coalesce(email_confirmed_at, now()),
      updated_at = now()
  where email = '${QA_A_EMAIL}';
  if not found then
    raise exception 'Synthetic QA user A is missing';
  end if;
end;
$$;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values
  ('00000000-0000-0000-0000-000000000000', '${QA_B_ID}', 'authenticated',
   'authenticated', '${QA_B_EMAIL}',
   extensions.crypt('${escapeSql(qaBPassword)}', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '${AUTOMATION_ID}', 'authenticated',
   'authenticated', '${AUTOMATION_EMAIL}',
   extensions.crypt('${escapeSql(automationPassword)}', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '')
on conflict (id) do update set
  email = excluded.email,
  encrypted_password = excluded.encrypted_password,
  email_confirmed_at = coalesce(auth.users.email_confirmed_at, now()),
  raw_app_meta_data = excluded.raw_app_meta_data,
  updated_at = now();

insert into auth.identities (
  id, provider_id, user_id, identity_data, provider, created_at, updated_at
) values
  ('971e9cf0-ffa4-43fe-ad42-cf86812ec710', '${QA_B_ID}', '${QA_B_ID}',
   jsonb_build_object('sub', '${QA_B_ID}', 'email', '${QA_B_EMAIL}',
     'email_verified', false, 'phone_verified', false),
   'email', now(), now()),
  ('971e9cf0-ffa4-43fe-ad42-cf86812ec711', '${AUTOMATION_ID}', '${AUTOMATION_ID}',
   jsonb_build_object('sub', '${AUTOMATION_ID}', 'email', '${AUTOMATION_EMAIL}',
     'email_verified', false, 'phone_verified', false),
   'email', now(), now())
on conflict (provider_id, provider) do update set
  user_id = excluded.user_id,
  identity_data = excluded.identity_data,
  updated_at = now();

insert into public.profiles (id, email, full_name, role, organization_id)
values
  ('${QA_B_ID}', '${QA_B_EMAIL}', 'RailCommand Mobile QA User B', 'manager', '${ORGANIZATION_ID}'),
  ('${AUTOMATION_ID}', '${AUTOMATION_EMAIL}', 'RailCommand Mobile Automation', 'manager', '${ORGANIZATION_ID}')
on conflict (id) do update set
  email = excluded.email,
  full_name = excluded.full_name,
  role = excluded.role,
  organization_id = excluded.organization_id,
  updated_at = now();

insert into public.project_members (project_id, profile_id, project_role, can_edit)
values
  ('${PROJECT_ID}', '${QA_B_ID}', 'manager', true),
  ('${PROJECT_ID}', '${AUTOMATION_ID}', 'manager', true)
on conflict (project_id, profile_id) do update set
  project_role = excluded.project_role,
  can_edit = excluded.can_edit;
`;

try {
  execFileSync('supabase', ['db', 'query', '--linked', sql], {
    cwd: supabaseWorkdir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
} catch (error) {
  const stderr = String(error?.stderr ?? '').trim();
  throw new Error(`Staging QA provisioning failed${stderr ? `: ${stderr}` : ''}`);
}

const credentials = {
  warning: 'Synthetic staging credentials only. Never use these for production.',
  userA: { email: QA_A_EMAIL, password: qaAPassword },
  userB: { email: QA_B_EMAIL, password: qaBPassword },
};
const credentialsOutput = process.env.MOBILE_QA_CREDENTIALS_OUTPUT;
if (credentialsOutput) {
  const absoluteOutput = resolve(credentialsOutput);
  if (!absoluteOutput.startsWith('/private/tmp/') && !absoluteOutput.startsWith('/tmp/')) {
    throw new Error('MOBILE_QA_CREDENTIALS_OUTPUT must be a temporary absolute path');
  }
  writeFileSync(absoluteOutput, `${JSON.stringify(credentials)}\n`, { mode: 0o600 });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const apiBaseUrl = process.env.NEXT_PUBLIC_APP_URL;
if (!supabaseUrl || !publishableKey || !apiBaseUrl) {
  throw new Error('The guarded mobile staging environment is required');
}

async function verifyDeviceUser(email, userPassword) {
  const client = createClient(supabaseUrl, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const signIn = await client.auth.signInWithPassword({ email, password: userPassword });
  if (signIn.error || !signIn.data.session) {
    throw signIn.error ?? new Error(`Staging sign-in failed for ${email}`);
  }
  const response = await fetch(`${apiBaseUrl}/api/mobile/v1/bootstrap`, {
    headers: { authorization: `Bearer ${signIn.data.session.access_token}` },
  });
  if (!response.ok) throw new Error(`Bootstrap failed for ${email}: ${response.status}`);
  const bootstrap = await response.json();
  if (!bootstrap.projects?.some((project) => project.id === PROJECT_ID)) {
    throw new Error(`Synthetic project was not returned for ${email}`);
  }
  await client.auth.signOut({ scope: 'local' });
}

await verifyDeviceUser(QA_A_EMAIL, qaAPassword);
await verifyDeviceUser(QA_B_EMAIL, qaBPassword);

console.log(JSON.stringify({
  ...(credentialsOutput ? { credentialsWritten: true } : credentials),
  signInAndBootstrapVerified: true,
  automationReady: true,
}, null, 2));
