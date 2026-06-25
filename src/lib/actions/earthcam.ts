'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import {
  createEarthCamAccessToken,
  decryptSecret,
  encryptSecret,
  signEarthCamTargetUrl,
} from '@/lib/earthcam/security';
import { extractEarthCamEmbedUrl } from '@/lib/earthcam/embed';
import { ACTIONS } from '@/lib/permissions';
import {
  checkPermission,
  getAuthenticatedUser,
  logActivity,
  type ActionResult,
} from './permissions-helper';
import type {
  EarthCamCamera,
  EarthCamCameraStatus,
  EarthCamConnection,
  EarthCamEmbed,
  EarthCamEvidence,
  EarthCamEvidenceType,
} from '@/lib/types';

export interface EarthCamWorkspace {
  connection: EarthCamConnection | null;
  cameras: EarthCamCamera[];
  evidence: EarthCamEvidence[];
}

export type EarthCamEmbedInput = {
  id?: string;
  label: string;
  embedInput: string;
};

export type EarthCamAccessLink = {
  url: string;
  expiresAt: string;
};

type EarthCamConnectionSecretRow = EarthCamConnection & {
  api_key_encrypted: string | null;
  api_key_iv: string | null;
  api_key_tag: string | null;
  embed_signing_secret_encrypted: string | null;
  embed_signing_secret_iv: string | null;
  embed_signing_secret_tag: string | null;
  sync_error: string | null;
};

const SAFE_CONNECTION_COLUMNS = `
  id,
  organization_id,
  account_name,
  status,
  auth_mode,
  api_base_url,
  api_key_last4,
  connected_by,
  connected_at,
  last_sync_at,
  credentials_updated_at,
  created_at
`;

function redactCameraUrls(camera: EarthCamCamera): EarthCamCamera {
  return {
    ...camera,
    live_embed_url: '',
    live_stream_url: '',
  };
}

function redactEvidenceUrl(evidence: EarthCamEvidence): EarthCamEvidence {
  return {
    ...evidence,
    earthcam_url: '',
  };
}

function normalizeOptionalUrl(value?: string): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const url = new URL(trimmed);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('URL must start with http:// or https://');
  }
  return url.toString();
}

function normalizeStatus(value: unknown): EarthCamCameraStatus {
  if (value === 'offline' || value === 'maintenance') return value;
  return 'online';
}

function readFirstString(source: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number') return String(value);
  }
  return '';
}

function buildCameraSyncUrl(baseUrl: string): string {
  const url = new URL(baseUrl);
  if (!url.pathname.replace(/\/$/, '').endsWith('/cameras')) {
    url.pathname = `${url.pathname.replace(/\/$/, '')}/cameras`;
  }
  return url.toString();
}

function getEarthCamApiKey(connection: EarthCamConnectionSecretRow): string | null {
  return decryptSecret({
    ciphertext: connection.api_key_encrypted,
    iv: connection.api_key_iv,
    tag: connection.api_key_tag,
  });
}

async function applyVendorSignature(
  admin: ReturnType<typeof createAdminClient>,
  connectionId: string,
  url: string,
  expiresAt: string
): Promise<string> {
  const { data: connection } = await admin
    .from('earthcam_connections')
    .select(`
      embed_signing_secret_encrypted,
      embed_signing_secret_iv,
      embed_signing_secret_tag
    `)
    .eq('id', connectionId)
    .maybeSingle();

  const signingSecret = decryptSecret({
    ciphertext: connection?.embed_signing_secret_encrypted,
    iv: connection?.embed_signing_secret_iv,
    tag: connection?.embed_signing_secret_tag,
  });

  return signingSecret ? signEarthCamTargetUrl(url, signingSecret, expiresAt) : url;
}

async function getProjectOrganizationId(projectId: string): Promise<ActionResult<string>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('projects')
    .select('organization_id')
    .eq('id', projectId)
    .single();

  if (error || !data?.organization_id) {
    return { error: error?.message ?? 'Project not found' };
  }

  return { success: true, data: data.organization_id as string };
}

