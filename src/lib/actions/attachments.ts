'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { checkPermission, checkProjectMembership, getAuthenticatedUser } from './permissions-helper';
import type { ActionResult } from './permissions-helper';
import type { Attachment } from '@/lib/types';
import type { DocumentDownloadFile } from '@/lib/document-download';
import { getBucket, buildStoragePath } from '@/lib/attachments-shared';
import { ACTIONS } from '@/lib/permissions';

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

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
    const storagePath = buildStoragePath(projectId, entityType, entityId, file.name);

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
        project_id: projectId,
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

/**
 * Record an attachment row after the browser has already uploaded the file
 * directly to Supabase Storage. This avoids routing file bytes through
 * Vercel's Server Action body (which caps well below real project file
 * sizes even on Pro + Fluid Compute).
 *
 * The payload is tiny (path + metadata), so it passes Vercel's body limit
 * trivially. RLS on the attachments table still enforces project membership.
 */
export async function recordAttachment(input: {
  entityType: string;
  entityId: string;
  projectId: string;
  storagePath: string;
  bucket: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  photoCategory?: string;
  geoLat?: number | null;
  geoLng?: number | null;
  capturedAt?: string | null;
}): Promise<ActionResult<Attachment>> {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    if (!input.entityType || !input.entityId || !input.projectId || !input.storagePath) {
      return { error: 'Missing required fields' };
    }

    if (input.fileSize > MAX_FILE_SIZE) {
      return { error: `File size exceeds maximum of ${MAX_FILE_SIZE / (1024 * 1024)}MB` };
    }

    const { data: urlData } = supabase.storage
      .from(input.bucket)
      .getPublicUrl(input.storagePath);
    const fileUrl = urlData.publicUrl;

    const { data: attachment, error: dbError } = await supabase
      .from('attachments')
      .insert({
        entity_type: input.entityType,
        entity_id: input.entityId,
        project_id: input.projectId,
        file_name: input.fileName,
        file_url: fileUrl,
        file_type: input.fileType,
        file_size: input.fileSize,
        photo_category: input.photoCategory ?? 'document',
        geo_lat: input.geoLat ?? null,
        geo_lng: input.geoLng ?? null,
        uploaded_by: user.id,
        captured_at: input.capturedAt ?? new Date().toISOString(),
      })
      .select()
      .single();

    if (dbError) {
      // Best-effort cleanup — orphan object otherwise
      await supabase.storage.from(input.bucket).remove([input.storagePath]);
      return { error: dbError.message };
    }

    revalidatePath(`/projects/${input.projectId}`);
    return { success: true, data: attachment as Attachment };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Failed to record attachment',
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

    if (fetchError || !attachment || attachment.project_id !== projectId) {
      return { error: 'Attachment not found' };
    }

    const isPhoto =
      attachment.file_type?.startsWith('image/') || attachment.photo_category === 'thermal';
    if (attachment.uploaded_by !== user.id) {
      if (!isPhoto) return { error: 'Permission denied' };

      const permission = await checkPermission(
        supabase,
        user.id,
        projectId,
        ACTIONS.PHOTO_DELETE
      );
      if (!permission.allowed) return { error: permission.error };
    }

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

/** Buckets that require signed URLs (private buckets). */
const PRIVATE_BUCKETS = new Set(['project-photos', 'thermal-photos', 'project-documents']);

/**
 * Resolve all files belonging to selected project documents in one authenticated
 * request. Document ownership is checked before attachment URLs are returned.
 */
export async function getDocumentAttachmentsForDownload(
  projectId: string,
  documentIds: string[],
): Promise<ActionResult<DocumentDownloadFile[]>> {
  try {
    const ids = [...new Set(documentIds.filter(Boolean))];
    if (!projectId || ids.length === 0) return { error: 'Select at least one document' };
    if (ids.length > 500) return { error: 'Too many documents selected' };

    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    const access = await checkProjectMembership(supabase, user.id, projectId);
    if (!access.isMember) return { error: access.error };

    const { data: documents, error: documentsError } = await supabase
      .from('project_documents')
      .select('id, number, title')
      .eq('project_id', projectId)
      .in('id', ids);

    if (documentsError) return { error: documentsError.message };
    if (!documents || documents.length !== ids.length) {
      return { error: 'One or more selected documents could not be found' };
    }

    const documentById = new Map(documents.map((document) => [document.id, document]));
    const { data: attachments, error: attachmentsError } = await supabase
      .from('attachments')
      .select('id, entity_id, file_name, file_url, file_size, photo_category, created_at')
      .eq('project_id', projectId)
      .eq('entity_type', 'project_document')
      .in('entity_id', ids)
      .order('created_at', { ascending: true });

    if (attachmentsError) return { error: attachmentsError.message };
    if (!attachments || attachments.length === 0) return { success: true, data: [] };

    const resolvedUrls = new Map<string, string>();
    const grouped: Record<string, { id: string; path: string }[]> = {};

    for (const attachment of attachments) {
      const bucket = getBucket(attachment.photo_category);
      if (!PRIVATE_BUCKETS.has(bucket)) {
        resolvedUrls.set(attachment.id, attachment.file_url);
        continue;
      }

      const urlParts = attachment.file_url.split(`/${bucket}/`);
      if (urlParts.length !== 2 || !urlParts[1]) {
        return { error: `Invalid storage URL for ${attachment.file_name}` };
      }

      if (!grouped[bucket]) grouped[bucket] = [];
      grouped[bucket].push({ id: attachment.id, path: urlParts[1] });
    }

    for (const [bucket, items] of Object.entries(grouped)) {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrls(items.map((item) => item.path), 3600);

      if (error || !data) return { error: error?.message ?? 'Failed to prepare files' };

      for (let index = 0; index < items.length; index++) {
        const signedUrl = data[index]?.signedUrl;
        if (!signedUrl) return { error: data[index]?.error ?? 'Failed to prepare a file' };
        resolvedUrls.set(items[index].id, signedUrl);
      }
    }

    const files: DocumentDownloadFile[] = attachments.map((attachment) => {
      const document = documentById.get(attachment.entity_id)!;
      return {
        id: attachment.id,
        document_id: attachment.entity_id,
        document_number: document.number,
        document_title: document.title,
        file_name: attachment.file_name,
        file_size: attachment.file_size,
        download_url: resolvedUrls.get(attachment.id)!,
      };
    });

    return { success: true, data: files };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Failed to prepare document download',
    };
  }
}

