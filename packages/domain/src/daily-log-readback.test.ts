import assert from 'node:assert/strict';
import { describe, it } from 'mocha';
import { normalizeDailyLogReadFields } from './index';

const richFields = () => ({
  weatherTemp: -12.5,
  weatherWind: 'NW 8 mph',
  geoTag: { lat: 41.878113, lng: -87.629799, accuracy: 0, altitude: -6.25, timestamp: '2026-08-30T12:00:00Z' },
  personnel: [{ id: 'personnel-1', role: 'Foreman', headcount: 0, company: 'Synthetic Rail' }],
  equipment: [{ id: 'equipment-1', equipmentType: 'Excavator', count: 0, notes: 'Inspection complete' }],
  workItems: [{ id: 'work-1', description: 'Ballast placed', quantity: 12.75, unit: 'CY', location: 'MP 10.5' }],
});

function freezeDeep<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freezeDeep);
    Object.freeze(value);
  }
  return value;
}

describe('Synchronized daily-log readback normalization', () => {
  it('preserves all rich fields, including negative temperature, zero counts, and fractional quantities', () => {
    const input = richFields();
    const result = normalizeDailyLogReadFields(input);
    assert.deepEqual(result, input);
    assert.equal(normalizeDailyLogReadFields({ ...input, weatherTemp: 0 }).weatherTemp, 0);
    assert.equal(normalizeDailyLogReadFields({ workItems: [{ ...input.workItems[0], quantity: 0 }] }).workItems?.[0].quantity, 0);
  });

  it('normalizes decimal string values returned by numeric database columns', () => {
    const fields = richFields();
    assert.deepEqual(normalizeDailyLogReadFields({ ...fields, weatherTemp: '-12.5',
      geoTag: { ...fields.geoTag, lat: '41.878113', lng: '-87.629799', accuracy: '0', altitude: '-6.25' },
      personnel: [{ ...fields.personnel[0], headcount: '0' }],
      equipment: [{ ...fields.equipment[0], count: '0' }],
      workItems: [{ ...fields.workItems[0], quantity: '12.75' }],
    }), fields);
  });

  it('keeps unavailable legacy fields distinct from explicitly absent and empty fields', () => {
    const absent = normalizeDailyLogReadFields({});
    for (const key of ['weatherTemp', 'weatherWind', 'geoTag', 'personnel', 'equipment', 'workItems'] as const) {
      assert.equal(absent[key], undefined, key);
    }
    const knownEmpty = normalizeDailyLogReadFields({ weatherTemp: null, weatherWind: '', geoTag: null, personnel: [], equipment: [], workItems: [] });
    assert.deepEqual(knownEmpty, { weatherTemp: null, weatherWind: '', geoTag: null, personnel: [], equipment: [], workItems: [] });
  });

  it('allowlists nested data and returns independent copies without mutating frozen source values', () => {
    const fields = richFields();
    const input = freezeDeep({ ...fields, sessionToken: 'private-root',
      geoTag: { ...fields.geoTag, signedUrl: 'private-location-url' },
      personnel: [{ ...fields.personnel[0], email: 'private-personnel' }],
      equipment: [{ ...fields.equipment[0], storagePath: 'private-equipment' }],
      workItems: [{ ...fields.workItems[0], accessToken: 'private-work' }],
    });
    const snapshot = JSON.stringify(input);
    const result = normalizeDailyLogReadFields(input);
    assert.deepEqual(result, fields);
    assert.doesNotMatch(JSON.stringify(result), /private-|sessionToken|signedUrl|storagePath|accessToken/);
    assert.equal(JSON.stringify(input), snapshot);
    assert.notEqual(result.geoTag, input.geoTag);
    assert.notEqual(result.personnel, input.personnel);
    assert.notEqual(result.personnel?.[0], input.personnel[0]);
    assert.notEqual(result.equipment?.[0], input.equipment[0]);
    assert.notEqual(result.workItems?.[0], input.workItems[0]);
  });

  it('treats malformed optional scalar values as unavailable instead of inventing defaults', () => {
    for (const weatherTemp of [undefined, '', ' ', 'NaN', 'Infinity', '1e3', '0x10', true, NaN, Infinity, -Infinity, {}]) {
      assert.equal(normalizeDailyLogReadFields({ weatherTemp }).weatherTemp, undefined);
    }
    for (const weatherWind of [undefined, null, 0, false, [], {}]) {
      assert.equal(normalizeDailyLogReadFields({ weatherWind }).weatherWind, undefined);
    }
    for (const payload of [undefined, null, false, 123, 'cached-log', []]) {
      const result = normalizeDailyLogReadFields(payload);
      assert.equal(result.weatherTemp, undefined);
      assert.equal(result.geoTag, undefined);
      assert.equal(result.personnel, undefined);
    }
  });

  it('validates GPS coordinates and timestamp without confusing the equator or prime meridian with absence', () => {
    const origin = { lat: 0, lng: 0, timestamp: '2026-08-30T12:00:00Z' };
    assert.deepEqual(normalizeDailyLogReadFields({ geoTag: origin }).geoTag, origin);
    for (const geoTag of [
      {}, { ...origin, lat: 91 }, { ...origin, lat: -91 }, { ...origin, lng: 181 }, { ...origin, lng: -181 },
      { ...origin, lat: NaN }, { ...origin, lng: Infinity }, { ...origin, lat: 'invalid' },
      { ...origin, timestamp: '' }, { ...origin, timestamp: 'not-a-date' }, { ...origin, timestamp: 123 },
    ]) assert.equal(normalizeDailyLogReadFields({ geoTag }).geoTag, undefined);
    assert.deepEqual(normalizeDailyLogReadFields({ geoTag: { ...origin, accuracy: -1, altitude: Infinity } }).geoTag, origin);
  });

  it('does not misrepresent malformed row collections as confirmed empty sections', () => {
    for (const invalid of [null, {}, 'rows', 2, true]) {
      const result = normalizeDailyLogReadFields({ personnel: invalid, equipment: invalid, workItems: invalid });
      assert.equal(result.personnel, undefined); assert.equal(result.equipment, undefined); assert.equal(result.workItems, undefined);
    }
    const fields = richFields();
    for (const invalid of [null, {}, { ...fields.personnel[0], headcount: NaN }, { ...fields.personnel[0], role: null }]) {
      assert.equal(normalizeDailyLogReadFields({ personnel: [fields.personnel[0], invalid] }).personnel, undefined);
    }
    assert.equal(normalizeDailyLogReadFields({ equipment: [{ ...fields.equipment[0], count: Infinity }] }).equipment, undefined);
    assert.equal(normalizeDailyLogReadFields({ workItems: [{ ...fields.workItems[0], quantity: 'invalid' }] }).workItems, undefined);
  });

  it('rejects duplicate/missing row identity and invalid counts without returning a partial section', () => {
    const fields = richFields();
    assert.equal(normalizeDailyLogReadFields({ personnel: [fields.personnel[0], { ...fields.personnel[0] }] }).personnel, undefined);
    assert.equal(normalizeDailyLogReadFields({ equipment: [{ ...fields.equipment[0], id: '' }] }).equipment, undefined);
    assert.equal(normalizeDailyLogReadFields({ workItems: [{ ...fields.workItems[0], id: undefined }] }).workItems, undefined);
    for (const headcount of [-1, 0.5]) assert.equal(normalizeDailyLogReadFields({ personnel: [{ ...fields.personnel[0], headcount }] }).personnel, undefined);
    for (const count of [-1, 0.5]) assert.equal(normalizeDailyLogReadFields({ equipment: [{ ...fields.equipment[0], count }] }).equipment, undefined);
    assert.equal(normalizeDailyLogReadFields({ workItems: [{ ...fields.workItems[0], quantity: -0.5 }] }).workItems, undefined);
  });
});
