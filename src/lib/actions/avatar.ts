// src/lib/actions/avatar.ts
'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { getAuthenticatedUser } from './permissions-helper';
import type { ActionResult } from './permissions-helper';

const AVATAR_BUCKET = 'avatars';
const MAX_AVATAR_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_AVATAR_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
];

const EXT_BY_TYPE: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

/**
 * Upload a new avatar for the currently authenticated user.
 *
 * Accepts a FormData with a single `file` entry (client-side File).
 * Validates type/size, uploads to the public `avatars` bucket at
 * `${user.id}/avatar-${timestamp}.{ext}`, then updates the user's
 * profile.avatar_url with the resulting public URL.
 */
export async function uploadMyAvatar(
  formData: FormData
): Promise<ActionResult<{ url: string }>> {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    const file = formData.get('file');
    if (!file || !(file instanceof File)) {
      return { error: 'No file provided' };
    }

    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      return {
        error: 'Unsupported file type. Please use PNG, JPEG, WebP, or GIF.',
      };
    }

    if (file.size > MAX_AVATAR_SIZE) {
      return {
        error: `Image is too large. Maximum size is ${MAX_AVATAR_SIZE / (1024 * 1024)}MB.`,
      };
    }

    const ext = EXT_BY_TYPE[file.type] ?? 'png';
    const storagePath = `${user.id}/avatar-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(storagePath, file, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      return {
        error: `Failed to upload avatar: ${uploadError.message}`,
      };
    }

    const { data: urlData } = supabase.storage
      .from(AVATAR_BUCKET)
      .getPublicUrl(storagePath);
    const publicUrl = urlData.publicUrl;

    if (!publicUrl) {
      return { error: 'Could not generate public URL for avatar' };
    }

    const { error: dbError } = await supabase
      .from('profiles')
      .update({ avatar_url: publicUrl })
      .eq('id', user.id);

    if (dbError) {
      // Best-effort cleanup of the orphaned upload
      await supabase.storage.from(AVATAR_BUCKET).remove([storagePath]);
      return { error: `Failed to save avatar: ${dbError.message}` };
    }

    revalidatePath('/settings/profile');
    revalidatePath('/settings');

    return { success: true, data: { url: publicUrl } };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Avatar upload failed',
    };
  }
}