async function logEarthCamActivity(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string,
  entityType: 'earthcam_connection' | 'earthcam_camera' | 'earthcam_evidence',
  entityId: string,
  action: 'created' | 'updated' | 'deleted',
  description: string,
  userId: string
) {
  try {
    await logActivity(supabase, projectId, entityType, entityId, action, description, userId);
  } catch {
    // Activity logging should not block the operational action.
  }
}

export async function getEarthCamWorkspace(
  projectId: string
): Promise<ActionResult<EarthCamWorkspace>> {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    const viewPermission = await checkPermission(supabase, user.id, projectId, ACTIONS.EARTHCAM_VIEW);
    if (!viewPermission.allowed) return { error: viewPermission.error };

    const managePermission = await checkPermission(supabase, user.id, projectId, ACTIONS.EARTHCAM_MANAGE);
    const canSeeRawReferences = managePermission.allowed;

    const orgResult = await getProjectOrganizationId(projectId);
    if (orgResult.error) return orgResult;

    const [connectionResult, camerasResult, evidenceResult] = await Promise.all([
      supabase
        .from('earthcam_connections')
        .select(SAFE_CONNECTION_COLUMNS)
        .eq('organization_id', orgResult.data)
        .maybeSingle(),
      supabase
        .from('earthcam_cameras')
        .select('*')
        .eq('project_id', projectId)
        .order('name', { ascending: true }),
      supabase
        .from('earthcam_evidence')
        .select('*')
        .eq('project_id', projectId)
        .order('captured_at', { ascending: false }),
    ]);

    if (connectionResult.error) return { error: connectionResult.error.message };
    if (camerasResult.error) return { error: camerasResult.error.message };
    if (evidenceResult.error) return { error: evidenceResult.error.message };

    const cameras = ((camerasResult.data ?? []) as EarthCamCamera[]).map((camera) =>
      canSeeRawReferences ? camera : redactCameraUrls(camera)
    );
    const evidence = ((evidenceResult.data ?? []) as EarthCamEvidence[]).map((item) =>
      canSeeRawReferences ? item : redactEvidenceUrl(item)
    );

    return {
      success: true,
      data: {
        connection: (connectionResult.data ?? null) as EarthCamConnection | null,
        cameras,
        evidence,
      },
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Failed to load EarthCam workspace',
    };
  }
}

export async function getEarthCamEmbeds(projectId: string): Promise<ActionResult<EarthCamEmbed[]>> {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    const permission = await checkPermission(supabase, user.id, projectId, ACTIONS.EARTHCAM_VIEW);
    if (!permission.allowed) return { error: permission.error };

    const { data, error } = await supabase
      .from('earthcam_embeds')
      .select('*')
      .eq('project_id', projectId)
      .order('label', { ascending: true });

    if (error) return { error: error.message };
    return { success: true, data: (data ?? []) as EarthCamEmbed[] };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Failed to load EarthCam embeds',
    };
  }
}

export async function saveEarthCamEmbed(
  projectId: string,
  input: EarthCamEmbedInput
): Promise<ActionResult<EarthCamEmbed>> {
  try {
    const supabase = await createClient();
    const admin = createAdminClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    const permission = await checkPermission(supabase, user.id, projectId, ACTIONS.EARTHCAM_EMBED_MANAGE);
    if (!permission.allowed) return { error: permission.error };

    const { url } = extractEarthCamEmbedUrl(input.embedInput);
    const label = input.label.trim() || 'EarthCam Feed';

    const query = input.id
      ? admin
          .from('earthcam_embeds')
          .update({ label, url })
          .eq('id', input.id)
          .eq('project_id', projectId)
          .select('*')
          .single()
      : admin
          .from('earthcam_embeds')
          .insert({ project_id: projectId, label, url })
          .select('*')
          .single();

    const { data, error } = await query;
    if (error || !data) return { error: error?.message ?? 'Failed to save EarthCam embed' };

    await logEarthCamActivity(
      supabase,
      projectId,
      'earthcam_camera',
      data.id,
      input.id ? 'updated' : 'created',
      `${input.id ? 'updated' : 'created'} EarthCam embed ${label}`,
      user.id
    );

    revalidatePath(`/projects/${projectId}/cameras`);
    return { success: true, data: data as EarthCamEmbed };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Failed to save EarthCam embed',
    };
  }
}

