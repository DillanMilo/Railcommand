import assert from 'node:assert/strict';
import { describe, it } from 'mocha';
import { copyDailyLogFields, createMobileDraft, dailyLogFieldPayload, draftToSyncOperation, emptyDailyLogFields, newEquipmentEntry, newPersonnelEntry, newWorkEntry } from './index';

const fields = () => ({ weatherTemp: '-12.5', weatherWind: 'NW 8 mph',
  personnel: [{ rowId: 'p1', role: 'Foreman', headcount: '2', company: 'Synthetic Contractor' }],
  equipment: [{ rowId: 'e1', type: 'Excavator', count: '1', notes: 'Inspection complete' }],
  workItems: [{ rowId: 'w1', description: 'Ballast placed', quantity: '12.75', unit: 'CY', location: 'MP 10' }] });
const values = { logDate: '2026-08-29', weatherConditions: 'Clear', workSummary: 'Fixture field work', safetyNotes: '' };

describe('Full daily-log draft fields', () => {
  it('preserves every field and original identity through edits and serialized restore', () => {
    const original = createMobileDraft('project', { ...values, fieldEntries: fields() }, null, new Date(), () => 'original-id');
    const restored = JSON.parse(JSON.stringify(original));
    const edited = createMobileDraft('project', { ...values, workSummary: 'Updated' }, restored);
    assert.deepEqual(edited.fieldEntries, fields()); assert.equal(edited.clientId, original.clientId); assert.equal(edited.idempotencyKey, original.idempotencyKey);
    assert.notEqual(edited.fieldEntries?.personnel, original.fieldEntries?.personnel);
    const operation = draftToSyncOperation('user', edited);
    assert.equal(operation.payload.weather_temp, -12.5); assert.equal(operation.payload.weather_wind, 'NW 8 mph');
    assert.deepEqual(operation.payload.personnel, [{ role: 'Foreman', headcount: 2, company: 'Synthetic Contractor' }]);
    assert.deepEqual(operation.payload.equipment, [{ equipment_type: 'Excavator', count: 1, notes: 'Inspection complete' }]);
    assert.deepEqual(operation.payload.work_items, [{ description: 'Ballast placed', quantity: 12.75, unit: 'CY', location: 'MP 10' }]);
    assert.doesNotMatch(JSON.stringify(operation.payload), /rowId|fieldEntries/);
  });
  it('keeps pre-parity drafts compatible and ignores only entirely blank rows', () => {
    const legacy = createMobileDraft('project', values, null, new Date(), () => 'legacy');
    assert.deepEqual(draftToSyncOperation('user', legacy).payload.personnel, []);
    const blank = { ...emptyDailyLogFields(), personnel: [newPersonnelEntry('p')], equipment: [newEquipmentEntry('e')], workItems: [newWorkEntry('w')] };
    assert.deepEqual(dailyLogFieldPayload(blank), { weather_temp: 0, weather_wind: '', personnel: [], equipment: [], work_items: [] });
  });
  it('retains incomplete and invalid numeric input in drafts but blocks queueing', () => {
    for (const raw of ['-', 'Infinity', 'NaN', '1e4', '1,200']) {
      const input = { ...fields(), weatherTemp: raw };
      const saved = createMobileDraft('project', { ...values, fieldEntries: input });
      assert.equal(saved.fieldEntries?.weatherTemp, raw); assert.throws(() => draftToSyncOperation('user', saved));
    }
    for (const raw of ['-1', '1.5', '2147483648']) {
      const input = fields(); input.personnel[0].headcount = raw;
      assert.equal(copyDailyLogFields(input).personnel[0].headcount, raw); assert.throws(() => dailyLogFieldPayload(input));
    }
    assert.equal(dailyLogFieldPayload({ ...fields(), weatherTemp: '0' }).weather_temp, 0);
  });
  it('does not silently drop a partially completed row', () => {
    const personnel = fields(); personnel.personnel[0].role = '';
    const equipment = fields(); equipment.equipment[0].type = '';
    const work = fields(); work.workItems[0].description = '';
    for (const input of [personnel, equipment, work]) { const snapshot = JSON.stringify(input); assert.throws(() => dailyLogFieldPayload(input)); assert.equal(JSON.stringify(input), snapshot); }
  });
  it('rejects unreadable or duplicated row identities without changing input', () => {
    const input = fields(); input.personnel.push({ ...input.personnel[0] });
    assert.throws(() => copyDailyLogFields(input));
    assert.throws(() => copyDailyLogFields({ ...fields(), equipment: null } as never));
  });
  it('rejects server-truncated text, excessive rows and oversized payloads instead of losing input', () => {
    const long = fields(); long.equipment[0].notes = 'x'.repeat(2001); assert.throws(() => dailyLogFieldPayload(long), /not truncated/);
    const tooMany = fields(); tooMany.personnel = Array.from({ length: 101 }, (_, index) => ({ ...tooMany.personnel[0], rowId: String(index) }));
    assert.throws(() => dailyLogFieldPayload(tooMany), /100 rows/);
    const large = fields(); large.workItems = Array.from({ length: 40 }, (_, index) => ({ ...large.workItems[0], rowId: String(index), description: 'x'.repeat(2000) }));
    assert.throws(() => draftToSyncOperation('user', createMobileDraft('project', { ...values, fieldEntries: large })), /size limit/);
    assert.throws(() => draftToSyncOperation('user', createMobileDraft('project', { ...values, workSummary: 'x'.repeat(20001) })), /not truncated/);
  });
});
