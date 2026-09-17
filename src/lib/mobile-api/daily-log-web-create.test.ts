import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, it } from 'mocha';
import ts from 'typescript';

const projectId = '20000000-0000-4000-8000-000000000001';
const clientId = '30000000-0000-4000-8000-000000000001';
const values = { clientId, log_date: '2026-09-16', weather_temp: 70, weather_conditions: 'Clear', weather_wind: '', work_summary: 'Crew work', safety_notes: '', personnel: [], equipment: [], work_items: [] };
function harness(options: { permitted?: boolean; authenticated?: boolean; duplicate?: boolean; error?: { code: string; message: string }; badReceipt?: boolean } = {}) {
  const calls: Array<{ name: string; args: any }> = []; let activity = 0;
  const query = { select: () => query, eq: () => query, single: async () => ({ data: { id: clientId, ...values }, error: null }) };
  const db = { from: () => query, rpc: async (name: string, args: unknown) => {
    calls.push({ name, args });
    return { data: { id: options.badReceipt ? projectId : clientId, project_id: projectId, duplicate: !!options.duplicate }, error: options.error ?? null };
  } };
  const compiled = { exports: {} as typeof import('../actions/daily-logs') };
  const deps: Record<string, unknown> = {
    'next/cache': { revalidatePath: () => {} }, '@/lib/supabase/server': { createClient: async () => db },
    '@/lib/permissions': { ACTIONS: { DAILY_LOG_CREATE: 'create' } },
    './permissions-helper': { getAuthenticatedUser: async () => ({ user: options.authenticated === false ? null : { id: 'owner' } }),
      checkPermission: async () => ({ allowed: options.permitted !== false, error: 'Permission denied' }),
      logActivity: async () => { activity++; } },
  };
  runInNewContext(ts.transpileModule(readFileSync(new URL('../actions/daily-logs.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { module: compiled, exports: compiled.exports, crypto,
    require: (name: string) => { if (!(name in deps)) throw new Error(name); return deps[name]; } });
  return { create: compiled.exports.createDailyLog, calls, activity: () => activity };
}
describe('Web daily-log atomic create adapter', () => {
  it('uses the original client identity and explicit consent in the shared RPC', async () => {
    const h = harness(); const result = await h.create(projectId, { ...values, allow_same_day: true });
    assert.equal(result.success, true); assert.equal(h.calls.length, 1);
    assert.equal(h.calls[0].name, 'sync_daily_log_create');
    assert.equal(h.calls[0].args.p_client_id, clientId);
    assert.equal(h.calls[0].args.p_idempotency_key, `daily-log-create:${clientId}`);
    assert.equal(h.calls[0].args.p_payload.allow_same_day, true);
  });
  it('does not replay activity on an idempotent retry', async () => {
    const h = harness({ duplicate: true }); assert.equal((await h.create(projectId, values)).success, true); assert.equal(h.activity(), 0);
  });
  it('keeps same-day rejection actionable without reporting success', async () => {
    const h = harness({ error: { code: '23505', message: 'RC_DAILY_LOG_SAME_DAY_CONFIRMATION daily_logs_project_id_log_date_key' } });
    assert.match((await h.create(projectId, values)).error!, /Keep as a separate log/); assert.equal(h.activity(), 0);
  });
  it('rejects unauthenticated, denied and malformed-identity requests before writing', async () => {
    for (const options of [{ authenticated: false }, { permitted: false }]) {
      const h = harness(options); assert.ok((await h.create(projectId, values)).error); assert.equal(h.calls.length, 0);
    }
    const h = harness(); assert.ok((await h.create(projectId, { ...values, clientId: 'not-an-id' })).error); assert.equal(h.calls.length, 0);
  });
  it('does not acknowledge an unrelated receipt', async () => {
    const h = harness({ badReceipt: true }); assert.ok((await h.create(projectId, values)).error); assert.equal(h.activity(), 0);
  });
});