export async function deleteEarthCamEmbed(
  projectId: string,
  embedId: string
): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const admin = createAdminClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    const permission = await checkPermission(supabase, user.id, projectId, ACTIONS.EARTHCAM_EMBED_MANAGE);
    if (!permission.allowed) return { error: permission.error };

    const { data: embed } = await admin
      .from('earthcam_embeds')
      .select('id, label')
      .eq('id', embedId)
      .eq('project_id', projectId)
      .maybeSingle();

    const { error } = await admin
      .from('earthcam_embeds')
      .delete()
      .eq('id', embedId)
      .eq('project_id', projectId);

    if (error) return { error: error.message };

    if (embed?.id) {
      await logEarthCamActivity(
        supabase,
        projectId,
        'earthcam_camera',
        embed.id,
        'deleted',
        `deleted EarthCam embed ${embed.label}`,
        user.id
      );
    }

    revalidatePath(`/projects/${projectId}/cameras`);
    return { success: true, data: undefined };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Failed to delete EarthCam embed',
    };
  }
}

export async function saveEarthCamConnection(
  projectId: string,
  input: {
    accountName: string;
    authMode?: EarthCamConnection['auth_mode'];
    apiKey?: string;
    apiBaseUrl?: string;
    embedSigningSecret?: string;
  }
): Promise<ActionResult<EarthCamConnection>> {
  try {
    const supabase = await createClient();
    const admin = createAdminClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    const permission = await checkPermission(supabase, user.id, projectId, ACTIONS.EARTHCAM_ADMIN);
    if (!permission.allowed) return { error: permission.error };

    const orgResult = await getProjectOrganizationId(projectId);
    if (orgResult.error) return orgResult;

    const apiKey = input.apiKey?.trim();
    const embedSigningSecret = input.embedSigningSecret?.trim();
    const apiBaseUrl = normalizeOptionalUrl(input.apiBaseUrl);
    const now = new Date().toISOString();

    const { data: existing } = await admin
      .from('earthcam_connections')
      .select(`
        api_key_last4,
        connected_by,
        connected_at,
        created_at,
        auth_mode,
        credentials_updated_at
      `)
      .eq('organization_id', orgResult.data)
      .maybeSingle();

    const payload: Record<string, unknown> = {
      organization_id: orgResult.data,
      account_name: input.accountName.trim() || 'EarthCam',
      status: 'connected',
      auth_mode: input.authMode ?? existing?.auth_mode ?? 'api_key',
      api_base_url: apiBaseUrl,
      api_key_last4: apiKey ? apiKey.slice(-4) : existing?.api_key_last4 ?? null,
      connected_by: existing?.connected_by ?? user.id,
      connected_at: existing?.connected_at ?? now,
      last_sync_at: now,
      created_at: existing?.created_at ?? now,
      credentials_updated_at:
        apiKey || embedSigningSecret ? now : existing?.credentials_updated_at ?? null,
      sync_error: null,
    };

    if (apiKey) {
      const encrypted = encryptSecret(apiKey);
      payload.api_key_encrypted = encrypted.ciphertext;
      payload.api_key_iv = encrypted.iv;
      payload.api_key_tag = encrypted.tag;
    }

    if (embedSigningSecret) {
      const encrypted = encryptSecret(embedSigningSecret);
      payload.embed_signing_secret_encrypted = encrypted.ciphertext;
      payload.embed_signing_secret_iv = encrypted.iv;
      payload.embed_signing_secret_tag = encrypted.tag;
    }

    const { data, error } = await admin
      .from('earthcam_connections')
      .upsert(payload, { onConflict: 'organization_id' })
      .select(SAFE_CONNECTION_COLUMNS)
      .single();

    if (error) return { error: error.message };

    await logEarthCamActivity(
      supabase,
      projectId,
      'earthcam_connection',
      data.id,
      'updated',
      `updated EarthCam connection for ${data.account_name}`,
      user.id
    );

    revalidatePath(`/projects/${projectId}/cameras`);
    return { success: true, data: data as EarthCamConnection };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Failed to save EarthCam connection',
    };
  }
}

