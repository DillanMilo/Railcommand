import { recordAttachment } from '@/lib/actions/attachments';
import { createClient as createSupabaseBrowserClient } from '@/lib/supabase/client';
import { getBucket, sanitizeFilename } from '@/lib/attachments-shared';
import { compressImage } from '@/lib/compressImage';
import type { PhotoCategory, Attachment } from '@/lib/types';

type Input = { file: File; category: PhotoCategory; entityType: string; entityId: string; projectId: string; geoLat?: number | null; geoLng?: number | null };
type Prepared = { id: string; file: Promise<File>; path: string };
// Page-lifetime retry state only. Offline persistence remains in native field tools.
const prepared = new WeakMap<File, Map<string, Prepared>>();
export async function uploadFileWithReceipt(input: Input): Promise<{ success?: boolean; data?: { attachment: Attachment; file: File }; error?: string }> {
  const supabase = createSupabaseBrowserClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) return { error: 'Reconnect and sign in before retrying. The selected file remains on this page.' };
  const scope = [auth.user.id,input.projectId,input.entityType,input.entityId,input.category].join(':');
  const choices = prepared.get(input.file) ?? new Map<string, Prepared>();
  prepared.set(input.file, choices);
  let pending = choices.get(scope);
  if (!pending) {
    const id = crypto.randomUUID();
    pending = { id, file: input.category === 'document' ? Promise.resolve(input.file) : compressImage(input.file,input.category), path: `${input.projectId}/${input.entityType}/${input.entityId}/${id}-${sanitizeFilename(input.file.name)}` };
    choices.set(scope,pending);
  }
  let file: File;
  try { file = await pending.file; } catch { choices.delete(scope); return { error: 'Could not prepare the photo. The original remains on this page; try again.' }; }
  // PhotoUpload replaces the original with the compressed file after success.
  // Retain the same receipt when the surrounding form saves that file again.
  prepared.set(file, choices);
  const stillCurrent = async () => (await supabase.auth.getUser()).data.user?.id === auth.user!.id;
  if (!await stillCurrent()) return { error: 'The account changed. No upload was started.' };
  const bucket = getBucket(input.category);
  const { error: uploadError } = await supabase.storage.from(bucket).upload(pending.path,file,{contentType:file.type,upsert:false});
  if (uploadError && !/already exists|duplicate/i.test(uploadError.message) && String((uploadError as { statusCode?: string }).statusCode) !== '409') return { error: 'Upload could not be confirmed. Keep this page open and retry; the selected file is preserved.' };
  if (!await stillCurrent()) return { error: 'The account changed. The upload has not been attached.' };
  const result = await recordAttachment({ clientId:pending.id,entityType:input.entityType,entityId:input.entityId,projectId:input.projectId,storagePath:pending.path,bucket,fileName:file.name,fileType:file.type,fileSize:file.size,photoCategory:input.category,geoLat:input.geoLat??null,geoLng:input.geoLng??null });
  if (result.error || !result.data) return { error: result.error ?? 'Upload receipt could not be confirmed. Keep this page open and retry.' };
  return {success:true,data:{attachment:result.data,file}};
}
