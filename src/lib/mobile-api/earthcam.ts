import type { MobileEarthCamEmbed } from '@railcommand/domain';
import { extractEarthCamEmbedUrl } from '@/lib/earthcam/embed';
import type { MobileAuthenticatedContext } from '@/lib/mobile-api/auth';
import { ACTIONS, canPerformWithProjectEdit } from '@/lib/permissions';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type EarthCamMutation = {
  projectId: string;
  id?: string;
  label: string;
  embedInput: string;
};

export function parseMobileEarthCamMutation(value: unknown): EarthCamMutation | null {
  if (!value || typeof value !== 'object') return null;
  const input = value as Partial<EarthCamMutation>;
  if (!input.projectId || !UUID.test(input.projectId)) return null;
  if (input.id !== undefined && !UUID.test(input.id)) return null;
  if (typeof input.label !== 'string' || input.label.trim().length > 120) return null;
  if (typeof input.embedInput !== 'string' || input.embedInput.length > 4_000) return null;
  try {
    const { url } = extractEarthCamEmbedUrl(input.embedInput);
    return {
      projectId: input.projectId,
      ...(input.id ? { id: input.id } : {}),
      label: input.label.trim() || 'EarthCam Feed',
      embedInput: url,
    };
  } catch {
    return null;
  }
}

export function parseMobileEarthCamDelete(value: unknown): { projectId: string; id: string } | null {
  if (!value || typeof value !== 'object') return null;
  const input = value as { projectId?: unknown; id?: unknown };
  return typeof input.projectId === 'string'
    && typeof input.id === 'string'
    && UUID.test(input.projectId)
    && UUID.test(input.id)
    ? { projectId: input.projectId, id: input.id }
    : null;
}

export async function canManageMobileEarthCam(
  context: MobileAuthenticatedContext,
  projectId: string,
): Promise<boolean> {
  const [{ data: profile }, { data: membership }] = await Promise.all([
    context.supabase.from('profiles').select('role').eq('id', context.user.id).single(),
    context.supabase
      .from('project_members')
      .select('project_role, can_edit')
      .eq('project_id', projectId)
      .eq('profile_id', context.user.id)
      .maybeSingle(),
  ]);
  if (profile?.role === 'admin') return true;
  if (!membership) return false;
  return canPerformWithProjectEdit(
    membership.project_role,
    membership.can_edit,
    ACTIONS.EARTHCAM_EMBED_MANAGE,
  );
}

export function toMobileEarthCamEmbed(value: {
  id: string;
  project_id: string;
  label: string;
  url: string;
  created_at: string;
}): MobileEarthCamEmbed {
  return {
    id: value.id,
    projectId: value.project_id,
    label: value.label,
    url: value.url,
    createdAt: value.created_at,
  };
}

export async function logMobileEarthCamActivity(
  context: MobileAuthenticatedContext,
  projectId: string,
  id: string,
  action: 'created' | 'updated' | 'deleted',
  label: string,
): Promise<void> {
  await context.supabase.rpc('log_activity', {
    p_project_id: projectId,
    p_entity_type: 'earthcam_camera',
    p_entity_id: id,
    p_action: action,
    p_description: `${action} EarthCam embed ${label}`,
    p_performed_by: context.user.id,
  });
}
