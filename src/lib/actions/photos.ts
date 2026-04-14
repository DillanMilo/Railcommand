'use server';

import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedUser } from './permissions-helper';
import type { ActionResult } from './permissions-helper';
import type { Attachment } from '@/lib/types';

const PRIVATE_BUCKETS = new Set(['project-photos', 'thermal-photos']);

const BUCKET_MAP: Record<string, string> = {
  standard: 'project-photos',
  thermal: 'thermal-photos',
  document: 'project-documents',
};

function getBucket(category: string): string {
  return BUCKET_MAP[category] ?? 'project-photos';
}

/**
 * Fetch all photo attachments for a project by querying entity tables
 * for IDs belonging to the project, then fetching matching attachments.
 */
export async function getProjectPhotos(
  projectId: string
): Promise<ActionResult<Attachment[]>> {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    // Collect entity IDs from each table in parallel
    const [submittals, rfis, dailyLogs, punchList, safetyIncidents] = await Promise.all([
      supabase.from('submittals').select('id').eq('project_id', projectId),
      supabase.from('rfis').select('id').eq('project_id', projectId),
      supabase.from('daily_logs').select('id').eq('project_id', projectId),
      supabase.from('punch_list_items').select('id').eq('project_id', projectId),
      supabase.from('safety_incidents').select('id').eq('project_id', projectId),
    ]);

    const entityIds = [
      ...(submittals.data ?? []).map((r) => r.id),
      ...(rfis.data ?? []).map((r) => r.id),
      ...(dailyLogs.data ?? []).map((r) => r.id),
      ...(punchList.data ?? []).map((r) => r.id),
      ...(safetyIncidents.data ?? []).map((r) => r.id),
      projectId, // for project_photo entity_type
    ];

    if (entityIds.length === 0) {
      return { success: true, data: [] };
    }

    // Fetch all attachments for these entity IDs that are images
    const { data: attachments, error: fetchError } = await supabase
      .from('attachments')
      .select('*')
      .in('entity_id', entityIds)
      .order('created_at', { ascending: false });

    if (fetchError) return { error: fetchError.message };

    // Filter to images only
    const photos = (attachments ?? []).filter(
      (a: Attachment) => a.file_type.startsWith('image/') || a.photo_category === 'thermal'
    ) as Attachment[];

    if (photos.length === 0) {
      return { success: true, data: [] };
    }

    // Batch-resolve signed URLs for private buckets
    const grouped: Record<string, { index: number; path: string }[]> = {};
    for (let i = 0; i < photos.length; i++) {
      const att = photos[i];
      const bucket = getBucket(att.photo_category);
      if (!PRIVATE_BUCKETS.has(bucket)) continue;

      const urlParts = att.file_url.split(`/${bucket}/`);
      if (urlParts.length !== 2) continue;

      if (!grouped[bucket]) grouped[bucket] = [];
      grouped[bucket].push({ index: i, path: urlParts[1] });
    }

    await Promise.all(
      Object.entries(grouped).map(async ([bucket, items]) => {
        const paths = items.map((item) => item.path);
        const { data, error } = await supabase.storage
          .from(bucket)
          .createSignedUrls(paths, 3600);

        if (error || !data) return;

        for (let j = 0; j < data.length; j++) {
          if (data[j].signedUrl) {
            photos[items[j].index] = {
              ...photos[items[j].index],
              signed_url: data[j].signedUrl,
            };
          }
        }
      })
    );

    return { success: true, data: photos };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Failed to fetch project photos',
    };
  }
}
