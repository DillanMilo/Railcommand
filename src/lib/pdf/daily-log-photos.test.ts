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

    assert.deepEqual(await loadDailyLogPdfPhotos([photo], '2026-10-29'), [{
      source: photo.file_url,
      caption: '10/29/2026',
    }]);
  });
  it('does not silently generate a report missing an unavailable photo',async()=>{
    const old=globalThis.fetch;
    try { globalThis.fetch=async()=>new Response('',{status:403}); await assert.rejects(loadDailyLogPdfPhotos([attachment('missing','image/jpeg')], '2026-10-29'), /Could not include "missing.jpg"/); }
    finally { globalThis.fetch=old; }
  });
  it('reports unsupported photo formats and signed URL failures instead of omitting them',async()=>{
    await assert.rejects(loadDailyLogPdfPhotos([attachment('iphone','image/heic')], '2026-10-29'), /JPEG or PNG/);
    const photo={...attachment('private','image/jpeg'),signed_url_error:'Refresh required'};
    await assert.rejects(loadDailyLogPdfPhotos([photo], '2026-10-29'), /private.jpg/);
  });

});

describe('DFR authored photo captions', () => {
  it('uses an optional caption without renaming the underlying file or changing the source', async () => {
    const photo = { ...attachment('image', 'image/jpeg'), caption: 'South entrance paving', file_url: 'data:image/jpeg;base64,/9j/2Q==' };
    const loaded = await loadDailyLogPdfPhotos([photo], '2026-10-29');
    assert.deepEqual(loaded, [{ source: photo.file_url, caption: 'South entrance paving' }]);
    assert.equal(photo.file_name, 'image.jpg');
  });
});
