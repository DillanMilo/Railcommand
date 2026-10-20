import assert from 'node:assert/strict';
import { describe, it } from 'mocha';
import { beginWorkspaceFile, appendWorkspaceChunk, finishWorkspaceFile, sameWorkspaceOrigin, workspaceDestination, workspaceHandoffSource, workspaceToolRequest, MAX_WORKSPACE_FILE } from './workspace-policy';
import { workspacePostAllowed } from '../../../../src/lib/mobile-api/workspace-ticket';
describe('workspace navigation and bounded exports', () => {
  it('blocks origin lookalikes, HTTP, credentials to external origins and unsafe destinations', () => {
    assert.equal(sameWorkspaceOrigin('https://railcommand.io/projects/a', 'https://railcommand.io'), true);
    for (const url of ['http://railcommand.io', 'https://railcommand.io.evil.test', 'https://railcommand.io@evil.test', 'javascript:alert(1)', 'file:///private']) assert.equal(sameWorkspaceOrigin(url, 'https://railcommand.io'), false);
    for (const path of ['//evil.test', '/projects/../../auth/mobile-session', '/projects/%2e%2e/auth', '/auth/mobile-session']) assert.equal(workspaceDestination(path), '/dashboard');
  });
  it('sends the exact HTTPS origin accepted by the server instead of WebKit opaque Origin', () => {
    const source = workspaceHandoffSource('https://railcommand.io', 'synthetic_ticket');
    assert.equal(source.uri, 'https://railcommand.io/auth/mobile-session');
    assert.equal(source.method, 'POST');
    assert.equal(new URLSearchParams(source.body).get('ticket'), 'synthetic_ticket');
    assert.equal(source.uri.includes('synthetic_ticket'), false);
    assert.equal(workspacePostAllowed(new Request(source.uri, source)), true);
    assert.equal(workspacePostAllowed(new Request(source.uri, { ...source, headers: { ...source.headers, Origin: 'null' } })), false);
    assert.equal(workspacePostAllowed(new Request(source.uri, { ...source, headers: { ...source.headers, 'Sec-Fetch-Site': 'cross-site' } })), false);
    for (const origin of ['http://railcommand.io', 'https://railcommand.io/path', 'https://user:password@railcommand.io', 'https://railcommand.io/']) assert.throws(() => workspaceHandoffSource(origin, 'synthetic_ticket'));
    for (const ticket of ['', 'not a ticket', 'x'.repeat(4097)]) assert.throws(() => workspaceHandoffSource('https://railcommand.io', ticket));
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

describe('More native tools', () => {
  it('accepts only known tools and a valid project or explicit no-project selection', () => {
    const projectId = '10000000-0000-4000-8000-000000000001';
    assert.deepEqual(workspaceToolRequest({ type: 'field-tools', projectId }), { destination: '/(tabs)', projectId });
    assert.deepEqual(workspaceToolRequest({ type: 'railbot', projectId: null }), { destination: '/railbot', projectId: null });
    for (const value of [{ type: 'sign-out', projectId }, { type: 'railbot', projectId: 'bad' }, { type: 'field-tools' }, { type: 'field-tools', projectId: '//evil.test' }]) assert.equal(workspaceToolRequest(value), null);
  });
});
