import assert from 'node:assert/strict';
import { describe, it } from 'mocha';
import { recordsForProject, resolveProjectRoute } from './project-routes';

const projectA = '20000000-0000-4000-8000-000000000001';
const projectB = '20000000-0000-4000-8000-000000000002';
const logId = '30000000-0000-4000-8000-000000000001';

describe('Exact native project routes', () => {
  it('opens each supported module list in the linked project', () => {
    for (const [section, destination] of Object.entries({ rfis: '/(tabs)/rfis', submittals: '/(tabs)/submittals', cameras: '/(tabs)/cameras', 'daily-logs': '/(tabs)/logs', team: '/team' })) {
      assert.deepEqual(resolveProjectRoute(projectA, section), { kind: 'native', projectId: projectA, destination });
    }
  });
  it('distinguishes a new daily log from a specific saved record and from its list', () => {
    assert.deepEqual(resolveProjectRoute(projectA, ['daily-logs', 'new']), { kind: 'native', projectId: projectA, destination: '/daily-log/new' });
    assert.deepEqual(resolveProjectRoute(projectA, `daily-logs/${logId}`), { kind: 'native', projectId: projectA, destination: `/daily-log/${logId}` });
  });
  it('preserves unfinished native routes instead of silently opening a different screen', () => {
    for (const segments of [['submittals', logId, 'edit'], ['daily-logs', logId, 'edit'], ['cameras', logId], ['schedule'], ['constructor']]) {
      assert.deepEqual(resolveProjectRoute(projectA, segments), { kind: 'unimplemented', projectId: projectA, path: `/projects/${projectA}/${segments.join('/')}` });
    }
  });
  it('opens native creation forms with the linked project intact', () => {
    for (const section of ['rfis', 'submittals']) assert.deepEqual(resolveProjectRoute(projectA, [section, 'new']), {
      kind: 'native', projectId: projectA, destination: `/record/${section}/new?projectId=${projectA}`,
    });
  });
  it('keeps RFI and Submittal record IDs and their project scope in detail links', () => {
    for (const section of ['rfis', 'submittals']) {
      assert.deepEqual(resolveProjectRoute(projectA, [section, logId]), {
        kind: 'native', projectId: projectA, destination: `/record/${section}/${logId}?projectId=${projectA}`,
      });
    }
  });
  it('rejects missing or malformed project IDs, path traversal, escaped separators, and URLs', () => {
    for (const id of [undefined, '', 'not-a-project', '../account']) assert.equal(resolveProjectRoute(id, 'daily-logs').kind, 'invalid');
    for (const segments of [undefined, [], ['..'], ['rfis', '../new'], ['rfis', '%2Fnew'], ['https://example.com'], ['rfis', '']]) {
      assert.equal(resolveProjectRoute(projectA, segments).kind, 'invalid');
    }
  });
  it('never shows another project’s cached RFI/submittal records during A to B to A selection', () => {
    const a = { id: 'a', projectId: projectA };
    const b = { id: 'b', projectId: projectB };
    const cache = Object.freeze([a, b]);
    assert.deepEqual(recordsForProject(cache, projectA), [a]);
    assert.deepEqual(recordsForProject(cache, projectB), [b]);
    assert.deepEqual(recordsForProject(cache, projectA), [a]);
    assert.deepEqual(recordsForProject([a], projectB), []);
    assert.deepEqual(recordsForProject(cache, null), []);
    assert.deepEqual(recordsForProject(undefined, projectA), []);
    assert.deepEqual(cache, [a, b]);
  });
});
