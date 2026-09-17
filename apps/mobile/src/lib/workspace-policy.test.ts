import assert from 'node:assert/strict';
import { describe, it } from 'mocha';
import { beginWorkspaceFile, appendWorkspaceChunk, finishWorkspaceFile, sameWorkspaceOrigin, workspaceDestination, MAX_WORKSPACE_FILE } from './workspace-policy';
describe('workspace navigation and bounded exports', () => {
  it('blocks origin lookalikes, HTTP, credentials to external origins and unsafe destinations', () => {
    assert.equal(sameWorkspaceOrigin('https://railcommand.io/projects/a', 'https://railcommand.io'), true);
    for (const url of ['http://railcommand.io', 'https://railcommand.io.evil.test', 'https://railcommand.io@evil.test', 'javascript:alert(1)', 'file:///private']) assert.equal(sameWorkspaceOrigin(url, 'https://railcommand.io'), false);
    for (const path of ['//evil.test', '/projects/../../auth/mobile-session', '/projects/%2e%2e/auth', '/auth/mobile-session']) assert.equal(workspaceDestination(path), '/dashboard');
  });
  it('reassembles exact file bytes with a bounded safe filename', () => {
    const file = beginWorkspaceFile({ id: 'one', size: 5, name: '../../project.pdf', mime: 'application/pdf' });
    appendWorkspaceChunk(file, { id: 'one', index: 0, data: 'aGVs' });
    appendWorkspaceChunk(file, { id: 'one', index: 1, data: 'bG8=' });
    assert.equal(Buffer.from(finishWorkspaceFile(file, 'one'), 'base64').toString(), 'hello');
    assert.ok(!file.name.includes('/'));
  });
  it('rejects oversize, out of sequence, duplicate, extra bytes, truncation and another transfer', () => {
    for (const size of [0, -1, MAX_WORKSPACE_FILE + 1, 2.5]) assert.throws(() => beginWorkspaceFile({ id: 'one', size }));
    const file = beginWorkspaceFile({ id: 'one', size: 3 });
    for (const part of [{ id: 'two', index: 0, data: 'YWJj' }, { id: 'one', index: 1, data: 'YWJj' }, { id: 'one', index: 0, data: '!!!!' }]) assert.throws(() => appendWorkspaceChunk(file, part));
    assert.throws(() => finishWorkspaceFile(file, 'one'));
    appendWorkspaceChunk(file, { id: 'one', index: 0, data: 'YWJj' });
    assert.throws(() => appendWorkspaceChunk(file, { id: 'one', index: 0, data: 'YWJj' }));
    assert.throws(() => appendWorkspaceChunk(file, { id: 'one', index: 1, data: 'YWJj' }));
    assert.throws(() => finishWorkspaceFile(file, 'two'));
    assert.equal(finishWorkspaceFile(file, 'one'), 'YWJj');
  });
});