export async function upsertEarthCamCamera(
  projectId: string,
  input: {
    id?: string;
    earthcamCameraId: string;
    name: string;
    locationLabel: string;
    railArea: string;
    liveEmbedUrl?: string;
    liveStreamUrl?: string;
    thumbnailUrl?: string;
    status?: EarthCamCameraStatus;
    ptzEnabled?: boolean;
  }
): Promise<ActionResult<EarthCamCamera>> {
  try {
    const supabase = await createClient();
    const admin = createAdminClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    const permission = await checkPermission(supabase, user.id, projectId, ACTIONS.EARTHCAM_MANAGE);
    if (!permission.allowed) return { error: permission.error };

    const orgResult = await getProjectOrganizationId(projectId);
    if (orgResult.error) return orgResult;

    const { data: connection, error: connectionError } = await admin
      .from('earthcam_connections')
      .select('id')
      .eq('organization_id', orgResult.data)
      .eq('status', 'connected')
      .maybeSingle();

    if (connectionError) return { error: connectionError.message };
    if (!connection?.id) return { error: 'EarthCam is not connected' };

    const payload = {
      project_id: projectId,
      connection_id: connection.id,
      earthcam_camera_id: input.earthcamCameraId.trim(),
      name: input.name.trim(),
      location_label: input.locationLabel.trim(),
      rail_area: input.railArea.trim(),
      live_embed_url: input.liveEmbedUrl?.trim() ?? '',
      live_stream_url: input.liveStreamUrl?.trim() ?? '',
      thumbnail_url: input.thumbnailUrl?.trim() ?? '',
      status: input.status ?? 'online',
      ptz_enabled: input.ptzEnabled ?? false,
      last_seen_at: new Date().toISOString(),
    };

    const query = input.id
      ? admin
          .from('earthcam_cameras')
          .update(payload)
          .eq('id', input.id)
          .eq('project_id', projectId)
          .select()
          .single()
      : admin
          .from('earthcam_cameras')
          .insert(payload)
          .select()
          .single();

    const { data, error } = await query;
    if (error) return { error: error.message };

    await logEarthCamActivity(
      supabase,
      projectId,
      'earthcam_camera',
      data.id,
      input.id ? 'updated' : 'created',
      `${input.id ? 'updated' : 'created'} EarthCam camera ${data.name}`,
      user.id
    );

    revalidatePath(`/projects/${projectId}/cameras`);
    return { success: true, data: data as EarthCamCamera };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Failed to save EarthCam camera',
    };
  }
}

export async function deleteEarthCamCamera(
  projectId: string,
  cameraId: string
): Promise<ActionResult<undefined>> {
  try {
    const supabase = await createClient();
    const admin = createAdminClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    const permission = await checkPermission(supabase, user.id, projectId, ACTIONS.EARTHCAM_MANAGE);
    if (!permission.allowed) return { error: permission.error };

    const { data: camera } = await admin
      .from('earthcam_cameras')
      .select('id, name')
      .eq('id', cameraId)
      .eq('project_id', projectId)
      .maybeSingle();

    const { error } = await admin
      .from('earthcam_cameras')
      .delete()
      .eq('id', cameraId)
      .eq('project_id', projectId);

    if (error) return { error: error.message };

    if (camera?.id) {
      await logEarthCamActivity(
        supabase,
        projectId,
        'earthcam_camera',
        camera.id,
        'deleted',
        `deleted EarthCam camera ${camera.name}`,
        user.id
      );
    }

    revalidatePath(`/projects/${projectId}/cameras`);
    return { success: true, data: undefined };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Failed to delete EarthCam camera',
    };
  }
}

