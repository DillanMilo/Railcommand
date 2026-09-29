import {
  canManageMobileEarthCam,
  logMobileEarthCamActivity,
  parseMobileEarthCamMutation,
  toMobileEarthCamEmbed,
} from '@/lib/mobile-api/earthcam';
import { authenticateMobileRequest, mobileJson, mobileOptions } from '@/lib/mobile-api/auth';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const OPTIONS = mobileOptions;

export async function POST(request: Request): Promise<Response> {
  const context = await authenticateMobileRequest(request);
  if (!context) return mobileJson({ error: 'Not authenticated' }, 401);
  const input = parseMobileEarthCamMutation(await request.json().catch(() => null));
  if (!input) return mobileJson({ error: 'Enter a valid HTTPS EarthCam share link' }, 400);
  if (!await canManageMobileEarthCam(context, input.projectId)) {
    return mobileJson({ error: 'Permission denied' }, 403);
  }

  const admin = createAdminClient();
  const query = input.id
    ? admin
      .from('earthcam_embeds')
      .update({ label: input.label, url: input.embedInput })
      .eq('id', input.id)
      .eq('project_id', input.projectId)
      .select('id, project_id, label, url, created_at')
      .single()
    : admin
      .from('earthcam_embeds')
      .insert({ project_id: input.projectId, label: input.label, url: input.embedInput })
      .select('id, project_id, label, url, created_at')
      .single();
  const { data, error } = await query;
  if (error || !data) {
    return mobileJson({ error: 'Could not save this EarthCam feed' }, error?.code === '42501' ? 403 : 500);
  }
  await logMobileEarthCamActivity(
    context,
    input.projectId,
    data.id,
    input.id ? 'updated' : 'created',
    input.label,
  );
  return mobileJson(toMobileEarthCamEmbed(data), input.id ? 200 : 201);
}
