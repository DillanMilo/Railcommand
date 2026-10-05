import assert from 'node:assert/strict';
import { describe, it } from 'mocha';
import { openWorkspaceTicket, sealWorkspaceTicket, workspacePath, workspacePostAllowed } from './workspace-ticket';
const secret = 'synthetic-server-secret-not-a-real-credential';
const identity = { sub: '10000000-0000-4000-8000-000000000001', tokenHash: 'synthetic-single-use-otp', next: '/projects/20000000-0000-4000-8000-000000000001/daily-logs' };
describe('isolated workspace handoff', () => {
  it('seals credentials, randomizes repeated tickets and roundtrips exact identity/path', () => {
    const ticket = sealWorkspaceTicket(identity, secret, 1000);
    assert.notEqual(ticket, sealWorkspaceTicket(identity, secret, 1000));
    assert.ok(!Buffer.from(ticket, 'base64url').toString().includes(identity.tokenHash));
    assert.deepEqual(openWorkspaceTicket(ticket, secret, 1001), { ...identity, exp: 31000 });
  });
  it('rejects expiry, future dates, wrong keys, truncated and tampered ciphertext', () => {
    const ticket = sealWorkspaceTicket(identity, secret, 1000);
    for (const time of [31000, 31001, 999]) assert.throws(() => openWorkspaceTicket(ticket, secret, time));
    assert.throws(() => openWorkspaceTicket(ticket, secret + 'changed', 1001));
    assert.throws(() => openWorkspaceTicket(ticket.slice(0, -8), secret, 1001));
    const bytes = Buffer.from(ticket, 'base64url'); bytes[35] ^= 1;
    assert.throws(() => openWorkspaceTicket(bytes.toString('base64url'), secret, 1001));
    for (const invalid of [null, {}, '', '!', 'x'.repeat(4097)]) assert.throws(() => openWorkspaceTicket(invalid, secret, 1001));
  });
  it('allows only local application paths without normalization or auth redirects', () => {
    for (const path of ['//evil.example/projects', '/projects/../../auth/callback', '/projects/../settings', '/projects/%2e%2e/auth', '/projects\\evil', '/api/private', '/auth/callback', '/login', 'https://evil.example', '/projects#secret', '/projects\n']) assert.equal(workspacePath(path), '/dashboard', path);
    for (const path of ['/dashboard', '/projects/id/rfis/new', '/search?q=track', '/settings/profile']) assert.equal(workspacePath(path), path);
  });
  it('rejects cross-site form posts including null origins and wrong media types', () => {
    const request = (headers: Record<string, string>) => new Request('https://railcommand.io/auth/mobile-session', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', ...headers } });
    assert.equal(workspacePostAllowed(request({})), true);
    assert.equal(workspacePostAllowed(request({ origin: 'https://railcommand.io' })), true);
    const cases: Record<string, string>[] = [{ origin: 'https://evil.example' }, { origin: 'null' }, { 'sec-fetch-site': 'cross-site' }, { 'content-type': 'application/json' }];
    for (const headers of cases) assert.equal(workspacePostAllowed(request(headers)), false);
  });
});
