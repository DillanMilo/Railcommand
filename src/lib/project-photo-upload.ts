import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { validateProjectPhoto } from '@/lib/project-photo-policy';
import { checkProjectMembership, getAuthenticatedUser } from './actions/permissions-helper';

const metadataSchema = z.object({
  userId: z.string().uuid(),
  projectId: z.string().uuid(),
  operationId: z.string().uuid(),
  fileName: z.string().min(1).max(500),
  geoLat: z.number().min(-90).max(90).nullable(),
  geoLng: z.number().min(-180).max(180).nullable(),
  capturedAt: z.string().datetime(),
});

type UploadResult = { success: true } | { success?: never; error: string; retryable: boolean };

// Bounded server-action body (<=500 KB file), no new bucket, service-role key,
// public cache, image transformation service, or database migration required.
export async function processProjectPhotoUpload(
  formData: FormData,
  dependencies: { createClient: () => Promise<SupabaseClient>; revalidatePath: (path: string) => void }
): Promise<UploadResult> {
  let rawMetadata: unknown;
  try {
    rawMetadata = JSON.parse(String(formData.get('metadata')));
  } catch {
    return { error: 'Invalid project photo metadata.', retryable: false };
  }
  try {
    const metadata = metadataSchema.safeParse(rawMetadata);
    const file = formData.get('file');
    if (!metadata.success || !(file instanceof File)) {
      return { error: 'Invalid project photo.', retryable: false };
    }
    const validationError = validateProjectPhoto(file);
    if (validationError) return { error: validationError, retryable: false };
    const input = metadata.data;
    const supabase = await dependencies.createClient();
    const { user } = await getAuthenticatedUser(supabase);
    if (!user) return { error: 'Sign in again to upload this saved photo.', retryable: true };
    if (user.id !== input.userId) return { error: 'This photo belongs to a different signed-in user.', retryable: false };
    const membership = await checkProjectMembership(supabase, user.id, input.projectId);
    if (!membership.isMember) return { error: membership.error, retryable: false };

    const bytes = Buffer.from(await file.arrayBuffer());
    // Verify the declared type against the file signature before storing it.
    const isImage = file.type === 'image/jpeg'
      ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
      : file.type === 'image/png'
        ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
    if (!isImage) return { error: 'The selected file is not a valid supported image.', retryable: false };

    const digest = createHash('sha256').update(bytes).digest('hex');
    const extension = file.type === 'image/jpeg' ? 'jpeg' : file.type.split('/')[1];
    const path = `${input.projectId}/project_photo/${input.projectId}/${user.id}/${input.operationId}-${digest}.${extension}`;
    const fileUrl = `/storage/v1/object/public/project-photos/${path}`;
    const idempotencyKey = `project-photo:${input.operationId}`;
    const readExisting = () => supabase.from('attachments')
      .select('id, project_id, entity_type, entity_id, uploaded_by, file_url, file_size, file_type, idempotency_key')
      .eq('id', input.operationId).maybeSingle();
    const matches = (row: NonNullable<Awaited<ReturnType<typeof readExisting>>['data']>) =>
      row.project_id === input.projectId && row.entity_id === input.projectId
      && row.entity_type === 'project_photo' && row.uploaded_by === user.id
      && row.file_url === fileUrl && row.file_size === file.size
      && row.file_type === file.type && row.idempotency_key === idempotencyKey;

    const existing = await readExisting();
    if (existing.error) return { error: existing.error.message, retryable: true };
    if (existing.data) {
      return matches(existing.data) ? { success: true }
        : { error: 'This upload ID was already used for another photo. The saved photo has been retained.', retryable: false };
    }

    // No upsert: concurrent retries can never overwrite an object. The hash in
    // the path binds its bytes to this operation. Reuse an existing object after
    // a lost response instead of creating another copy.
    const upload = await supabase.storage.from('project-photos').upload(path, bytes, {
      contentType: file.type, upsert: false, cacheControl: '3600',
    });
    if (upload.error && String(upload.error.statusCode) !== '409' && !['Duplicate', 'ResourceAlreadyExists'].includes(String('code' in upload.error ? upload.error.code : ''))) {
      return { error: upload.error.message, retryable: !['400', '401', '403', '413'].includes(String(upload.error.statusCode)) };
    }

    // RLS revalidates write access. The primary key and existing per-user
    // idempotency index resolve concurrent delivery without overwriting rows.
    const inserted = await supabase.from('attachments').insert({
      id: input.operationId, entity_type: 'project_photo', entity_id: input.projectId,
      project_id: input.projectId, uploaded_by: user.id, idempotency_key: idempotencyKey,
      file_name: input.fileName, file_url: fileUrl, file_size: file.size, file_type: file.type,
      photo_category: 'standard', geo_lat: input.geoLat, geo_lng: input.geoLng,
      captured_at: input.capturedAt,
    });
    if (inserted.error) {
      const recovered = await readExisting();
      if (!recovered.data || !matches(recovered.data)) {
        // Do not delete an object after an uncertain response: a concurrent
        // insert may already reference it. Retain local work for recovery.
        return { error: inserted.error.message, retryable: !/^(22|23|42501)/.test(inserted.error.code) };
      }
    }
    dependencies.revalidatePath(`/projects/${input.projectId}/photos`);
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Photo upload failed.', retryable: true };
  }
}
