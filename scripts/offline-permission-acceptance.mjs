import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceRoleKey) {
  throw new Error('Supabase URL, anon key, and service-role key are required');
}

const admin = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const suffix = `${Date.now()}-${randomUUID().slice(0, 8)}`;
const email = `offline-permission-${suffix}@railcommand.test`;
const password = `Offline-${randomUUID()}-Qa1!`;
const clientId = randomUUID();
const photoId = randomUUID();
let userId = null;
let projectId = null;
let userClient = null;

async function requireData(result, label) {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
}

async function cleanup() {
  if (userClient) await userClient.auth.signOut({ scope: 'local' }).catch(() => {});
  if (userId) {
    await admin.from('attachments').delete().eq('uploaded_by', userId);
    await admin.from('daily_logs').delete().eq('created_by', userId);
    await admin.from('project_members').delete().eq('profile_id', userId);
    await admin.from('profiles').delete().eq('id', userId);
    await admin.auth.admin.deleteUser(userId).catch(() => {});
  }
}

try {
  const projects = await requireData(
    await admin
      .from('projects')
      .select('id, organization_id, name')
      .eq('name', 'Offline Acceptance Test Project')
      .limit(2),
    'Find isolated QA project'
  );
  if (projects.length !== 1) {
    throw new Error('Expected exactly one project named Offline Acceptance Test Project');
  }
  projectId = projects[0].id;

  const auth = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { railcommand_offline_qa: true },
  });
  if (auth.error || !auth.data.user) throw auth.error ?? new Error('Could not create QA user');
  userId = auth.data.user.id;

  await requireData(
    await admin.from('profiles').upsert({
      id: userId,
      email,
      full_name: 'Offline Permission QA',
      phone: '',
      role: 'member',
      organization_id: projects[0].organization_id,
      avatar_url: '',
    }, { onConflict: 'id' }),
    'Create QA profile'
  );
  await requireData(
    await admin.from('project_members').insert({
      project_id: projectId,
      profile_id: userId,
      project_role: 'manager',
      can_edit: true,
    }),
    'Grant temporary project permission'
  );

  userClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const login = await userClient.auth.signInWithPassword({ email, password });
  if (login.error) throw login.error;

  const payload = {
    log_date: '2026-08-14',
    weather_temp: 70,
    weather_conditions: 'Acceptance test',
    weather_wind: 'Calm',
    work_summary: `Permission revocation ${suffix}`,
    safety_notes: 'QA only',
    geo_tag: null,
    personnel: [],
    equipment: [],
    work_items: [],
  };
  const createArgs = {
    p_project_id: projectId,
    p_client_id: clientId,
    p_idempotency_key: `offline-permission:${clientId}`,
    p_payload: payload,
  };

  await requireData(
    await admin.from('project_members').delete().eq('project_id', projectId).eq('profile_id', userId),
    'Revoke permission before synchronization'
  );
  const deniedCreate = await userClient.rpc('sync_daily_log_create', createArgs);
  if (!deniedCreate.error || !/permission denied/i.test(deniedCreate.error.message)) {
    throw new Error(`Expected revoked daily-log synchronization to fail, received: ${deniedCreate.error?.message ?? 'success'}`);
  }
  const deniedCount = await admin
    .from('daily_logs')
    .select('id', { count: 'exact', head: true })
    .eq('id', clientId);
  if (deniedCount.error || deniedCount.count !== 0) {
    throw new Error('Revoked synchronization created a daily log unexpectedly');
  }

  await requireData(
    await admin.from('project_members').insert({
      project_id: projectId,
      profile_id: userId,
      project_role: 'manager',
      can_edit: true,
    }),
    'Restore permission for idempotency test'
  );
  const firstCreate = await userClient.rpc('sync_daily_log_create', createArgs);
  if (firstCreate.error || firstCreate.data?.duplicate !== false) {
    throw new Error(`Initial synchronization failed: ${firstCreate.error?.message ?? 'unexpected response'}`);
  }
  const replayCreate = await userClient.rpc('sync_daily_log_create', createArgs);
  if (replayCreate.error || replayCreate.data?.duplicate !== true || replayCreate.data?.id !== clientId) {
    throw new Error(`Idempotent replay failed: ${replayCreate.error?.message ?? 'unexpected response'}`);
  }

  await requireData(
    await admin.from('project_members').delete().eq('project_id', projectId).eq('profile_id', userId),
    'Revoke permission before photo finalization'
  );
  const photoPath = `${projectId}/daily_log/${clientId}/${photoId}-field.jpg`;
  const deniedPhoto = await userClient.rpc('sync_daily_log_photo_attachment', {
    p_attachment_id: photoId,
    p_project_id: projectId,
    p_daily_log_id: clientId,
    p_idempotency_key: `daily-log-photo:${photoId}`,
    p_bucket: 'project-photos',
    p_storage_path: photoPath,
    p_file_name: 'field.jpg',
    p_file_type: 'image/jpeg',
    p_file_size: 1024,
    p_photo_category: 'standard',
    p_geo_lat: null,
    p_geo_lng: null,
    p_captured_at: new Date().toISOString(),
  });
  // With RLS active under SECURITY INVOKER, a revoked member may receive the
  // deliberately non-disclosing parent-unavailable result before the explicit
  // membership branch. Either result must reject without creating a row.
  if (!deniedPhoto.error || !/(permission denied|parent daily log is unavailable)/i.test(deniedPhoto.error.message)) {
    throw new Error(`Expected revoked photo finalization to fail, received: ${deniedPhoto.error?.message ?? 'success'}`);
  }

  const [logCount, photoCount] = await Promise.all([
    admin.from('daily_logs').select('id', { count: 'exact', head: true }).eq('id', clientId),
    admin.from('attachments').select('id', { count: 'exact', head: true }).eq('id', photoId),
  ]);
  if (logCount.error || photoCount.error || logCount.count !== 1 || photoCount.count !== 0) {
    throw new Error('Final backend counts did not match the acceptance invariant');
  }

  console.log(JSON.stringify({
    permissionRevocation: 'passed',
    idempotentReplay: 'passed',
    dailyLogCount: logCount.count,
    unauthorizedPhotoCount: photoCount.count,
    cleanup: 'pending',
  }, null, 2));
} finally {
  await cleanup();
  console.log('Offline permission acceptance QA data cleaned up.');
}
