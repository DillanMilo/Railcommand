import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) throw new Error('Supabase URL and service-role key are required');

const admin = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const command = process.argv[2];

async function findQaProject() {
  const projects = await requireData(
    await admin
      .from('projects')
      .select('id, organization_id')
      .eq('name', 'Offline Acceptance Test Project')
      .limit(2),
    'Find isolated QA project'
  );
  if (projects.length !== 1) throw new Error('Expected one isolated offline QA project');
  return projects[0];
}

async function requireData(result, label) {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
}

async function purgeServerData(userId) {
  const attachments = await requireData(
    await admin.from('attachments').select('file_url').eq('uploaded_by', userId),
    'List QA attachments'
  );
  const storageObjects = new Map();
  for (const attachment of attachments) {
    const match = attachment.file_url?.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
    if (!match) continue;
    const paths = storageObjects.get(match[1]) ?? [];
    paths.push(decodeURIComponent(match[2]));
    storageObjects.set(match[1], paths);
  }
  for (const [bucket, paths] of storageObjects) {
    if (paths.length > 0) await admin.storage.from(bucket).remove(paths);
  }
  await admin.from('attachments').delete().eq('uploaded_by', userId);
  await admin.from('daily_logs').delete().eq('created_by', userId);
}

async function cleanup(userId) {
  await purgeServerData(userId);
  await admin.from('project_members').delete().eq('profile_id', userId);
  await admin.from('profiles').delete().eq('id', userId);
  const deleted = await admin.auth.admin.deleteUser(userId);
  if (deleted.error && deleted.error.code !== 'user_not_found') throw deleted.error;
  console.log(JSON.stringify({ cleanedUserId: userId }));
}

if (command === 'setup') {
  const project = await findQaProject();

  const email = `offline-browser-${Date.now()}-${randomUUID().slice(0, 8)}@railcommand.test`;
  const password = `Offline-${randomUUID()}-Qa1!`;
  const auth = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { railcommand_offline_qa: true },
  });
  if (auth.error || !auth.data.user) throw auth.error ?? new Error('Could not create QA user');
  const userId = auth.data.user.id;
  try {
    await requireData(
      await admin.from('profiles').upsert({
        id: userId,
        email,
        full_name: 'Offline Browser QA',
        phone: '',
        role: 'member',
        organization_id: project.organization_id,
        avatar_url: '',
      }, { onConflict: 'id' }),
      'Create QA profile'
    );
    await requireData(
      await admin.from('project_members').insert({
        project_id: project.id,
        profile_id: userId,
        project_role: 'manager',
        can_edit: true,
      }),
      'Grant QA project permission'
    );
    console.log(JSON.stringify({
      userId,
      projectId: project.id,
      email,
      password,
    }));
  } catch (error) {
    await cleanup(userId);
    throw error;
  }
} else if (command === 'cleanup') {
  const userId = process.argv[3];
  if (!userId) throw new Error('A QA user ID is required for cleanup');
  await cleanup(userId);
} else if (command === 'purge-data') {
  const userId = process.argv[3];
  if (!userId) throw new Error('A QA user ID is required to purge server data');
  await purgeServerData(userId);
  console.log(JSON.stringify({ purgedUserId: userId }));
} else if (command === 'revoke') {
  const userId = process.argv[3];
  if (!userId) throw new Error('A QA user ID is required to revoke permission');
  const project = await findQaProject();
  await requireData(
    await admin.from('project_members').delete().eq('project_id', project.id).eq('profile_id', userId),
    'Revoke QA project permission'
  );
  console.log(JSON.stringify({ revokedUserId: userId, projectId: project.id }));
} else if (command === 'grant') {
  const userId = process.argv[3];
  if (!userId) throw new Error('A QA user ID is required to grant permission');
  const project = await findQaProject();
  await admin.from('project_members').delete().eq('project_id', project.id).eq('profile_id', userId);
  await requireData(
    await admin.from('project_members').insert({
      project_id: project.id,
      profile_id: userId,
      project_role: 'manager',
      can_edit: true,
    }),
    'Grant QA project permission'
  );
  console.log(JSON.stringify({ grantedUserId: userId, projectId: project.id }));
} else if (command === 'inspect') {
  const userId = process.argv[3];
  if (!userId) throw new Error('A QA user ID is required to inspect data');
  const [logs, attachments] = await Promise.all([
    requireData(
      await admin.from('daily_logs').select('id, work_summary, idempotency_key').eq('created_by', userId),
      'Inspect QA daily logs'
    ),
    requireData(
      await admin.from('attachments').select('id, entity_id, idempotency_key, file_name').eq('uploaded_by', userId),
      'Inspect QA attachments'
    ),
  ]);
  console.log(JSON.stringify({ logs, attachments }, null, 2));
} else {
  throw new Error('Use `setup`, `inspect|revoke|grant|purge-data <user-id>`, or `cleanup <user-id>`');
}