/**
 * Fetch all attachments for an entity and batch-resolve signed URLs for
 * private buckets (project-photos, thermal-photos, project-documents).
 *
 * Attachments in public buckets (avatars) are returned
 * with `signed_url` left undefined — callers should fall back to `file_url`.
 */
export async function getAttachmentsWithSignedUrls(
  entityType: string,
  entityId: string
): Promise<ActionResult<Attachment[]>> {
  try {
    const result = await getAttachments(entityType, entityId);
    if (result.error || !result.data) return result;

    const attachments = result.data;
    if (attachments.length === 0) return result;

    // Group attachments by private bucket so we can batch createSignedUrls
    const grouped: Record<string, { index: number; path: string }[]> = {};
    for (let i = 0; i < attachments.length; i++) {
      const att = attachments[i];
      const bucket = getBucket(att.photo_category);
      if (!PRIVATE_BUCKETS.has(bucket)) continue;

      const urlParts = att.file_url.split(`/${bucket}/`);
      if (urlParts.length !== 2) continue;

      if (!grouped[bucket]) grouped[bucket] = [];
      grouped[bucket].push({ index: i, path: urlParts[1] });
    }

    // Batch-generate signed URLs per bucket
    const supabase = await createClient();
    const bucketEntries = Object.entries(grouped);

    await Promise.all(
      bucketEntries.map(async ([bucket, items]) => {
        const paths = items.map((item) => item.path);
        const { data, error } = await supabase.storage
          .from(bucket)
          .createSignedUrls(paths, 3600); // 1 hour expiry

        if (error || !data) return;

        for (let j = 0; j < data.length; j++) {
          const signedUrl = data[j]?.signedUrl ?? undefined;
          if (signedUrl) {
            attachments[items[j].index] = {
              ...attachments[items[j].index],
              signed_url: signedUrl,
            };
          }
        }
      })
    );

    return { success: true, data: attachments };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Failed to fetch attachments with signed URLs',
    };
  }
}
