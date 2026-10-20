import assert from 'node:assert/strict';
import { describe, it } from 'mocha';
import { exportAndSharePdf, validatePdfPayload, type ReportExportDependencies } from './report-export';

const bytes = Buffer.from('%PDF-1.7\nfixture');
const report = { fileName: '../../ignored.pdf', mimeType: 'application/pdf' as const, base64: bytes.toString('base64'), byteLength: bytes.length, recordCount: 1 };
const selection = { projectId: 'project', kind: 'rfis' as const, recordIds: ['record'] };

function harness() {
  const events: string[] = [];
  const deps: ReportExportDependencies = {
    isCurrent: () => true,
    isSharingAvailable: async () => true,
    fetchReport: async () => { events.push('fetch'); return report; },
    createFile: () => { events.push('allocate'); return {
      uri: 'file:///private/owned-report.pdf',
      write: (base64) => { assert.equal(base64, report.base64); events.push('write'); },
      remove: () => { events.push('remove'); },
    }; },
    share: async (uri) => { assert.equal(uri, 'file:///private/owned-report.pdf'); events.push('share'); },
  };
  return { deps, events };
}

describe('Native PDF export lifecycle', () => {
  it('shares a validated PDF from an app-owned path then removes it', async () => {
    const h = harness();
    await exportAndSharePdf(selection, h.deps);
    assert.deepEqual(h.events, ['fetch', 'allocate', 'write', 'share', 'remove']);
  });
  it('does not request an export when sharing is unavailable', async () => {
    const h = harness(); h.deps.isSharingAvailable = async () => false;
    await assert.rejects(exportAndSharePdf(selection, h.deps), /unavailable/);
    assert.deepEqual(h.events, []);
  });
  it('does not create or share a file after the account/project changes during download', async () => {
    const h = harness(); let current = true;
    h.deps.isCurrent = () => current;
    h.deps.fetchReport = async () => { current = false; return report; };
    await assert.rejects(exportAndSharePdf(selection, h.deps), /cancelled/);
    assert.deepEqual(h.events, []);
  });
  it('does not leave a file or clear selection when the network request fails', async () => {
    const h = harness(); h.deps.fetchReport = async () => { throw new Error('offline'); };
    await assert.rejects(exportAndSharePdf(selection, h.deps), /offline/);
    assert.deepEqual(h.events, []);
    assert.deepEqual(selection.recordIds, ['record']);
  });
  it('removes partial files on storage failure and files on share-sheet failure', async () => {
    for (const stage of ['write', 'share']) {
      const h = harness();
      if (stage === 'write') h.deps.createFile = () => ({ uri: 'file:///private/owned-report.pdf', write: () => { throw new Error('quota'); }, remove: () => { h.events.push('remove'); } });
      else h.deps.share = async () => { throw new Error('share cancelled'); };
      await assert.rejects(exportAndSharePdf(selection, h.deps));
      assert.equal(h.events.at(-1), 'remove');
    }
  });
  it('rejects non-PDF, truncated, oversized, or mismatched-count payloads before storage', async () => {
    for (const invalid of [
      { ...report, mimeType: 'text/html' }, { ...report, byteLength: bytes.length + 1 },
      { ...report, base64: Buffer.from('<html>error</html>').toString('base64') },
      { ...report, byteLength: 3 * 1024 * 1024 }, { ...report, recordCount: 2 },
    ]) assert.throws(() => validatePdfPayload(invalid as typeof report, 1));
  });
});
