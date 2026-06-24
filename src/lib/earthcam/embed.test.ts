import { strict as assert } from 'node:assert';
import { extractEarthCamEmbedUrl } from './embed';

const shareUrl = 'https://share.earthcam.net/tJ90CoLmq7TzrY396Yd88CKvRQt1vEA9ny7MYZgQXUg';
const scriptUrl = 'https://share.earthcam.net/embed/tJ90CoLmq7TzrY396Yd88CBZ6eUvO_kGBU2Oymm58jU/tJ90CoLmq7TzrY396Yd88Ju_fYJhq66H9_yXQ-88-eI';

describe('EarthCam embed URL extraction', () => {
  it('accepts a direct EarthCam share URL', () => {
    assert.deepEqual(extractEarthCamEmbedUrl(shareUrl), {
      url: shareUrl,
      source: 'url',
    });
  });

  it('extracts the src URL from a full EarthCam script embed', () => {
    const embedCode = `<script class='earthcam-embed' aria-label='earthcam-embed' type='text/javascript' src='${scriptUrl}'></script>`;

    assert.deepEqual(extractEarthCamEmbedUrl(embedCode), {
      url: scriptUrl,
      source: 'script',
    });
  });

  it('rejects non-EarthCam hosts', () => {
    assert.throws(
      () => extractEarthCamEmbedUrl('https://example.com/camera'),
      /share\.earthcam\.net/
    );
  });

  it('rejects non-HTTPS EarthCam URLs', () => {
    assert.throws(
      () => extractEarthCamEmbedUrl('http://share.earthcam.net/example'),
      /https/
    );
  });
});
