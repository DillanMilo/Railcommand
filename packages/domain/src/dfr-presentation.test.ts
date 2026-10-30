import assert from 'node:assert/strict';
import { describe, it } from 'mocha';
import { formatDfrDate, formatDfrTimestamp, dfrPhotoLabel, isValidPhotoCaption, dfrDateInputToIso, formatDfrDateInput } from './dfr-presentation';

describe('DFR display conventions', () => {
  it('keeps date-only records on their calendar day across US and non-US timezones', () => {
    const original = process.env.TZ;
    try {
      for (const zone of ['America/Chicago', 'America/Los_Angeles', 'UTC', 'Pacific/Auckland']) {
        process.env.TZ = zone;
        assert.equal(formatDfrDate('2026-10-29'), '10/29/2026');
        assert.equal(formatDfrDate('2024-02-29'), '02/29/2024');
        assert.equal(formatDfrDate('2026-02-29'), '—');
        assert.equal(formatDfrDate(null), '—');
      }
      process.env.TZ = 'America/Chicago';
      assert.equal(formatDfrTimestamp('2026-10-30T02:05:00Z'), '10/29/2026, 09:05 PM');
    } finally { if (original === undefined) delete process.env.TZ; else process.env.TZ = original; }
  });
  it('uses the report date for old rows and blank captions while preserving authored text', () => {
    assert.equal(dfrPhotoLabel('2026-10-29'), '10/29/2026');
    assert.equal(dfrPhotoLabel('2026-10-29', '   '), '10/29/2026');
    assert.equal(dfrPhotoLabel('2026-10-29', '  South entrance paving  '), 'South entrance paving');
    assert.equal(isValidPhotoCaption(undefined), true);
    assert.equal(isValidPhotoCaption('a'.repeat(500)), true);
    assert.equal(isValidPhotoCaption('a'.repeat(501)), false);
    assert.equal(isValidPhotoCaption({ caption: 'unsafe' }), false);
  });
});

describe('native DFR date entry', () => {
  it('displays US dates but queues the original ISO contract, retaining partial and invalid drafts', () => {
    assert.equal(formatDfrDateInput('2026-10-29'), '10/29/2026');
    assert.equal(dfrDateInputToIso('10/29/2026'), '2026-10-29');
    assert.equal(dfrDateInputToIso('02/30/2026'), '02/30/2026');
    assert.equal(formatDfrDateInput('10/'), '10/');
  });
});
