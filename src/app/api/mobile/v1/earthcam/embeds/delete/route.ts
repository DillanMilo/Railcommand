import {
  canManageMobileEarthCam,
  logMobileEarthCamActivity,
  parseMobileEarthCamDelete,
} from '@/lib/mobile-api/earthcam';
import { authenticateMobileRequest, mobileJson, mobileOptions } from '@/lib/mobile-api/auth';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const OPTIONS = mobileOptions;

export async function POST(request: Request): Promise<Response> {
  const context = await authenticateMobileRequest(request);
  if (!context) return mobileJson({ error: 'Not authenticated' }, 401);
  const input = parseMobileEarthCamDelete(await request.json().catch(() => null));
  if (!input) return mobileJson({ error: 'Invalid EarthCam feed identifier' }, 400);
  if (!await canManageMobileEarthCam(context, input.projectId)) {
    return mobileJson({ error: 'Permission denied' }, 403);
  }

  const { data, error } = await createAdminClient()
    .from('earthcam_embeds')
    .delete()
    .eq('id', input.id)
    .eq('project_id', input.projectId)
    .select('id, label')
    .maybeSingle();
  if (error) {
    return mobileJson({ error: 'Could not remove this EarthCam feed' }, error.code === '42501' ? 403 : 500);
  }
  if (!data) return mobileJson({ error: 'EarthCam feed not found' }, 404);
  await logMobileEarthCamActivity(context, input.projectId, data.id, 'deleted', data.label);
  return mobileJson({ id: data.id, deleted: true });
}
