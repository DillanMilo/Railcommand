import { execFileSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const STAGING_REF = 'cyacardivfzrsravqjto';
const STAGING_API = 'https://railcommand-mobile-staging.vercel.app';
const QA_EMAIL = 'railcommand-mobile-automation@creativecurrents.test';
const FIXTURE_PROJECT_ID = '20000000-0000-4000-8000-000000000001';

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function runStagingSql(sql) {
  execFileSync('supabase', ['db', 'query', '--linked', sql], {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

const supabaseUrl = required('NEXT_PUBLIC_SUPABASE_URL');
const anonKey = required('NEXT_PUBLIC_SUPABASE_ANON_KEY');
if (new URL(supabaseUrl).hostname !== `${STAGING_REF}.supabase.co`) {
  throw new Error('Refusing to verify a non-staging Supabase project');
}

const password = `Rc-${randomBytes(30).toString('base64url')}!9`;
const escapedPassword = password.replaceAll("'", "''");
runStagingSql(`
do $$
begin
  if to_regclass('mobile_staging.fixture_manifest') is null
     or not exists (
       select 1 from mobile_staging.fixture_manifest
       where fixture_key = 'qa-project'
         and synthetic_name = 'Synthetic US Track Renewal'
     ) then
    raise exception 'Refusing to rotate credentials outside mobile staging';
  end if;
  update auth.users
  set encrypted_password = extensions.crypt('${escapedPassword}', extensions.gen_salt('bf')),
      email_confirmed_at = coalesce(email_confirmed_at, now()),
      updated_at = now()
  where email = '${QA_EMAIL}';
  if not found then raise exception 'Synthetic QA user is missing'; end if;
end;
$$;
`);

const supabase = createClient(supabaseUrl, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});
const signIn = await supabase.auth.signInWithPassword({ email: QA_EMAIL, password });
if (signIn.error || !signIn.data.session) {
  throw signIn.error ?? new Error('Synthetic staging sign-in did not return a session');
}
const refresh = await supabase.auth.refreshSession({
  refresh_token: signIn.data.session.refresh_token,
});
if (refresh.error || !refresh.data.session) {
  throw refresh.error ?? new Error('Synthetic staging session could not be restored');
}
const accessToken = refresh.data.session.access_token;
const headers = { authorization: `Bearer ${accessToken}` };

const bootstrapResponse = await fetch(`${STAGING_API}/api/mobile/v1/bootstrap`, { headers });
if (!bootstrapResponse.ok) {
  throw new Error(`Bootstrap failed with ${bootstrapResponse.status}`);
}
if (bootstrapResponse.headers.get('cache-control') !== 'no-store, max-age=0') {
  throw new Error('Authenticated bootstrap response is not explicitly no-store');
}
const bootstrap = await bootstrapResponse.json();
if (bootstrap.userId !== refresh.data.user.id) throw new Error('Bootstrap user mismatch');
if (!bootstrap.projects.some((project) => project.id === FIXTURE_PROJECT_ID)) {
  throw new Error('Synthetic member project was not returned');
}
if (!bootstrap.dailyLogs.some((log) => log.id === '30000000-0000-4000-8000-000000000001')) {
  throw new Error('Synthetic cached daily log was not returned');
}

const clientId = randomUUID();
const operation = {
  operationId: clientId,
  userId: refresh.data.user.id,
  projectId: FIXTURE_PROJECT_ID,
  clientId,
  idempotencyKey: `phase1-staging-verify:${clientId}`,
  payload: {
    log_date: new Date().toISOString().slice(0, 10),
    weather_temp: 0,
    weather_conditions: 'Synthetic integration check',
    weather_wind: '',
    work_summary: 'Temporary Phase 1 idempotency verification; safe to delete.',
    safety_notes: 'Synthetic staging only.',
    geo_tag: null,
    personnel: [],
    equipment: [],
    work_items: [],
  },
  status: 'pending',
  attemptCount: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  nextAttemptAt: new Date().toISOString(),
  lastError: null,
};

async function synchronize() {
  const response = await fetch(`${STAGING_API}/api/mobile/v1/daily-logs/sync`, {
    method: 'POST',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify(operation),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`Synchronization failed with ${response.status}: ${body.error}`);
  return body;
}

let first;
let duplicate;
try {
  first = await synchronize();
  duplicate = await synchronize();
  if (first.id !== clientId || first.duplicate !== false) {
    throw new Error('First delivery did not create the expected client-ID record');
  }
  if (duplicate.id !== clientId || duplicate.duplicate !== true) {
    throw new Error('Repeated delivery was not recognized as an idempotent duplicate');
  }
} finally {
  runStagingSql(`
do $$
begin
  if to_regclass('mobile_staging.fixture_manifest') is null then
    raise exception 'Refusing cleanup outside mobile staging';
  end if;
  delete from public.activity_log where entity_id = '${clientId}';
  delete from public.daily_logs
  where id = '${clientId}' and idempotency_key = 'phase1-staging-verify:${clientId}';
end;
$$;
`);
  await supabase.auth.signOut({ scope: 'local' });
}

console.log(JSON.stringify({
  stagingProject: STAGING_REF,
  sessionRestored: true,
  projectList: true,
  cachedDailyLog: true,
  firstDeliveryDuplicate: first.duplicate,
  secondDeliveryDuplicate: duplicate.duplicate,
  temporaryRecordRemoved: true,
}, null, 2));
