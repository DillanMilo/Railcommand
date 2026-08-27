import type { Attachment } from '@/lib/types';

export interface DailyLogPdfPhoto {
  source: string;
  caption: string;
}

export function getDailyLogPhotoAttachments(attachments: Attachment[]): Attachment[] {
  return attachments.filter((attachment) =>
    ['image/jpeg', 'image/png'].includes((attachment.file_type ?? '').toLowerCase()) &&
    Boolean(attachment.signed_url ?? attachment.file_url)
  );
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Could not read photo'));
    reader.readAsDataURL(blob);
  });
}

export async function loadDailyLogPdfPhotos(attachments: Attachment[]): Promise<DailyLogPdfPhoto[]> {
  const photos = getDailyLogPhotoAttachments(attachments);
  const loaded = await Promise.all(photos.map(async (photo) => {
    try {
      const source = photo.signed_url ?? photo.file_url;
      if (source.startsWith('data:')) {
        return { source, caption: photo.file_name } satisfies DailyLogPdfPhoto;
      }

      const response = await fetch(
        source,
        source.startsWith('http:') || source.startsWith('https:') ? { cache: 'no-store' } : undefined
      );
      if (!response.ok) return null;
      return {
        source: await blobToDataUrl(await response.blob()),
        caption: photo.file_name,
      } satisfies DailyLogPdfPhoto;
    } catch {
      return null;
    }
  }));

  return loaded.filter((photo): photo is DailyLogPdfPhoto => photo !== null);
}
