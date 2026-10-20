import type { SupabaseClient } from '@supabase/supabase-js';
import type { Attachment } from '@/lib/types';
import { getAuthenticatedUser, checkProjectMembership } from './actions/permissions-helper';
import { getBucket } from './attachments-shared';
import { PROJECT_PHOTO_PAGE_SIZE } from './project-photo-policy';
import type { ProjectPhotoPage, ProjectPhotoPageOptions } from './project-photo-page';

export class PhotoPageError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

/** Caller uses a cookie-authenticated client, never a service-role client. RLS
 * applies to the attachment query and Storage authorizes every signed path. */
export async function getProjectPhotoPage(supabase: SupabaseClient, projectId: string, options: ProjectPhotoPageOptions) {
  const start = performance.now();
  const timings: Record<string, number> = {};
  const { user, error: authError } = await getAuthenticatedUser(supabase);
  timings.auth = performance.now() - start;
  if (authError || !user) throw new PhotoPageError('Sign in to view project photos.', 401);
  const membershipStart = performance.now();
  const membership = await checkProjectMembership(supabase, user.id, projectId);
  timings.membership = performance.now() - membershipStart;
  if (!membership.isMember) throw new PhotoPageError('You do not have access to this project.', 403);

  const queryStart = performance.now();
  let query = supabase.from('attachments').select('*')
    .eq('project_id', projectId)
    .or('file_type.like.image/*,photo_category.eq.thermal')
    .order('created_at', { ascending: false }).order('id', { ascending: false })
    .limit(PROJECT_PHOTO_PAGE_SIZE + 1);
  if (options.category !== 'all') query = query.eq('photo_category', options.category);
  if (options.cursor) {
    // Cursor values are validated by the transport before entering PostgREST syntax.
    const { createdAt, id } = options.cursor;
    query = query.or(`created_at.lt.${createdAt},and(created_at.eq.${createdAt},id.lt.${id})`);
  }
  const { data: rows, error } = await query;
  timings.query = performance.now() - queryStart;
  if (error || !rows) throw new PhotoPageError('Could not load photos. Please retry.', 503);
  const photos = (rows as Attachment[]).slice(0, PROJECT_PHOTO_PAGE_SIZE);
  const last = photos.at(-1);
  const nextCursor = rows.length > PROJECT_PHOTO_PAGE_SIZE && last ? { createdAt: last.created_at, id: last.id } : null;

  const signingStart = performance.now();
  const groups = new Map<string, { index: number; path: string }[]>();
  for (const [index, photo] of photos.entries()) {
    const bucket = getBucket(photo.photo_category);
    if (!['project-photos', 'thermal-photos'].includes(bucket)) continue;
    photos[index] = { ...photo, signed_url_error: 'Preview unavailable. Refresh photos to retry.' };
    try {
      const url = new URL(photo.file_url);
      const matchingPrefix = ['public', 'sign', 'authenticated']
        .map((access) => `/storage/v1/object/${access}/${bucket}/`)
        .find((value) => url.pathname.startsWith(value));
      if (!matchingPrefix) continue;
      const path = decodeURIComponent(url.pathname.slice(matchingPrefix.length));
      if (!path.startsWith(`${projectId}/`)) continue;
      const group = groups.get(bucket) ?? [];
      group.push({ index, path });
      groups.set(bucket, group);
    } catch { /* A bad stored path must not hide the attachment or expose a raw private URL. */ }
  }
  await Promise.all([...groups].map(async ([bucket, items]) => {
    try {
      const signed = await supabase.storage.from(bucket).createSignedUrls(items.map((item) => item.path), 3600);
      if (signed.error) return;
      items.forEach(({ index, path }) => {
        const result = signed.data?.find((entry) => entry.path === path);
        if (!result?.signedUrl || result.error) return;
        photos[index] = { ...photos[index], signed_url: result.signedUrl, thumbnail_url: result.signedUrl, signed_url_error: undefined };
      });
    } catch { /* Per-photo retry state remains visible after a storage transport failure. */ }
  }));
  timings.signing = performance.now() - signingStart;
  timings.total = performance.now() - start;
  const page: ProjectPhotoPage = { data: photos, nextCursor };
  return { page, serverTiming: Object.entries(timings).map(([name, duration]) => `${name};dur=${duration.toFixed(1)}`).join(', ') };
}
