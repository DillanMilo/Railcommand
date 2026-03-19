'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { getAuthenticatedUser } from './permissions-helper';
import type { ActionResult } from './permissions-helper';
import type { Attachment } from '@/lib/types';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const BUCKET_MAP: Record<string, string> = {
  standard: 'project-photos',
  thermal: 'thermal-photos',
  document: 'project-documents',
};

function getBucket(category: string): string {
  return BUCKET_MAP[category] ?? 'project-photos';
}

export async function uploadAttachment(
  formData: FormData
): Promise<ActionResult<Attachment>> {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    const file = formData.get('file') as File;
    const entityType = formData.get('entity_type') as string;
    const entityId = formData.get('entity_id') as string;
    const projectId = formData.get('project_id') as string;
    const photoCategory =
      (formData.get('photo_category') as string) || 'standard';
    const geoLat = formData.get('geo_lat')
      ? parseFloat(formData.get('geo_lat') as string)
      : null;
    const geoLng = formData.get('geo_lng')
      ? parseFloat(formData.get('geo_lng') as string)
      : null;

    if (!file || !entityType || !entityId || !projectId) {
      return { error: 'Missing required fields' };
    }

    if (file.size > MAX_FILE_SIZE) {
      return { error: `File size exceeds maximum of ${MAX_FILE_SIZE / (1024 * 1024)}MB` };
    }

    const bucket = getBucket(photoCategory);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${projectId}/${entityType}/${entityId}/${Date.now()}-${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(storagePath, file, { contentType: file.type, upsert: false });

    if (uploadError) return { error: uploadError.message };

    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(storagePath);
    const fileUrl = urlData.publicUrl;

    const { data: attachment, error: dbError } = await supabase
      .from('attachments')
      .insert({
        entity_type: entityType,
        entity_id: entityId,
        file_name: file.name,
        file_url: fileUrl,
        file_type: file.type,
        file_size: file.size,
        photo_category: photoCategory,
        geo_lat: geoLat,
        geo_lng: geoLng,
        uploaded_by: user.id,
        captured_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (dbError) {
      await supabase.storage.from(bucket).remove([storagePath]);
      return { error: dbError.message };
    }

    revalidatePath(`/projects/${projectId}`);
    return { success: true, data: attachment as Attachment };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Upload failed',
    };
  }
}

export async function deleteAttachment(
  attachmentId: string,
  projectId: string
): Promise<ActionResult<undefined>> {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    const { data: attachment, error: fetchError } = await supabase
      .from('attachments')
      .select('*')
      .eq('id', attachmentId)
      .single();

    if (fetchError || !attachment) return { error: 'Attachment not found' };
    if (attachment.uploaded_by !== user.id)
      return { error: 'Permission denied' };

    const bucket = getBucket(attachment.photo_category);
    const urlParts = attachment.file_url.split(`/${bucket}/`);
    if (urlParts.length === 2) {
      await supabase.storage.from(bucket).remove([urlParts[1]]);
    }

    const { error: deleteError } = await supabase
      .from('attachments')
      .delete()
      .eq('id', attachmentId);

    if (deleteError) return { error: deleteError.message };

    revalidatePath(`/projects/${projectId}`);
    return { success: true, data: undefined };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Delete failed',
    };
  }
}

/**
 * Generate a signed URL for a private file in Supabase Storage.
 * The URL is valid for 1 hour (3600 seconds).
 */
export async function getSignedUrl(
  attachmentId: string
): Promise<ActionResult<string>> {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    const { data: attachment, error: fetchError } = await supabase
      .from('attachments')
      .select('*')
      .eq('id', attachmentId)
      .single();

    if (fetchError || !attachment) return { error: 'Attachment not found' };

    const bucket = getBucket(attachment.photo_category);
    // Extract the storage path from the public URL
    const urlParts = attachment.file_url.split(`/${bucket}/`);
    if (urlParts.length !== 2) return { error: 'Invalid file URL' };

    const storagePath = urlParts[1];
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(storagePath, 3600); // 1 hour expiry

    if (error || !data?.signedUrl) return { error: error?.message ?? 'Failed to generate URL' };

    return { success: true, data: data.signedUrl };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Failed to generate signed URL',
    };
  }
}

/**
 * Fetch all attachments for a given entity (submittal, rfi, daily_log, punch_list).
 */
export async function getAttachments(
  entityType: string,
  entityId: string
): Promise<ActionResult<Attachment[]>> {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    const { data, error } = await supabase
      .from('attachments')
      .select('*')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false });

    if (error) return { error: error.message };

    return { success: true, data: (data ?? []) as Attachment[] };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Failed to fetch attachments',
    };
  }
}
