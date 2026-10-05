import assert from 'node:assert/strict';
import { describe, it } from 'mocha';
import { createMobileDraft, dailyLogFieldPayload, draftToSyncOperation, type MobileDailyLogFields } from './index';

function fields(weatherTemp = '0', quantity = '0'): MobileDailyLogFields {
  return { weatherTemp, weatherWind: 'NW 8 mph',
    personnel: [{ rowId: 'personnel-1', role: 'Foreman', headcount: '2', company: 'Synthetic Rail' }],
    equipment: [{ rowId: 'equipment-1', type: 'Excavator', count: '1', notes: 'Inspection complete' }],
    workItems: [{ rowId: 'work-1', description: 'Ballast placed', quantity, unit: 'CY', location: 'MP 10' }],
  };
}

describe('Daily-log queue database numeric boundaries', () => {
  it('accepts the numeric(5,1) weather limits, zero, and equivalent trailing-zero input', () => {
    for (const raw of ['9999.9', '-9999.9', '0', '1.0', '1.00', '1.0000', '9999.90', '-9999.9000', ' 1.00 ', '0.0000']) {
      const input = fields(raw);
      const snapshot = JSON.stringify(input);
      assert.equal(dailyLogFieldPayload(input).weather_temp, Number(raw), raw);
      assert.equal(JSON.stringify(input), snapshot, 'accepted input must not be reformatted in the draft');
    }
  });

  it('accepts the numeric(12,2) quantity limit, fractions, zero, and equivalent trailing zeros', () => {
    for (const raw of ['9999999999.99', '12.75', '0', '1.0', '1.00', '1.0000', '1.0100', '9999999999.9900', '0.0000']) {
      const input = fields('0', raw);
      const snapshot = JSON.stringify(input);
      assert.equal(dailyLogFieldPayload(input).work_items[0].quantity, Number(raw), raw);
      assert.equal(JSON.stringify(input), snapshot);
    }
  });

  it('rejects temperature overflow and nonzero excess decimal places with an actionable draft-preservation error', () => {
    for (const raw of ['10000', '-10000', '10000.0', '-10000.00', '1.01', '-1.01', '9999.99', '1.0010']) {
      assert.throws(() => dailyLogFieldPayload(fields(raw)), (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.match(error.message, /Temperature/i);
        assert.match(error.message, /draft/i);
        assert.match(error.message, /remain|kept|preserv/i);
        return true;
      }, raw);
    }
  });

  it('rejects quantity overflow, negative values, and nonzero excess decimal places', () => {
    for (const raw of ['10000000000', '10000000000.00', '1.001', '1.0010', '9999999999.999', '-0.01']) {
      assert.throws(() => dailyLogFieldPayload(fields('0', raw)), (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.match(error.message, /Work item 1/i);
        assert.match(error.message, /draft/i);
        assert.match(error.message, /remain|kept|preserv/i);
        return true;
      }, raw);
    }
  });

  it('retains rejected raw values and draft identity, and refuses to construct a sync operation', () => {
    for (const input of [fields('10000'), fields('-10000'), fields('1.01'), fields('0', '1.001'), fields('0', '10000000000')]) {
      const rawSnapshot = JSON.stringify(input);
      const draft = createMobileDraft('project', { logDate: '2026-08-30', weatherConditions: 'Clear',
        workSummary: 'Preserved field work', safetyNotes: 'Preserved safety notes', fieldEntries: input },
      null, new Date('2026-08-30T12:00:00Z'), () => 'original-client-id');
      const draftSnapshot = JSON.stringify(draft);
      assert.throws(() => draftToSyncOperation('owner', draft), /draft/i);
      assert.equal(JSON.stringify(input), rawSnapshot);
      assert.equal(JSON.stringify(draft), draftSnapshot);
      assert.equal(draft.clientId, 'original-client-id');
      assert.equal(draft.idempotencyKey, 'daily-log-create:original-client-id');
      assert.deepEqual(JSON.parse(draftSnapshot).fieldEntries, input, 'serialized offline draft retains original numeric text');
    }
  });

  it('leaves existing whole-count validation and blank numeric defaults unchanged', () => {
    const input = fields('', ''); input.personnel[0].headcount = '2147483647'; input.equipment[0].count = '0';
    const payload = dailyLogFieldPayload(input);
    assert.equal(payload.weather_temp, 0); assert.equal(payload.work_items[0].quantity, 0);
    assert.equal(payload.personnel[0].headcount, 2147483647); assert.equal(payload.equipment[0].count, 0);
    for (const raw of ['2147483648', '-1', '1.5']) {
      const invalid = fields(); invalid.personnel[0].headcount = raw;
      assert.throws(() => dailyLogFieldPayload(invalid));
      assert.equal(invalid.personnel[0].headcount, raw);
    }
  });
});
