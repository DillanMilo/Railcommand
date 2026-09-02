import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { describe, it } from 'mocha';
import { createMobileDraft, draftToSyncOperation } from '@railcommand/domain';
import { createDailyLogWriter, dailyLogStatusBanner, localDailyLogDate, prepareDailyLogEditor, validateDailyLogDate } from './daily-log-editor';

const base = () => createMobileDraft('project-a', { logDate: '2026-08-29', weatherConditions: 'Legacy free-text weather', workSummary: '', safetyNotes: '' }, null, new Date(), () => 'client-a');
describe('Daily log editor restoration and write lifecycle', () => {
  it('reports saving, save failure, and recovery truthfully online and offline', () => {
    for (const online of [true, false]) {
      assert.equal(dailyLogStatusBanner({ kind: 'saving', detail: 'Saving…' }, true, online).tone, 'neutral');
      const failed = dailyLogStatusBanner({ kind: 'save-error', detail: 'Storage is full. Keep the form open.' }, true, online);
      assert.equal(failed.title, 'Draft not saved'); assert.equal(failed.tone, 'danger');
      const recovered = dailyLogStatusBanner({ kind: 'saved', detail: 'Saved automatically on this device' }, false, online);
      assert.equal(recovered.tone, 'success'); assert.match(recovered.title, /saved on this device/);
    }
  });
  it('does not style permission denial as success or claim unsaved edits are protected', () => {
    const denied = { kind: 'attention' as const, detail: 'Camera permission was not granted.' };
    const banner = dailyLogStatusBanner(denied, false, true);
    assert.equal(banner.tone, 'warning'); assert.equal(banner.title, 'Action needs attention');
    assert.equal(dailyLogStatusBanner(denied, true, false).title, 'Draft has unsaved changes');
    assert.equal(dailyLogStatusBanner({ kind: 'saved', detail: 'An earlier snapshot saved' }, true, true).tone, 'warning');
    assert.equal(dailyLogStatusBanner({ kind: 'queued', detail: 'Waiting for connectivity' }, false, false).title, 'Daily log queued');
    assert.equal(dailyLogStatusBanner({ kind: 'working', detail: 'Opening camera…' }, false, true).tone, 'neutral');
  });
  it('adds empty row editors to legacy drafts without changing their identity or existing input', () => {
    let sequence = 0;
    const old = base(); const next = prepareDailyLogEditor(old, () => `row-${++sequence}`);
    assert.equal(next.clientId, old.clientId); assert.equal(next.idempotencyKey, old.idempotencyKey); assert.equal(next.weatherConditions, old.weatherConditions);
    assert.equal(next.fieldEntries?.personnel.length, 1); assert.equal(next.fieldEntries?.equipment.length, 1); assert.equal(next.fieldEntries?.workItems.length, 1);
    assert.equal(old.fieldEntries, undefined);
    assert.deepEqual(prepareDailyLogEditor(next, () => 'unused'), next);
  });
  it('serializes SQLite writes and restores the last complete field snapshot into the queue payload', async () => {
    const db = new DatabaseSync(':memory:'); db.exec('CREATE TABLE drafts(project_id TEXT PRIMARY KEY, payload TEXT NOT NULL)');
    let count = 0;
    const value = prepareDailyLogEditor(base(), () => `row-${++count}`);
    const writer = createDailyLogWriter(async (draft) => {
      db.prepare('INSERT INTO drafts VALUES(?,?) ON CONFLICT(project_id) DO UPDATE SET payload=excluded.payload').run(draft.projectId, JSON.stringify(draft));
    });
    try {
      value.fieldEntries!.weatherTemp = '-';
      const first = writer(value);
      value.fieldEntries!.weatherTemp = '-5';
      value.fieldEntries!.personnel[0] = { ...value.fieldEntries!.personnel[0], role: 'Foreman', headcount: '2', company: 'Synthetic' };
      const second = writer(value);
      await first; await second;
      const restored = JSON.parse(db.prepare('SELECT payload FROM drafts WHERE project_id = ?').get('project-a')!.payload as string);
      assert.equal(restored.fieldEntries.weatherTemp, '-5');
      assert.deepEqual(draftToSyncOperation('user-a', restored).payload.personnel, [{ role: 'Foreman', headcount: 2, company: 'Synthetic' }]);
      assert.equal(draftToSyncOperation('user-a', restored).clientId, 'client-a');
    } finally { db.close(); }
  });
  it('surfaces write failure, recovers with the same draft identity and snapshots nested input', async () => {
    let count = 0; const received: string[] = [];
    const value = prepareDailyLogEditor(base(), () => `row-${++count}`);
    const writer = createDailyLogWriter(async (draft) => { received.push(draft.fieldEntries!.weatherTemp); if (draft.fieldEntries!.weatherTemp === '-') throw new Error('quota'); });
    value.fieldEntries!.weatherTemp = '-'; const first = writer(value);
    value.fieldEntries!.weatherTemp = '-2'; const retry = writer(value);
    await assert.rejects(first, /quota/); await retry; assert.deepEqual(received, ['-', '-2']); assert.equal(value.clientId, 'client-a');
  });
  it('uses the device calendar day and validates real dates', () => {
    const local = new Date(2026, 7, 29, 23, 59); assert.equal(localDailyLogDate(local), '2026-08-29');
    assert.equal(validateDailyLogDate('2028-02-29'), true);
    for (const input of ['', '2026-02-29', '2026-13-01', '29/08/2026']) assert.equal(validateDailyLogDate(input), false);
  });
});
