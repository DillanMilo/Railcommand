import { URL } from 'node:url';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { describe, it } from 'mocha';
type SessionResult = { data: { session: { user: { id: string }; access_token: string; expires_at?: number } } };
function harness() {
  let current = true; let requests = 0; let refreshes = 0;
  let lookup: () => Promise<SessionResult> = async () => ({ data: { session: { user: { id: 'A' }, access_token: 'synthetic', expires_at: Date.now()/1000+300 } } });
  let refresh: () => Promise<SessionResult> = async () => ({ data: { session: { user: { id: 'A' }, access_token: 'new-synthetic' } } });
  let transport: () => Promise<{ ok: boolean }> = async () => ({ ok: true });
  const compiledModule = { exports: {} as typeof import('./railbot-api') };
  const deps: Record<string, unknown> = { 'expo/fetch': { fetch: async () => { requests++; return transport(); } }, './config': { mobileConfig: { apiBaseUrl: 'https://synthetic.invalid' } }, './supabase': { supabase: { auth: { getSession: () => lookup(), refreshSession: () => { refreshes++; return refresh(); } } } } };
  runInNewContext(ts.transpileModule(readFileSync(new URL('./railbot-api.ts', import.meta.url),'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText, { module: compiledModule, exports: compiledModule.exports, Date, Error, require: (name: string) => { if (!(name in deps)) throw new Error(name); return deps[name]; } });
  return { request: compiledModule.exports.railbotClient('A', () => current), cancel: () => { current = false; }, lookup: (fn: typeof lookup) => { lookup = fn; }, refresh: (fn: typeof refresh) => { refresh = fn; }, transport: (fn: typeof transport) => { transport = fn; }, requests: () => requests, refreshes: () => refreshes };
}
describe('RailBot account-bound network requests', () => {
  it('does not send after the account changes during session lookup', async () => {
    const h = harness(); h.lookup(async () => { h.cancel(); return { data: { session: { user: { id: 'A' }, access_token: 'synthetic' } } }; });
    await assert.rejects(h.request('')); assert.equal(h.requests(), 0);
  });
  it('never sends another account’s refreshed token', async () => {
    const h = harness(); h.lookup(async () => ({ data: { session: { user: { id: 'A' }, access_token: 'old', expires_at: 1 } } }));
    h.refresh(async () => ({ data: { session: { user: { id: 'B' }, access_token: 'not-A' } } }));
    await assert.rejects(h.request('')); assert.equal(h.requests(), 0);
  });
  it('does not automatically replay an ambiguous failed POST', async () => {
    const h = harness(); h.transport(async () => { throw new Error('connection lost'); });
    await assert.rejects(h.request('/confirm', { method: 'POST' })); assert.equal(h.requests(), 1); assert.equal(h.refreshes(), 0);
  });
  it('discards a response returned after the account changes', async () => {
    const h = harness(); h.transport(async () => { h.cancel(); return { ok: true }; });
    await assert.rejects(h.request('/conversations')); assert.equal(h.requests(), 1);
  });
});