export async function createEarthCamEvidence(
  projectId: string,
  input: {
    cameraId: string;
    evidenceType: EarthCamEvidenceType;
    title: string;
    description?: string;
    capturedAt?: string;
    startTime?: string | null;
    endTime?: string | null;
    earthCamAssetId?: string | null;
    earthCamUrl?: string;
    thumbnailUrl?: string;
  }
): Promise<ActionResult<EarthCamEvidence>> {
  try {
    const supabase = await createClient();
    const admin = createAdminClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    const permission = await checkPermission(supabase, user.id, projectId, ACTIONS.EARTHCAM_CAPTURE);
    if (!permission.allowed) return { error: permission.error };

    const { data: camera, error: cameraError } = await admin
      .from('earthcam_cameras')
      .select('id, live_stream_url, live_embed_url, thumbnail_url, name')
      .eq('id', input.cameraId)
      .eq('project_id', projectId)
      .single();

    if (cameraError || !camera) return { error: cameraError?.message ?? 'Camera not found' };

    const { data, error } = await admin
      .from('earthcam_evidence')
      .insert({
        project_id: projectId,
        camera_id: input.cameraId,
        evidence_type: input.evidenceType,
        title: input.title.trim(),
        description: input.description?.trim() ?? '',
        captured_at: input.capturedAt ?? new Date().toISOString(),
        start_time: input.startTime ?? null,
        end_time: input.endTime ?? null,
        earthcam_asset_id: input.earthCamAssetId?.trim() || null,
        earthcam_url: input.earthCamUrl?.trim() || camera.live_stream_url || camera.live_embed_url || '',
        thumbnail_url: input.thumbnailUrl?.trim() || camera.thumbnail_url || '',
        created_by: user.id,
      })
      .select()
      .single();

    if (error) return { error: error.message };

    await logEarthCamActivity(
      supabase,
      projectId,
      'earthcam_evidence',
      data.id,
      'created',
      `created EarthCam ${data.evidence_type} evidence from ${camera.name}`,
      user.id
    );

    revalidatePath(`/projects/${projectId}/cameras`);
    return { success: true, data: data as EarthCamEvidence };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Failed to create EarthCam evidence',
    };
  }
}

export async function deleteEarthCamEvidence(
  projectId: string,
  evidenceId: string
): Promise<ActionResult<undefined>> {
  try {
    const supabase = await createClient();
    const admin = createAdminClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    const capturePermission = await checkPermission(supabase, user.id, projectId, ACTIONS.EARTHCAM_CAPTURE);
    if (!capturePermission.allowed) return { error: capturePermission.error };

    const { data: evidence, error: evidenceError } = await admin
      .from('earthcam_evidence')
      .select('id, title, created_by')
      .eq('id', evidenceId)
      .eq('project_id', projectId)
      .single();

    if (evidenceError || !evidence) return { error: evidenceError?.message ?? 'Evidence not found' };

    const managePermission = await checkPermission(supabase, user.id, projectId, ACTIONS.EARTHCAM_MANAGE);
    if (!managePermission.allowed && evidence.created_by !== user.id) {
      return { error: 'Permission denied' };
    }

    const { error } = await admin
      .from('earthcam_evidence')
      .delete()
      .eq('id', evidenceId)
      .eq('project_id', projectId);

    if (error) return { error: error.message };

    await logEarthCamActivity(
      supabase,
      projectId,
      'earthcam_evidence',
      evidence.id,
      'deleted',
      `deleted EarthCam evidence ${evidence.title}`,
      user.id
    );

    revalidatePath(`/projects/${projectId}/cameras`);
    return { success: true, data: undefined };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Failed to delete EarthCam evidence',
    };
  }
}

