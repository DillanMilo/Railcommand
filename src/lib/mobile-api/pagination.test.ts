import assert from 'node:assert/strict';
import { describe, it } from 'mocha';
import { mobilePage, parseMobilePage } from './pagination';

describe('Mobile API pagination', () => {
  it('uses a bounded default and caps requested pages', () => {
    assert.deepEqual(parseMobilePage(new URL('https://example.test/api')), { offset: 0, limit: 90 });
    assert.deepEqual(parseMobilePage(new URL('https://example.test/api?offset=25&limit=10')), { offset: 25, limit: 10 });
    assert.deepEqual(parseMobilePage(new URL('https://example.test/api?offset=-1&limit=1000')), { offset: 0, limit: 100 });
  });

  it('returns only the requested page and a has-more marker', () => {
    assert.deepEqual(mobilePage([1, 2, 3], 2), { items: [1, 2], hasMore: true });
    assert.deepEqual(mobilePage([1, 2], 2), { items: [1, 2], hasMore: false });
  });
});
