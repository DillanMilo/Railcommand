import assert from 'node:assert/strict';
import { describe, it } from 'mocha';
import { getDailyLogPhotoAttachments, loadDailyLogPdfPhotos } from './daily-log-photos';
import type { Attachment } from '@/lib/types';

function attachment(id: string, fileType: string, signedUrl?: string): Attachment {
  return {
    id,
    entity_type: 'daily_log',
    entity_id: 'log-1',
    project_id: 'project-1',
    file_name: `${id}.jpg`,
    file_url: signedUrl ? '/private/path' : `https://example.com/${id}`,
    signed_url: signedUrl,
    file_type: fileType,
    file_size: 100,
    photo_category: fileType.startsWith('image/') ? 'standard' : 'document',
    uploaded_by: 'user-1',
    geo_lat: null,
    geo_lng: null,
    captured_at: null,
    created_at: '2026-08-17T10:00:00Z',
  };
}

describe('daily-log PDF photos', () => {
  it('includes renderable image attachments and excludes documents', () => {
    const photos = getDailyLogPhotoAttachments([
      attachment('photo', 'image/jpeg', 'https://signed.example.com/photo'),
      attachment('document', 'application/pdf'),
    ]);
    assert.deepEqual(photos.map((photo) => photo.id), ['photo']);
  });

  it('passes locally retained data URLs directly to the PDF renderer', async () => {
    const photo = attachment('photo', 'image/jpeg');
    photo.file_url = 'data:image/jpeg;base64,/9j/2Q==';

    assert.deepEqual(await loadDailyLogPdfPhotos([photo]), [{
      source: photo.file_url,
      caption: photo.file_name,
    }]);
  });
});
