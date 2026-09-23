import assert from 'node:assert/strict';
import { describe, it } from 'mocha';
import { parseMobileEarthCamDelete, parseMobileEarthCamMutation } from './earthcam';

const projectId = '11111111-1111-4111-8111-111111111111';
const embedId = '22222222-2222-4222-8222-222222222222';
const shareUrl = 'https://share.earthcam.net/example-feed';

describe('mobile EarthCam management validation', () => {
  it('normalizes approved HTTPS share URLs and default labels', () => {
    assert.deepEqual(parseMobileEarthCamMutation({
      projectId,
      label: '  ',
      embedInput: shareUrl,
    }), {
      projectId,
      label: 'EarthCam Feed',
      embedInput: shareUrl,
    });
  });

  it('accepts an EarthCam script embed while storing only its URL', () => {
    const scriptUrl = 'https://share.earthcam.net/embed/example/player';
    const result = parseMobileEarthCamMutation({
      projectId,
      id: embedId,
      label: ' North Yard ',
      embedInput: `<script src="${scriptUrl}"></script>`,
    });
    assert.deepEqual(result, {
      projectId,
      id: embedId,
      label: 'North Yard',
      embedInput: scriptUrl,
    });
  });

  it('rejects foreign hosts, insecure URLs, malformed identifiers, and oversized input', () => {
    assert.equal(parseMobileEarthCamMutation({ projectId, label: 'Other', embedInput: 'https://example.com/feed' }), null);
    assert.equal(parseMobileEarthCamMutation({ projectId, label: 'Other', embedInput: 'http://share.earthcam.net/feed' }), null);
    assert.equal(parseMobileEarthCamMutation({ projectId: 'not-a-uuid', label: 'Other', embedInput: shareUrl }), null);
    assert.equal(parseMobileEarthCamMutation({ projectId, label: 'x'.repeat(121), embedInput: shareUrl }), null);
  });

  it('requires both project and embed UUIDs before deletion', () => {
    assert.deepEqual(parseMobileEarthCamDelete({ projectId, id: embedId }), { projectId, id: embedId });
    assert.equal(parseMobileEarthCamDelete({ projectId, id: 'invalid' }), null);
  });
});