export async function createEarthCamAccessLink(
  projectId: string,
  input:
    | { targetType: 'camera'; cameraId: string }
    | { targetType: 'evidence'; evidenceId: string }
): Promise<ActionResult<EarthCamAccessLink>> {
  try {
    const supabase = await createClient();
    const admin = createAdminClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    const permission = await checkPermission(supabase, user.id, projectId, ACTIONS.EARTHCAM_VIEW);
    if (!permission.allowed) return { error: permission.error };

    let url = '';
    let subjectId = '';
    let connectionId = '';
    const subjectType: 'camera' | 'evidence' = input.targetType;

    if (input.targetType === 'camera') {
      const { data: camera, error } = await admin
        .from('earthcam_cameras')
        .select('id, connection_id, live_stream_url, live_embed_url')
        .eq('id', input.cameraId)
        .eq('project_id', projectId)
        .single();

      if (error || !camera) return { error: error?.message ?? 'Camera not found' };
      url = camera.live_stream_url || camera.live_embed_url || '';
      subjectId = camera.id;
      connectionId = camera.connection_id;
    } else {
      const { data: evidence, error } = await admin
        .from('earthcam_evidence')
        .select('id, earthcam_url, camera_id')
        .eq('id', input.evidenceId)
        .eq('project_id', projectId)
        .single();

      if (error || !evidence) return { error: error?.message ?? 'Evidence not found' };
      url = evidence.earthcam_url || '';
      subjectId = evidence.id;

      const { data: camera } = await admin
        .from('earthcam_cameras')
        .select('connection_id, live_stream_url, live_embed_url')
        .eq('id', evidence.camera_id)
        .eq('project_id', projectId)
        .maybeSingle();

      connectionId = camera?.connection_id ?? '';
      if (!url) {
        url = camera?.live_stream_url || camera?.live_embed_url || '';
      }
    }

    if (!url) return { error: 'No EarthCam URL is configured for this item' };
    normalizeOptionalUrl(url);

    const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();
    const targetUrl = connectionId
      ? await applyVendorSignature(admin, connectionId, url, expiresAt)
      : url;
    const token = createEarthCamAccessToken({
      url: targetUrl,
      projectId,
      subjectId,
      subjectType,
      expiresAt,
    });

    return {
      success: true,
      data: {
        url: `/api/earthcam/access?token=${encodeURIComponent(token)}`,
        expiresAt,
      },
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Failed to create EarthCam access link',
    };
  }
}

