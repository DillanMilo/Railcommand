import assert from 'node:assert/strict';
import { describe, it } from 'mocha';
import { confirmRailbotProposal } from './railbot-confirm';
import { railbotCreationId } from './railbot';
import type { MobileAuthenticatedContext } from './auth';
const user = '10000000-0000-4000-8000-000000000001';
const project = '20000000-0000-4000-8000-000000000001';
const conversation = '30000000-0000-4000-8000-000000000001';
type Row=Record<string,unknown>;
type QueryResult={data:Row|Row[]|null;error:{message:string}|null};
interface MockQuery {
 select():MockQuery; eq(key:string,value:unknown):MockQuery; order():MockQuery; limit():MockQuery;
 insert(row:Row):MockQuery; single():Promise<QueryResult>; maybeSingle():Promise<QueryResult>;
 then(resolve:(result:QueryResult)=>unknown,reject:(error:unknown)=>unknown):Promise<unknown>;
 run(single:boolean):Promise<QueryResult>;
}
function harness({ canEdit = true, owner = user, savedProject = project, mobile = true } = {}) {
  const tables: Record<string, Row[]> = {
    conversations: [{ id: conversation, user_id: owner, project_id: savedProject }],
    messages: [{ conversation_id: conversation, role: 'assistant', tool_calls: [{ id: 'call-1', mobile_proposal: mobile, function: { name: 'create_daily_log', arguments: JSON.stringify({ work_summary: 'Synthetic field work' }) } }] }],
    profiles: [{ id: user, role: 'member' }],
    project_members: [{ id: 'membership', profile_id: user, project_id: project, project_role: 'foreman', can_edit: canEdit }],
    daily_logs: [],
  };
  let inserts = 0;
  const client = { from(table: string) {
    const filters: [string, unknown][] = []; let insert: Row | null = null;
    const query: MockQuery = {
      select() { return query; }, eq(k: string, v: unknown) { filters.push([k,v]); return query; },
      order() { return query; }, limit() { return query; },
      insert(row: Row) { insert = row; return query; },
      single() { return query.run(true); }, maybeSingle() { return query.run(true); },
      then(resolve:(result:QueryResult)=>unknown, reject:(error:unknown)=>unknown) { return query.run(false).then(resolve,reject); },
      async run(single: boolean) {
        if (insert) {
          if (tables[table].some(r => r.id === insert!.id)) return { data: null, error: { message: 'duplicate primary key' } };
          inserts++; tables[table].push(insert); return { data: insert, error: null };
        }
        const rows = (tables[table] ?? []).filter(r => filters.every(([k,v]) => r[k] === v));
        return { data: single ? rows[0] ?? null : rows, error: null };
      },
    }; return query;
  }, rpc: async () => ({ data: null, error: null }) };
  const auth = { user: { id: user }, supabase: client, accessToken: 'synthetic' } as unknown as MobileAuthenticatedContext;
  return { auth, tables, inserts: () => inserts };
}
describe('Mobile RailBot confirmed live-record boundary', () => {
  it('creates exactly one record when the same confirmation is retried', async () => {
    const h = harness();
    const a = await confirmRailbotProposal(h.auth, project, conversation, 'call-1');
    const b = await confirmRailbotProposal(h.auth, project, conversation, 'call-1');
    assert.equal(a.status, 200); assert.equal(b.status, 200); assert.equal(h.inserts(), 1);
    assert.deepEqual(await a.json(), await b.json());
    assert.equal(h.tables.daily_logs[0].created_by, user); assert.equal(h.tables.daily_logs[0].project_id, project);
  });
  it('rejects a revoked can_edit permission even when the project role can create', async () => {
    const h = harness({ canEdit: false }); const r = await confirmRailbotProposal(h.auth, project, conversation, 'call-1');
    assert.equal(r.status, 403); assert.equal(h.inserts(), 0);
  });
  it('cannot confirm another account or project conversation', async () => {
    for (const options of [{ owner: 'other' }, { savedProject: 'other' }]) {
      const h = harness(options); const r = await confirmRailbotProposal(h.auth, project, conversation, 'call-1');
      assert.equal(r.status, 403); assert.equal(h.inserts(), 0);
    }
  });
  it('does not execute an untrusted or legacy web tool call', async () => {
    for (const mobile of [false, true]) {
      const h = harness({ mobile }); const r = await confirmRailbotProposal(h.auth, project, conversation, mobile ? 'invented' : 'call-1');
      assert.equal(r.status, 400); assert.equal(h.inserts(), 0);
    }
  });
  it('rechecks permission before returning an existing receipt', async () => {
    const h = harness(); await confirmRailbotProposal(h.auth, project, conversation, 'call-1');
    h.tables.project_members[0].can_edit = false;
    assert.equal((await confirmRailbotProposal(h.auth, project, conversation, 'call-1')).status, 403);
    assert.equal(h.inserts(), 1);
  });
  it('uses different IDs for different conversations and calls', () => {
    assert.notEqual(railbotCreationId(conversation, 'call-1'), railbotCreationId(conversation, 'call-2'));
    assert.notEqual(railbotCreationId(conversation, 'call-1'), railbotCreationId('other', 'call-1'));
  });
});
