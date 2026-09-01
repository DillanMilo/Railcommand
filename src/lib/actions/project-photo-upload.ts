'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { processProjectPhotoUpload } from '@/lib/project-photo-upload';

export async function uploadProjectPhoto(formData: FormData) {
  return processProjectPhotoUpload(formData, { createClient, revalidatePath });
}