export async function syncEarthCamCameras(
  projectId: string
): Promise<ActionResult<{ synced: number; skipped: number }>> {
  try {
    const supabase = await createClient();
    const admin = createAdminClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    const permission = await checkPermission(supabase, user.id, projectId, ACTIONS.EARTHCAM_MANAGE);
    if (!permission.allowed) return { error: permission.error };

    const orgResult = await getProjectOrganizationId(projectId);
    if (orgResult.error) return orgResult;

    const { data: connection, error: connectionError } = await admin
      .from('earthcam_connections')
      .select(`
        *,
        api_key_encrypted,
        api_key_iv,
        api_key_tag,
        embed_signing_secret_encrypted,
        embed_signing_secret_iv,
        embed_signing_secret_tag,
        sync_error
      `)
      .eq('organization_id', orgResult.data)
      .eq('status', 'connected')
      .maybeSingle();

    if (connectionError) return { error: connectionError.message };
    if (!connection) return { error: 'EarthCam is not connected' };

    const apiBaseUrl = connection.api_base_url;
    const apiKey = getEarthCamApiKey(connection as EarthCamConnectionSecretRow);

    if (!apiBaseUrl || !apiKey) {
      return {
        error:
          'Camera sync needs an EarthCam API base URL and stored API key. Cameras can still be added manually.',
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);

    let response: Response;
    try {
      response = await fetch(buildCameraSyncUrl(apiBaseUrl), {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'X-API-Key': apiKey,
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const message = `EarthCam sync failed with HTTP ${response.status}`;
      await admin.from('earthcam_connections').update({ sync_error: message }).eq('id', connection.id);
      return { error: message };
    }

    const body = await response.json();
    const rawCameras = Array.isArray(body)
      ? body
      : Array.isArray(body?.cameras)
        ? body.cameras
        : Array.isArray(body?.data)
          ? body.data
          : [];

    if (!Array.isArray(rawCameras)) {
      return { error: 'EarthCam sync response did not include a camera list' };
    }

    const { data: existingCameras } = await admin
      .from('earthcam_cameras')
      .select('*')
      .eq('project_id', projectId);

    const existingByEarthCamId = new Map(
      ((existingCameras ?? []) as EarthCamCamera[]).map((camera) => [camera.earthcam_camera_id, camera])
    );

    const now = new Date().toISOString();
    let skipped = 0;
    const payloads = rawCameras.flatMap((raw: unknown) => {
      if (!raw || typeof raw !== 'object') {
        skipped += 1;
        return [];
      }

      const camera = raw as Record<string, unknown>;
      const earthcamCameraId = readFirstString(camera, [
        'earthcam_camera_id',
        'earthcamCameraId',
        'camera_id',
        'cameraId',
        'id',
      ]);

      if (!earthcamCameraId) {
        skipped += 1;
        return [];
      }

      const existing = existingByEarthCamId.get(earthcamCameraId);
      const name = readFirstString(camera, ['name', 'title', 'label']) || existing?.name || earthcamCameraId;

      return [
        {
          project_id: projectId,
          connection_id: connection.id,
          earthcam_camera_id: earthcamCameraId,
          name,
          location_label:
            readFirstString(camera, ['location_label', 'locationLabel', 'location']) ||
            existing?.location_label ||
            '',
          rail_area: readFirstString(camera, ['rail_area', 'railArea', 'area']) || existing?.rail_area || '',
          live_embed_url:
            readFirstString(camera, ['live_embed_url', 'liveEmbedUrl', 'embed_url', 'embedUrl']) ||
            existing?.live_embed_url ||
            '',
          live_stream_url:
            readFirstString(camera, ['live_stream_url', 'liveStreamUrl', 'stream_url', 'streamUrl', 'url']) ||
            existing?.live_stream_url ||
            '',
          thumbnail_url:
            readFirstString(camera, ['thumbnail_url', 'thumbnailUrl', 'thumbnail']) ||
            existing?.thumbnail_url ||
            '',
          status: normalizeStatus(camera.status) || existing?.status || 'online',
          ptz_enabled: Boolean(camera.ptz_enabled ?? camera.ptzEnabled ?? existing?.ptz_enabled ?? false),
          last_seen_at: now,
        },
      ];
    });

    if (payloads.length > 0) {
      const { error } = await admin
        .from('earthcam_cameras')
        .upsert(payloads, { onConflict: 'project_id,earthcam_camera_id' });

      if (error) return { error: error.message };
    }

    await admin
      .from('earthcam_connections')
      .update({ last_sync_at: now, sync_error: null })
      .eq('id', connection.id);

    await logEarthCamActivity(
      supabase,
      projectId,
      'earthcam_connection',
      connection.id,
      'updated',
      `synced ${payloads.length} EarthCam cameras`,
      user.id
    );

    revalidatePath(`/projects/${projectId}/cameras`);
    return { success: true, data: { synced: payloads.length, skipped } };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Failed to sync EarthCam cameras',
    };
  }
}
